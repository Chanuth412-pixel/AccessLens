import { pool, query } from "../db.js";
import { AccessLensTemplate } from "../types.js";

type TemplateRow = {
  template_json: AccessLensTemplate;
};

function patternToRegex(pattern: string) {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${escaped}$`, "i");
}

function urlMatchesPattern(url: string, pattern: string) {
  return patternToRegex(pattern).test(url);
}

export async function findApprovedTemplateByUrl(url: string) {
  const result = await query<TemplateRow>(
    `
      select template_json
      from templates
      where status = 'approved'
      order by updated_at desc
    `
  );

  return (
    result.rows.find((row) =>
      row.template_json.urlPatterns.some((pattern) => urlMatchesPattern(url, pattern))
    )?.template_json ?? null
  );
}

export async function listApprovedTemplates() {
  const result = await query<TemplateRow>(
    `
      select template_json
      from templates
      where status = 'approved'
      order by updated_at desc
    `
  );

  return result.rows.map((row) => row.template_json);
}

export async function findReviewDraftTemplateByUrl(url: string) {
  const result = await query<TemplateRow>(
    `
      select template_json
      from templates
      where status in ('draft', 'pending_review')
      order by updated_at desc
    `
  );

  return (
    result.rows.find((row) =>
      row.template_json.urlPatterns.some((pattern) => urlMatchesPattern(url, pattern))
    )?.template_json ?? null
  );
}

export async function saveGeneratedTemplateDraft(template: AccessLensTemplate) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const siteResult = await client.query<{ id: string }>(
      `
        insert into sites (site_key, site_name, base_domain)
        values ($1, $2, $3)
        on conflict (site_key) do update
          set site_name = excluded.site_name,
              base_domain = excluded.base_domain,
              updated_at = now()
        returning id
      `,
      [template.siteId, template.siteName, new URL(template.urlPatterns[0]).hostname]
    );

    const templateResult = await client.query<{ id: string }>(
      `
        insert into templates (
          site_id,
          template_key,
          template_name,
          version,
          status,
          url_patterns,
          template_json
        )
        values ($1, $2, $3, $4, 'pending_review', $5, $6)
        on conflict (template_key) do update
          set template_name = excluded.template_name,
              version = excluded.version,
              status = 'pending_review',
              url_patterns = excluded.url_patterns,
              template_json = excluded.template_json,
              updated_at = now()
        where templates.status <> 'approved'
        returning id
      `,
      [
        siteResult.rows[0].id,
        template.templateKey,
        template.templateName,
        template.version,
        template.urlPatterns,
        template
      ]
    );

    if (templateResult.rows.length === 0) {
      await client.query("rollback");
      return false;
    }

    const templateId = templateResult.rows[0].id;

    await client.query(
      `
        insert into template_versions (
          template_id,
          version,
          status,
          template_json,
          change_note,
          created_by
        )
        values ($1, $2, 'pending_review', $3, $4, 'openai')
        on conflict (template_id, version) do update
          set status = 'pending_review',
              template_json = excluded.template_json,
              change_note = excluded.change_note
      `,
      [templateId, template.version, template, "Generated from a privacy-filtered DOM snapshot"]
    );

    await client.query("delete from field_mappings where template_id = $1", [templateId]);
    for (const [index, field] of template.fields.entries()) {
      await client.query(
        `
          insert into field_mappings (
            template_id,
            field_key,
            label,
            input_type,
            selector,
            xpath,
            required,
            validation_rule,
            options_json,
            sort_order
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          templateId,
          field.id,
          field.label,
          field.type,
          field.selector,
          field.xpath ?? null,
          field.required ?? false,
          field.validationRule ?? null,
          field.options ? JSON.stringify(field.options) : null,
          index
        ]
      );
    }

    await client.query("delete from runner_instructions where template_id = $1", [templateId]);
    for (const [index, instruction] of template.instructions.entries()) {
      await client.query(
        `
          insert into runner_instructions (
            template_id,
            step_order,
            instruction_type,
            field_key,
            selector,
            xpath,
            value_source,
            wait_ms,
            metadata_json
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          templateId,
          index,
          instruction.type,
          instruction.fieldId ?? null,
          instruction.selector ?? null,
          instruction.xpath ?? null,
          instruction.valueSource ?? null,
          instruction.waitMs ?? null,
          instruction.metadata ? JSON.stringify(instruction.metadata) : null
        ]
      );
    }

    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
