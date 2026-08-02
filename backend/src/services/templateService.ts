import { pool, query } from "../db.js";
import type { AccessLensField, AccessLensTemplate, RunnerInstruction } from "../types.js";

type TemplateRow = {
  id: string;
  template_json: AccessLensTemplate;
};

type SiteRow = {
  id: string;
  base_domain: string;
};

type FieldMappingRow = {
  field_key: string;
  label: string;
  input_type: AccessLensField["type"];
  selector: string;
  xpath: string | null;
  required: boolean;
  validation_rule: string | null;
  regex_pattern: string | null;
  validation_description: string | null;
  options_json: unknown;
};

type RunnerInstructionRow = {
  instruction_type: RunnerInstruction["type"];
  field_key: string | null;
  selector: string | null;
  xpath: string | null;
  value_source: string | null;
  wait_ms: number | null;
  metadata_json: Record<string, unknown> | null;
};

export class TemplateResolutionError extends Error {
  constructor(
    public readonly code: "UNKNOWN_SITE" | "KNOWN_SITE_PAGE_NOT_CONFIGURED" | "AMBIGUOUS_TEMPLATE_MATCH",
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "TemplateResolutionError";
  }
}

function patternToRegex(pattern: string) {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${escaped}$`, "i");
}

function urlMatchesPattern(url: string, pattern: string) {
  return patternToRegex(pattern).test(url);
}

function normalizeHeading(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en");
}

function hostnameMatchesDomain(hostname: string, baseDomain: string) {
  const host = hostname.toLocaleLowerCase("en").replace(/\.$/, "");
  const domain = baseDomain.toLocaleLowerCase("en")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/\.$/, "");
  return host === domain || host.endsWith(`.${domain}`);
}

export function matchApprovedTemplateCandidates(
  rows: TemplateRow[],
  url: string,
  heading: string
) {
  const normalizedHeading = normalizeHeading(heading);
  return rows.filter((row) => {
    const templateHeading = row.template_json.pageDetection?.headingText
      ?? row.template_json.pageHeading;
    return row.template_json.urlPatterns.some((pattern) => urlMatchesPattern(url, pattern))
      && Boolean(templateHeading)
      && normalizeHeading(templateHeading as string) === normalizedHeading;
  });
}

async function hydrateApprovedTemplate(row: TemplateRow) {
  const [fieldResult, instructionResult] = await Promise.all([
    query<FieldMappingRow>(
      `
        select
          fm.field_key,
          fm.label,
          fm.input_type,
          fm.selector,
          fm.xpath,
          fm.required,
          fm.validation_rule,
          vr.regex_pattern,
          vr.description as validation_description,
          fm.options_json
        from field_mappings fm
        left join validation_rules vr on vr.rule_key = fm.validation_rule
        where fm.template_id = $1
        order by fm.sort_order, fm.created_at
      `,
      [row.id]
    ),
    query<RunnerInstructionRow>(
      `
        select
          instruction_type,
          field_key,
          selector,
          xpath,
          value_source,
          wait_ms,
          metadata_json
        from runner_instructions
        where template_id = $1
        order by step_order, created_at
      `,
      [row.id]
    )
  ]);

  return {
    ...row.template_json,
    fields: fieldResult.rows.map((field) => ({
      id: field.field_key,
      label: field.label,
      type: field.input_type,
      selector: field.selector,
      xpath: field.xpath ?? undefined,
      required: field.required,
      validationRule: field.validation_rule ?? undefined,
      validationPattern: field.regex_pattern ?? undefined,
      validationMessage: field.validation_description ?? undefined,
      options: Array.isArray(field.options_json)
        ? field.options_json.filter((option): option is string => typeof option === "string")
        : undefined,
      confidence: 1,
      events: ["input" as const, "change" as const]
    })),
    instructions: instructionResult.rows.map((instruction) => ({
      type: instruction.instruction_type,
      fieldId: instruction.field_key ?? undefined,
      selector: instruction.selector ?? undefined,
      xpath: instruction.xpath ?? undefined,
      valueSource: instruction.value_source ?? undefined,
      waitMs: instruction.wait_ms ?? undefined,
      metadata: instruction.metadata_json ?? undefined
    }))
  } satisfies AccessLensTemplate;
}

export async function resolveApprovedTemplateForPage(urlValue: string, heading: string) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlValue);
  } catch {
    throw new TemplateResolutionError("UNKNOWN_SITE", "Invalid page URL", 400);
  }

  if (!(["http:", "https:"] as string[]).includes(parsedUrl.protocol)) {
    throw new TemplateResolutionError("UNKNOWN_SITE", "Only HTTP and HTTPS page URLs are supported", 400);
  }

  const sites = await query<SiteRow>(
    "select id, base_domain from sites where status = 'active'"
  );
  const siteIds = sites.rows
    .filter((site) => hostnameMatchesDomain(parsedUrl.hostname, site.base_domain))
    .map((site) => site.id);

  if (siteIds.length === 0) {
    throw new TemplateResolutionError("UNKNOWN_SITE", "No active site found for this URL", 404);
  }

  const result = await query<TemplateRow>(
    `
      select id, template_json
      from templates
      where site_id = any($1::uuid[])
        and status = 'approved'
      order by updated_at desc
    `,
    [siteIds]
  );
  const matches = matchApprovedTemplateCandidates(result.rows, parsedUrl.href, heading);

  if (matches.length === 0) {
    throw new TemplateResolutionError(
      "KNOWN_SITE_PAGE_NOT_CONFIGURED",
      "This site is known, but this page and heading are not configured in AccessLens",
      404
    );
  }

  if (matches.length > 1) {
    throw new TemplateResolutionError(
      "AMBIGUOUS_TEMPLATE_MATCH",
      "More than one approved template matches this URL and heading",
      409
    );
  }

  return hydrateApprovedTemplate(matches[0]);
}

export async function findApprovedTemplateByUrl(url: string, heading?: string) {
  const result = await query<TemplateRow>(
    `
      select id, template_json
      from templates
      where status = 'approved'
      order by updated_at desc
    `
  );

  const urlMatches = result.rows.filter((row) =>
    row.template_json.urlPatterns.some((pattern) => urlMatchesPattern(url, pattern))
  );
  const normalizedHeading = heading ? normalizeHeading(heading) : undefined;
  const headingMatch = normalizedHeading
    ? urlMatches.find((row) =>
      normalizeHeading(
        row.template_json.pageDetection?.headingText ?? row.template_json.pageHeading ?? ""
      ) === normalizedHeading
    )
    : undefined;

  return headingMatch?.template_json
    ?? urlMatches.find((row) => !row.template_json.pageHeading && !row.template_json.pageDetection)?.template_json
    ?? null;
}

export async function listApprovedTemplates() {
  const result = await query<TemplateRow>(
    `
      select id, template_json
      from templates
      where status = 'approved'
      order by updated_at desc
    `
  );

  return result.rows.map((row) => row.template_json);
}

export async function findReviewDraftTemplateByUrl(url: string, allowedSelectors?: Set<string>) {
  const result = await query<TemplateRow>(
    `
      select id, template_json
      from templates
      where status in ('draft', 'pending_review')
      order by updated_at desc
    `
  );

  return (
    result.rows.find((row) => {
      const urlMatches = row.template_json.urlPatterns.some((pattern) =>
        urlMatchesPattern(url, pattern)
      );
      const selectorsMatch = !allowedSelectors || row.template_json.fields.every((field) =>
        allowedSelectors.has(field.selector)
      );

      return urlMatches && selectorsMatch;
    })?.template_json ?? null
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
          field.type === "date" ? "text" : field.type,
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
