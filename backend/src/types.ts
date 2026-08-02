export type TemplateStatus = "draft" | "pending_review" | "approved" | "archived";

export type AccessLensField = {
  id: string;
  label: string;
  type: "text" | "password" | "email" | "tel" | "number" | "date" | "select" | "textarea";
  selector: string;
  xpath?: string;
  required?: boolean;
  validationRule?: string;
  validationPattern?: string;
  validationMessage?: string;
  options?: string[];
  originalLabel?: string;
  confidence?: number;
  events?: Array<"input" | "change">;
  temporary?: boolean;
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
  source?: "approved" | "manually-approved" | "ai-runtime-generated";
  siteId: string;
  siteName: string;
  templateKey: string;
  templateName: string;
  pageHeading?: string;
  pageDetection?: {
    headingText: string;
    requiredSelectors: string[];
  };
  workflow?: {
    workflowKey: string;
    pageKey: string;
    pageOrder: number;
    totalPages: number;
    nextPageKey: string | null;
  };
  version: string;
  urlPatterns: string[];
  fields: AccessLensField[];
  instructions: RunnerInstruction[];
  policies?: {
    storePersonalData: false;
    autoSubmit: false;
    manualReviewRequired: true;
  };
};
