export type RecordedGuideStep = {
  id: string;
  stepOrder: number;
  pageUrl: string;
  pageTitle: string;
  actionType: "click" | "input" | "select" | "change";
  selector: string;
  xpath: string | null;
  elementLabel: string;
  instructionTitle: string;
  instructionText: string;
};

export type RecordedGuide = {
  id: string;
  category: string;
  siteName: string;
  startUrl: string;
  steps: RecordedGuideStep[];
};
