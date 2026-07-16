import { query } from "../db.js";
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
