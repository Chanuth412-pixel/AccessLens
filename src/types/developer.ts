import type { AccessLensTemplate } from "./accessLensTemplate";

export type TemplateStatus = "draft" | "pending_review" | "approved" | "archived";

export type DeveloperStats = {
  pendingTemplates: number;
  approvedTemplates: number;
  archivedTemplates: number;
  templateErrors: number;
  pendingWebsiteRequests: number;
};

export type WebsiteRequestStatus = "pending" | "in_review" | "fulfilled" | "rejected";

export type WebsiteRequest = {
  id: string;
  url: string;
  base_domain: string;
  site_name: string;
  user_note: string | null;
  status: WebsiteRequestStatus;
  request_count: number;
  created_at: string;
  updated_at: string;
  template_id: string | null;
  template_status: TemplateStatus | null;
};

export type RecordingStep = {
  id: string;
  recording_session_id: string;
  step_order: number;
  page_url: string;
  page_title: string;
  action_type: "click" | "input" | "select" | "change";
  selector: string;
  xpath: string | null;
  element_label: string;
  instruction_title: string;
  instruction_text: string;
  element_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type RecordingSession = {
  id: string;
  website_request_id: string | null;
  site_url: string;
  base_domain: string;
  site_name: string;
  category: string;
  status: "recording" | "completed" | "cancelled";
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecordingSessionDetail = RecordingSession & {
  steps: RecordingStep[];
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
