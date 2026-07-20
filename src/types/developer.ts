import type { AccessLensTemplate } from "./accessLensTemplate";

export type TemplateStatus = "draft" | "pending_review" | "approved" | "archived";

export type DeveloperStats = {
  pendingTemplates: number;
  approvedTemplates: number;
  archivedTemplates: number;
  templateErrors: number;
};

export type DeveloperSite = {
  id: string;
  site_key: string;
  site_name: string;
  base_domain: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type DeveloperTemplateSummary = {
  id: string;
  template_key: string;
  template_name: string;
  version: string;
  status: TemplateStatus;
  url_patterns: string[];
  created_at: string;
  updated_at: string;
  site: DeveloperSite;
};

export type DeveloperFieldMapping = {
  id: string;
  template_id: string;
  field_key: string;
  label: string;
  input_type: string;
  selector: string;
  xpath: string | null;
  required: boolean;
  validation_rule: string | null;
  options_json: unknown;
  sort_order: number;
  created_at: string;
};

export type DeveloperRunnerInstruction = {
  id: string;
  template_id: string;
  step_order: number;
  instruction_type: string;
  field_key: string | null;
  selector: string | null;
  xpath: string | null;
  value_source: string | null;
  wait_ms: number | null;
  metadata_json: unknown;
  created_at: string;
};

export type DeveloperTemplateVersion = {
  id: string;
  template_id: string;
  version: string;
  status: TemplateStatus;
  template_json: AccessLensTemplate;
  change_note: string | null;
  created_by: string | null;
  created_at: string;
};

export type DeveloperTemplateDetail = DeveloperTemplateSummary & {
  template_json: AccessLensTemplate;
  field_mappings: DeveloperFieldMapping[];
  runner_instructions: DeveloperRunnerInstruction[];
  template_versions: DeveloperTemplateVersion[];
};

export type DeveloperValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};
