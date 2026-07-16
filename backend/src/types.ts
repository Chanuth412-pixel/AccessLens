export type TemplateStatus = "draft" | "pending_review" | "approved" | "archived";

export type AccessLensField = {
  id: string;
  label: string;
  type: "text" | "password" | "email" | "tel" | "number" | "select" | "textarea";
  selector: string;
  xpath?: string;
  required?: boolean;
  validationRule?: string;
  options?: string[];
};

export type RunnerInstruction = {
  type: "fill" | "click" | "select" | "waitForElement" | "prompt_user" | "review" | "submit_after_confirm";
  fieldId?: string;
  selector?: string;
  xpath?: string;
  valueSource?: string;
  waitMs?: number;
  metadata?: Record<string, unknown>;
};

export type AccessLensTemplate = {
  siteId: string;
  siteName: string;
  templateKey: string;
  templateName: string;
  version: string;
  urlPatterns: string[];
  fields: AccessLensField[];
  instructions: RunnerInstruction[];
};
