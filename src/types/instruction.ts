export type CompletionRule = Record<string, unknown> & {
  completes_workflow?: boolean;
};

export type AccessLensInstruction = {
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

export type WorkflowProgress = {
  workflowKey: string;
  completedStepOrder: number;
  expectedPageKeys: string[];
  currentPageKey: string;
  lastValidUrl: string;
  currentStepReady: boolean;
};

export type RecordedGuideCategory = {
  id: string;
  category: string;
  site_name: string;
  step_count: number;
  updated_at: string;
};

export type RecordedGuideStep = {
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
};

export type RecordedGuide = RecordedGuideCategory & {
  site_url: string;
  base_domain: string;
  steps: RecordedGuideStep[];
};

export type RecordedGuideProgress = {
  sessionId: string;
  stepIndex: number;
  completedStepIds?: string[];
  replayStepId?: string;
  replayFromStepIndex?: number;
  navigationPending?: boolean;
};
