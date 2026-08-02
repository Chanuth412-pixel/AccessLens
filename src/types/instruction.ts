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
