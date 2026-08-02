import { query } from "../db.js";

export type CompletionRule = Record<string, unknown> & {
  completes_workflow?: boolean;
};

export type InstructionResponse = {
  id: string;
  workflow_key: string;
  page_key: string;
  step_order: number;
  total_workflow_steps: number;
  page_url: string;
  heading_match: string;
  instruction_title: string;
  instruction_text: string;
  completion_rule: CompletionRule;
  allowed_next_page_keys: string[];
  out_of_order_message: string;
  block_out_of_order: boolean;
};

type SiteRow = {
  id: string;
  base_domain: string;
};

type InstructionRow = Omit<InstructionResponse, "total_workflow_steps"> & {
  url_pattern: string;
};

type FirstInstructionRow = InstructionRow & {
  total_workflow_steps: string | number;
};

export function normalizeHeading(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en");
}

function escapeRegexCharacter(character: string) {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
}

export function instructionUrlMatches(url: string, pattern: string) {
  const expression = Array.from(pattern).map((character) => {
    if (character === "%" || character === "*") {
      return ".*";
    }

    if (character === "_") {
      return ".";
    }

    return escapeRegexCharacter(character);
  }).join("");

  return new RegExp(`^${expression}$`, "i").test(url);
}

function hostnameMatchesDomain(hostname: string, baseDomain: string) {
  const normalizedHostname = hostname.toLocaleLowerCase("en").replace(/\.$/, "");
  const normalizedDomain = baseDomain.toLocaleLowerCase("en").replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/\.$/, "");

  return normalizedHostname === normalizedDomain
    || normalizedHostname.endsWith(`.${normalizedDomain}`);
}

function toInstruction(row: InstructionRow, totalWorkflowSteps: number): InstructionResponse {
  const { url_pattern: _urlPattern, ...publicFields } = row;

  return {
    ...publicFields,
    allowed_next_page_keys: row.allowed_next_page_keys ?? [],
    completion_rule: row.completion_rule ?? {},
    total_workflow_steps: totalWorkflowSteps
  };
}

export function parseSupportedUrl(value: string) {
  const parsed = new URL(value);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS page URLs are supported");
  }

  return parsed;
}

export async function resolveInstruction(urlValue: string, heading: string) {
  const parsedUrl = parseSupportedUrl(urlValue);
  const sites = await query<SiteRow>(
    `
      select id, base_domain
      from sites
      where status = 'active'
    `
  );
  const siteIds = sites.rows
    .filter((candidate) => hostnameMatchesDomain(parsedUrl.hostname, candidate.base_domain))
    .map((candidate) => candidate.id);

  if (siteIds.length === 0) {
    return null;
  }

  const result = await query<InstructionRow>(
    `
      select
        id,
        workflow_key,
        page_key,
        step_order,
        url_pattern,
        page_url,
        heading_match,
        instruction_title,
        instruction_text,
        completion_rule,
        allowed_next_page_keys,
        out_of_order_message,
        block_out_of_order
      from instructions
      where site_id = any($1::uuid[])
        and is_active = true
      order by workflow_key, step_order
    `,
    [siteIds]
  );

  const normalizedHeading = normalizeHeading(heading);
  // Keep matching in application code so wildcard URL patterns and normalized H1 text
  // have identical behavior across PostgreSQL and local development databases.
  const instruction = result.rows.find((row) => {
    return instructionUrlMatches(parsedUrl.href, row.url_pattern)
      && normalizeHeading(row.heading_match) === normalizedHeading;
  });

  if (!instruction) {
    return null;
  }

  const totalResult = await query<{ count: string }>(
    `
      select count(*)::text as count
      from instructions
      where workflow_key = $1
        and is_active = true
    `,
    [instruction.workflow_key]
  );

  return toInstruction(instruction, Number(totalResult.rows[0]?.count ?? 0));
}

export async function findFirstWorkflowInstruction(workflowKey: string) {
  const result = await query<FirstInstructionRow>(
    `
      select
        i.id,
        i.workflow_key,
        i.page_key,
        i.step_order,
        i.url_pattern,
        count(*) over () as total_workflow_steps,
        i.page_url,
        i.heading_match,
        i.instruction_title,
        i.instruction_text,
        i.completion_rule,
        i.allowed_next_page_keys,
        i.out_of_order_message,
        i.block_out_of_order
      from instructions i
      join sites s on s.id = i.site_id
      where i.workflow_key = $1
        and i.is_active = true
        and s.status = 'active'
      order by i.step_order
      limit 1
    `,
    [workflowKey]
  );

  const row = result.rows[0];
  return row ? toInstruction(row, Number(row.total_workflow_steps)) : null;
}
