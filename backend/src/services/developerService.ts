import { pool, query } from "../db.js";
import {
  countPendingWebsiteRequests,
  fulfillWebsiteRequestForDomain
} from "./requestService.js";
import type { AccessLensField, AccessLensTemplate, TemplateStatus } from "../types.js";
import type {
  DeveloperFieldMapping,
  DeveloperRunnerInstruction,
  DeveloperStats,
  DeveloperTemplateDetail,
  DeveloperTemplateSummary,
  DeveloperTemplateVersion
} from "../types/developer.js";

type CountRow = {
  status: TemplateStatus;
  count: string;
};

type ErrorCountRow = {
  count: string;
};

type TemplateSummaryRow = Omit<DeveloperTemplateSummary, "site"> & {
  site_id: string;
  site_key: string;
  site_name: string;
  base_domain: string;
  category: string;
  site_status: string;
  site_created_at: string;
  site_updated_at: string;
};

type TemplateDetailRow = TemplateSummaryRow & {
  template_json: AccessLensTemplate;
};

type UpdateFieldMappingInput = {
  id?: string;
  field_key: string;
  label: string;
  input_type: string;
  selector: string;
  xpath?: string | null;
  required: boolean;
  validation_rule?: string | null;
  sort_order: number;
};

type UpdateTemplateInput = {
  template_name?: string;
  url_patterns?: string[];
  template_json?: AccessLensTemplate;
  field_mappings?: UpdateFieldMappingInput[];
};

function toTemplateSummary(row: TemplateSummaryRow): DeveloperTemplateSummary {
  return {
    id: row.id,
    template_key: row.template_key,
    template_name: row.template_name,
    version: row.version,
    status: row.status,
    url_patterns: row.url_patterns,
    created_at: row.created_at,
    updated_at: row.updated_at,
    site: {
      id: row.site_id,
      site_key: row.site_key,
      site_name: row.site_name,
      base_domain: row.base_domain,
      category: row.category,
      status: row.site_status,
      created_at: row.site_created_at,
      updated_at: row.site_updated_at
    }
  };
}

function syncTemplateJsonFields(
  templateJson: AccessLensTemplate,
  fieldMappings: UpdateFieldMappingInput[]
) {
  const mappingsByKey = new Map(fieldMappings.map((field) => [field.field_key, field]));
  const fields = templateJson.fields.map<AccessLensField>((field) => {
    const mapping = mappingsByKey.get(field.id);

    if (!mapping) {
      return field;
    }

    return {
      ...field,
      label: mapping.label,
      type: mapping.input_type as AccessLensField["type"],
      selector: mapping.selector,
      xpath: mapping.xpath ?? undefined,
      required: mapping.required,
      validationRule: mapping.validation_rule ?? undefined
    };
  });

  const instructions = templateJson.instructions.map((instruction) => {
    if (!instruction.fieldId) {
      return instruction;
    }

    const mapping = mappingsByKey.get(instruction.fieldId);
    if (!mapping) {
      return instruction;
    }

    return {
      ...instruction,
      selector: mapping.selector,
      xpath: mapping.xpath ?? undefined
    };
  });

  return {
    ...templateJson,
    fields,
    instructions
  };
}

async function getTemplateJson(templateId: string) {
  const result = await query<{ template_json: AccessLensTemplate }>(
    "select template_json from templates where id = $1",
    [templateId]
  );

  return result.rows[0]?.template_json ?? null;
}

export async function getDeveloperStats(): Promise<DeveloperStats> {
  const [templateCounts, errorCounts, pendingRequestsCount] = await Promise.all([
    query<CountRow>(
      `
        select status, count(*)::text as count
        from templates
        group by status
      `
    ),
    query<ErrorCountRow>("select count(*)::text as count from anonymous_template_errors"),
    countPendingWebsiteRequests()
  ]);

  const counts = new Map(
    templateCounts.rows.map((row) => [row.status, Number(row.count)])
  );

  return {
    pendingTemplates: counts.get("pending_review") ?? 0,
    approvedTemplates: counts.get("approved") ?? 0,
    archivedTemplates: counts.get("archived") ?? 0,
    templateErrors: Number(errorCounts.rows[0]?.count ?? 0),
    pendingWebsiteRequests: pendingRequestsCount
  };
}


export async function listPendingDeveloperTemplates() {
  const result = await query<TemplateSummaryRow>(
    `
      select
        templates.id,
        templates.template_key,
        templates.template_name,
        templates.version,
        templates.status,
        templates.url_patterns,
        templates.created_at,
        templates.updated_at,
        sites.id as site_id,
        sites.site_key,
        sites.site_name,
        sites.base_domain,
        sites.category,
        sites.status as site_status,
        sites.created_at as site_created_at,
        sites.updated_at as site_updated_at
      from templates
      join sites on sites.id = templates.site_id
      where templates.status = 'pending_review'
      order by templates.updated_at desc
    `
  );

  return result.rows.map(toTemplateSummary);
}

export async function getDeveloperTemplateDetail(templateId: string) {
  const templateResult = await query<TemplateDetailRow>(
    `
      select
        templates.id,
        templates.template_key,
        templates.template_name,
        templates.version,
        templates.status,
        templates.url_patterns,
        templates.template_json,
        templates.created_at,
        templates.updated_at,
        sites.id as site_id,
        sites.site_key,
        sites.site_name,
        sites.base_domain,
        sites.category,
        sites.status as site_status,
        sites.created_at as site_created_at,
        sites.updated_at as site_updated_at
      from templates
      join sites on sites.id = templates.site_id
      where templates.id = $1
    `,
    [templateId]
  );

  const template = templateResult.rows[0];
  if (!template) {
    return null;
  }

  const [fieldMappings, runnerInstructions, templateVersions] = await Promise.all([
    query<DeveloperFieldMapping>(
      "select * from field_mappings where template_id = $1 order by sort_order asc",
      [templateId]
    ),
    query<DeveloperRunnerInstruction>(
      "select * from runner_instructions where template_id = $1 order by step_order asc",
      [templateId]
    ),
    query<DeveloperTemplateVersion>(
      `
        select *
        from template_versions
        where template_id = $1
        order by created_at desc
        limit 5
      `,
      [templateId]
    )
  ]);

  return {
    ...toTemplateSummary(template),
    template_json: template.template_json,
    field_mappings: fieldMappings.rows,
    runner_instructions: runnerInstructions.rows,
    template_versions: templateVersions.rows
  } satisfies DeveloperTemplateDetail;
}

export function validateDeveloperTemplateDetail(detail: {
  field_mappings: Array<Pick<DeveloperFieldMapping, "field_key" | "label" | "input_type" | "selector">>;
  runner_instructions: Array<Pick<DeveloperRunnerInstruction, "instruction_type">>;
}) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (detail.field_mappings.length === 0) {
    errors.push("Template must have at least one field mapping.");
  }

  for (const field of detail.field_mappings) {
    if (!field.field_key || !field.label || !field.input_type || !field.selector) {
      errors.push(`Field mapping ${field.field_key || "unknown"} is missing required details.`);
    }

    if (field.input_type === "password") {
      errors.push(`Field mapping ${field.field_key} uses password, which AccessLens should not fill.`);
    }
  }

  for (const instruction of detail.runner_instructions) {
    if (instruction.instruction_type === "submit_after_confirm") {
      warnings.push("Runner instruction includes submit_after_confirm. Confirm this is intentional before approval.");
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export async function updateDeveloperTemplate(templateId: string, input: UpdateTemplateInput) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const currentTemplateJson = input.template_json ?? await getTemplateJson(templateId);
    if (!currentTemplateJson) {
      await client.query("rollback");
      return null;
    }

    let nextTemplateJson = currentTemplateJson;

    if (input.field_mappings) {
      for (const field of input.field_mappings) {
        await client.query(
          `
            update field_mappings
            set
              label = $1,
              input_type = $2,
              selector = $3,
              xpath = $4,
              required = $5,
              validation_rule = $6,
              sort_order = $7
            where id = $8 and template_id = $9
          `,
          [
            field.label,
            field.input_type,
            field.selector,
            field.xpath || null,
            field.required,
            field.validation_rule || null,
            field.sort_order,
            field.id,
            templateId
          ]
        );
      }

      nextTemplateJson = syncTemplateJsonFields(currentTemplateJson, input.field_mappings);
    }

    const templateName = input.template_name ?? nextTemplateJson.templateName;
    const urlPatterns = input.url_patterns ?? nextTemplateJson.urlPatterns;
    nextTemplateJson = {
      ...nextTemplateJson,
      templateName,
      urlPatterns
    };

    await client.query(
      `
        update templates
        set
          template_name = $1,
          url_patterns = $2,
          template_json = $3,
          updated_at = now()
        where id = $4
      `,
      [templateName, urlPatterns, nextTemplateJson, templateId]
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return getDeveloperTemplateDetail(templateId);
}

async function setTemplateStatus(
  templateId: string,
  status: "approved" | "archived",
  changeNote: string
) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const templateResult = await client.query<{
      id: string;
      version: string;
      template_json: AccessLensTemplate;
    }>(
      "select id, version, template_json from templates where id = $1",
      [templateId]
    );

    const template = templateResult.rows[0];
    if (!template) {
      await client.query("rollback");
      return null;
    }

    await client.query(
      "update templates set status = $1, updated_at = now() where id = $2",
      [status, templateId]
    );

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
        values ($1, $2, $3, $4, $5, 'developer-console')
        on conflict (template_id, version) do update
          set status = excluded.status,
              template_json = excluded.template_json,
              change_note = excluded.change_note,
              created_by = excluded.created_by
      `,
      [templateId, template.version, status, template.template_json, changeNote]
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return getDeveloperTemplateDetail(templateId);
}

export async function approveDeveloperTemplate(templateId: string, note?: string) {
  const approved = await setTemplateStatus(
    templateId,
    "approved",
    note?.trim() || "Approved from Developer Console"
  );

  if (approved) {
    await fulfillWebsiteRequestForDomain(approved.site.base_domain);
  }

  return approved;
}

export async function rejectDeveloperTemplate(templateId: string, reason?: string) {
  return setTemplateStatus(
    templateId,
    "archived",
    reason?.trim() || "Rejected from Developer Console"
  );
}
