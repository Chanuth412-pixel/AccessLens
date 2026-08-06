import stylesText from "./contentStyles.css?inline";
import type { AccessLensField, AccessLensTemplate } from "../types/accessLensTemplate";
import type {
  AccessLensInstruction,
  RecordedGuide,
  RecordedGuideCategory,
  RecordedGuideProgress,
  RecordedGuideStep,
  WorkflowProgress
} from "../types/instruction";

const overlayId = "accesslens-overlay-root";
const backendApiUrl = "http://localhost:4000/api";
const lowConfidenceThreshold = 0.7;

type ViewMode = "all" | "wizard";
type Language = "en" | "si";

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

type FillResult = {
  label: string;
  ok: boolean;
  message: string;
  lowConfidence: boolean;
};

function normalizeText(value: string | null | undefined, maxLength = 200) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function escapeAttributeValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const uiText = {
  en: {
    allFieldsView: "All Fields View",
    back: "Back",
    close: "Close",
    completed: "Completed",
    confirmAndFill: "Confirm and Fill Original Form",
    fillSuccess: "Fields were filled. Review the original website form before submitting it yourself.",
    fillWarning: "Some fields need manual attention. The original form was not submitted.",
    hint: "Enter your details clearly as shown on official documents.",
    next: "Next",
    notEntered: "Not entered",
    pleaseEnter: "Please enter",
    reviewDetails: "Review Details",
    reviewDetailsHeading: "Review details",
    reviewMessage: "Review the details and mappings before confirming.",
    separateWindow: "Separate window",
    separateWindowError: "Could not open the separate window.",
    stepByStepWizard: "Step-by-Step Wizard",
    requestWebsite: "Request Website Support",
    requestingWebsite: "Sending Request...",
    websiteRequestedSuccess: "Website support requested! The developer board has been notified.",
    requestNotePlaceholder: "Optional note for developers...",
    unsupportedNotice: "This site is not yet officially registered in AccessLens."
  },
  si: {
    allFieldsView: "සියලු ක්ෂේත්‍ර",
    back: "ආපසු",
    close: "වසන්න",
    completed: "සම්පූර්ණයි",
    confirmAndFill: "තහවුරු කර මුල් පෝරමය පුරවන්න",
    fillSuccess: "ක්ෂේත්‍ර පුරවා ඇත. යැවීමට පෙර මුල් පෝරමය පරීක්ෂා කරන්න.",
    fillWarning: "ක්ෂේත්‍ර කිහිපයක් අතින් පරීක්ෂා කළ යුතුය. මුල් පෝරමය යවා නැත.",
    hint: "නිල ලේඛනවල පරිදි තොරතුරු පැහැදිලිව ඇතුළත් කරන්න.",
    next: "ඊළඟ",
    notEntered: "ඇතුළත් කර නැත",
    pleaseEnter: "කරුණාකර ඇතුළත් කරන්න",
    reviewDetails: "විස්තර පරීක්ෂා කරන්න",
    reviewDetailsHeading: "විස්තර පරීක්ෂා කරන්න",
    reviewMessage: "තහවුරු කිරීමට පෙර විස්තර සහ ගැළපීම් පරීක්ෂා කරන්න.",
    separateWindow: "වෙනම කවුළුව",
    separateWindowError: "වෙනම කවුළුව විවෘත කළ නොහැක.",
    stepByStepWizard: "පියවරෙන් පියවර",
    requestWebsite: "මෙම වෙබ් අඩවිය සඳහා ඉල්ලුම් කරන්න",
    requestingWebsite: "යවමින් පවතී...",
    websiteRequestedSuccess: "සහාය ඉල්ලුම් කරන ලදී! සංවර්ධක මණ්ඩලයට දැනුම් දී ඇත.",
    requestNotePlaceholder: "අමතර සටහනක් ඇතුළත් කරන්න (අත්‍යවශ්‍ය නොවේ)...",
    unsupportedNotice: "මෙම වෙබ් අඩවිය තවමත් AccessLens හි නිල වශයෙන් ලියාපදිංචි වී නොමැත."
  }
} satisfies Record<Language, Record<string, string>>;


const sinhalaFieldLabels: Record<string, string> = {
  address: "ලිපිනය",
  email: "ඊමේල්",
  "email address": "ඊමේල්",
  "full name": "සම්පූර්ණ නම",
  name: "නම",
  nic: "ජාතික හැඳුනුම්පත් අංකය",
  "national identity card": "ජාතික හැඳුනුම්පත් අංකය",
  "phone no.": "දුරකථන අංකය",
  "phone no": "දුරකථන අංකය",
  "phone number": "දුරකථන අංකය"
};

function t(language: Language, key: keyof typeof uiText.en) {
  return uiText[language][key];
}

function translateFieldLabel(label: string, language: Language) {
  if (language === "en") {
    return label;
  }

  return sinhalaFieldLabels[normalizeText(label).toLowerCase()] ?? label;
}

function isSafeInputType(input: HTMLInputElement) {
  const inputType = (input.getAttribute("type") || "text").toLowerCase();
  return new Set(["text", "email", "tel", "number", "date"]).has(inputType);
}

function isVisibleControl(element: FormControl) {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function isSupportedControl(element: FormControl) {
  if (
    element.disabled
    || ("readOnly" in element && element.readOnly)
    || element.closest(`[aria-hidden="true"]`)
    || !isVisibleControl(element)
  ) {
    return false;
  }

  return !(element instanceof HTMLInputElement) || isSafeInputType(element);
}

function isSafeFillTarget(element: Element | null): element is FormControl {
  if (
    !(element instanceof HTMLInputElement)
    && !(element instanceof HTMLSelectElement)
    && !(element instanceof HTMLTextAreaElement)
  ) {
    return false;
  }

  return isSupportedControl(element);
}

declare const chrome: {
  runtime?: {
    lastError?: { message?: string };
    onMessage?: {
      addListener: (
        callback: (
          message: { type: string; values?: Record<string, string> },
          sender: unknown,
          sendResponse: (response: unknown) => void
        ) => boolean | void
      ) => void;
    };
    sendMessage: (
      message: {
        type: string;
        url?: string;
        method?: string;
        headers?: Record<string, string>;
        body?: unknown;
        session?: unknown;
        progress?: WorkflowProgress;
        guideProgress?: RecordedGuideProgress;
        draftKey?: string;
        draftValues?: Record<string, string>;
      },
      callback: (response: {
        ok?: boolean;
        status?: number;
        data?: unknown;
        error?: string;
        progress?: WorkflowProgress | null;
        guideProgress?: RecordedGuideProgress | null;
        values?: Record<string, string> | null;
      } | undefined) => void
    ) => void;
  };
};

function getDraftStorageKey(templateKey: string) {
  return `accesslens-draft:${templateKey}`;
}

function getLocalDraft(draftKey: string) {
  return new Promise<Record<string, string> | null>((resolve) => {
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;

    if (!runtime || typeof runtime.sendMessage !== "function") {
      resolve(null);
      return;
    }

    runtime.sendMessage({ type: "GET_LOCAL_DRAFT", draftKey }, (response) => {
      if (runtime.lastError || !response?.ok) {
        resolve(null);
        return;
      }

      resolve(response.values ?? null);
    });
  });
}

function saveLocalDraft(draftKey: string, draftValues: Record<string, string>) {
  return new Promise<void>((resolve) => {
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;

    if (!runtime || typeof runtime.sendMessage !== "function") {
      resolve();
      return;
    }

    runtime.sendMessage({ type: "SAVE_LOCAL_DRAFT", draftKey, draftValues }, () => {
      void runtime.lastError;
      resolve();
    });
  });
}

function clearLocalDraft(draftKey: string) {
  return new Promise<void>((resolve) => {
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;

    if (!runtime || typeof runtime.sendMessage !== "function") {
      resolve();
      return;
    }

    runtime.sendMessage({ type: "CLEAR_LOCAL_DRAFT", draftKey }, () => {
      void runtime.lastError;
      resolve();
    });
  });
}

function getOriginalPageDraftKey() {
  const url = new URL(window.location.href);
  return `accesslens-original-draft:${url.hostname}${url.pathname}`;
}

function getControlSelector(control: FormControl) {
  if (control.id) {
    return `#${escapeAttributeValue(control.id)}`;
  }
  if (control.name) {
    return `[name="${escapeAttributeValue(control.name)}"]`;
  }
  return null;
}

function initOriginalPageDraftHandler() {
  const draftKey = getOriginalPageDraftKey();

  void getLocalDraft(draftKey).then((saved) => {
    if (!saved) return;
    Object.entries(saved).forEach(([selector, value]) => {
      if (!value) return;
      try {
        const control = document.querySelector<FormControl>(selector);
        if (control && isSafeFillTarget(control) && !control.closest(`#${overlayId}`)) {
          if (control.value !== value) {
            setNativeValue(control, value);
            control.dispatchEvent(new Event("input", { bubbles: true }));
            control.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      } catch {
        // Ignore invalid selectors
      }
    });
  });

  let debounceTimer: number | undefined;

  const handleOriginalInput = (event: Event) => {
    const target = event.target;
    if (!isSafeFillTarget(target as Element)) {
      return;
    }

    const control = target as FormControl;
    if (control.closest(`#${overlayId}`)) {
      return;
    }

    const selector = getControlSelector(control);
    if (!selector) {
      return;
    }

    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(async () => {
      const currentDraft = (await getLocalDraft(draftKey)) || {};
      const val = control.value.trim();
      if (val) {
        currentDraft[selector] = val;
      } else {
        delete currentDraft[selector];
      }
      void saveLocalDraft(draftKey, currentDraft);
    }, 300);
  };

  document.addEventListener("input", handleOriginalInput, true);
  document.addEventListener("change", handleOriginalInput, true);

  document.addEventListener("submit", (event) => {
    const isOverlaySubmit = event.composedPath().some(
      (el) => el instanceof HTMLElement && el.id === overlayId
    );
    if (!isOverlaySubmit) {
      void clearLocalDraft(draftKey);
    }
  }, true);
}

function getWorkflowProgress() {
  return new Promise<WorkflowProgress | null>((resolve) => {
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;

    if (!runtime || typeof runtime.sendMessage !== "function") {
      resolve(null);
      return;
    }

    runtime.sendMessage({ type: "GET_WORKFLOW_PROGRESS" }, (response) => {
      // Workflow state improves multi-page guidance but must never prevent the
      // overlay itself from loading if extension storage is unavailable.
      if (runtime.lastError || !response?.ok) {
        resolve(null);
        return;
      }

      resolve(response.progress ?? null);
    });
  });
}

function saveWorkflowProgress(progress: WorkflowProgress) {
  return new Promise<void>((resolve) => {
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;

    if (!runtime || typeof runtime.sendMessage !== "function") {
      resolve();
      return;
    }

    runtime.sendMessage({ type: "SAVE_WORKFLOW_PROGRESS", progress }, () => {
      // Read runtime.lastError inside the callback so Chrome does not emit an
      // unchecked runtime error when a tab or service worker is torn down.
      void runtime.lastError;
      resolve();
    });
  });
}

function clearWorkflowProgress() {
  return new Promise<void>((resolve) => {
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;

    if (!runtime || typeof runtime.sendMessage !== "function") {
      resolve();
      return;
    }

    runtime.sendMessage({ type: "CLEAR_WORKFLOW_PROGRESS" }, () => {
      void runtime.lastError;
      resolve();
    });
  });
}

function getRecordedGuideProgress() {
  return new Promise<RecordedGuideProgress | null>((resolve) => {
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;
    if (!runtime || typeof runtime.sendMessage !== "function") {
      resolve(null);
      return;
    }

    runtime.sendMessage({ type: "GET_RECORDED_GUIDE_PROGRESS" }, (response) => {
      if (runtime.lastError || !response?.ok) {
        resolve(null);
        return;
      }
      resolve(response.guideProgress ?? null);
    });
  });
}

function saveRecordedGuideProgress(guideProgress: RecordedGuideProgress) {
  return new Promise<void>((resolve) => {
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;
    if (!runtime || typeof runtime.sendMessage !== "function") {
      resolve();
      return;
    }

    runtime.sendMessage({ type: "SAVE_RECORDED_GUIDE_PROGRESS", guideProgress }, () => {
      void runtime.lastError;
      resolve();
    });
  });
}

function clearRecordedGuideProgress() {
  return new Promise<void>((resolve) => {
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;
    if (!runtime || typeof runtime.sendMessage !== "function") {
      resolve();
      return;
    }

    runtime.sendMessage({ type: "CLEAR_RECORDED_GUIDE_PROGRESS" }, () => {
      void runtime.lastError;
      resolve();
    });
  });
}

async function apiFetch(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
): Promise<Response> {
  const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;
  if (runtime && typeof runtime.sendMessage === "function") {
    try {
      const response = await new Promise<{ ok: boolean; status: number; data?: unknown; error?: string }>(
        (resolve) => {
          runtime.sendMessage(
            { type: "FETCH_API", url, method: options.method, headers: options.headers, body: options.body },
            (res) => {
              if (runtime.lastError || !res) {
                resolve({ ok: false, status: 0, error: runtime.lastError?.message || "No response" });
              } else {
                resolve({
                  ok: Boolean(res.ok),
                  status: res.status ?? 0,
                  data: res.data,
                  error: res.error
                });
              }
            }
          );
        }
      );

      if (response.status !== 0) {
        return {
          ok: response.ok,
          status: response.status,
          json: async () => response.data,
          text: async () => (typeof response.data === "string" ? response.data : JSON.stringify(response.data))
        } as unknown as Response;
      }
    } catch {
      // Fallback
    }
  }

  return fetch(url, {
    method: options.method || "GET",
    headers: options.headers as HeadersInit,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
}

async function getApiError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null) as { error?: string } | null;
  return data?.error || fallback;
}

function getCurrentPageHeading() {
  return normalizeText(document.querySelector("h1")?.textContent, 300);
}

async function fetchRecordedGuideCategories() {
  const response = await apiFetch(
    `${backendApiUrl}/instructions/guides?url=${encodeURIComponent(window.location.href)}`
  );
  if (!response.ok) {
    throw new Error(await getApiError(response, "AccessLens could not load website categories."));
  }

  const data = await response.json() as { categories: RecordedGuideCategory[] };
  return data.categories ?? [];
}

async function fetchRecordedGuide(sessionId: string) {
  const response = await apiFetch(
    `${backendApiUrl}/instructions/guides/${encodeURIComponent(sessionId)}`
  );
  if (!response.ok) {
    throw new Error(await getApiError(response, "AccessLens could not load this guide."));
  }

  const data = await response.json() as { guide: RecordedGuide };
  return data.guide;
}

async function resolveInstructionForCurrentPage() {
  const heading = getCurrentPageHeading();

  if (!heading) {
    return null;
  }

  const response = await apiFetch(
    `${backendApiUrl}/instructions/resolve?url=${encodeURIComponent(window.location.href)}&heading=${encodeURIComponent(heading)}`
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await getApiError(response, "AccessLens could not resolve page guidance."));
  }

  const data = await response.json() as { instruction: AccessLensInstruction };
  return data.instruction;
}

async function getFirstWorkflowInstruction(workflowKey: string) {
  const response = await apiFetch(
    `${backendApiUrl}/instructions/workflows/${encodeURIComponent(workflowKey)}/first`
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as { instruction: AccessLensInstruction };
  return data.instruction;
}

type WorkflowPageAccess = {
  progress: WorkflowProgress;
  outOfOrder: boolean;
  requiredStepText: string;
  returnUrl: string;
};

async function evaluateWorkflowPage(instruction: AccessLensInstruction): Promise<WorkflowPageAccess> {
  const savedProgress = await getWorkflowProgress();

  if (!savedProgress || savedProgress.workflowKey !== instruction.workflow_key) {
    if (instruction.step_order === 1) {
      const progress: WorkflowProgress = {
        workflowKey: instruction.workflow_key,
        completedStepOrder: 0,
        expectedPageKeys: [instruction.page_key],
        currentPageKey: instruction.page_key,
        lastValidUrl: window.location.href,
        currentStepReady: false
      };
      await saveWorkflowProgress(progress);
      return {
        progress,
        outOfOrder: false,
        requiredStepText: `Step 1 (${instruction.page_key})`,
        returnUrl: instruction.page_url
      };
    }

    const firstInstruction = await getFirstWorkflowInstruction(instruction.workflow_key);
    const progress: WorkflowProgress = {
      workflowKey: instruction.workflow_key,
      completedStepOrder: 0,
      expectedPageKeys: firstInstruction ? [firstInstruction.page_key] : [],
      currentPageKey: "",
      lastValidUrl: firstInstruction?.page_url ?? instruction.page_url,
      currentStepReady: false
    };

    return {
      progress,
      outOfOrder: instruction.block_out_of_order,
      requiredStepText: firstInstruction
        ? `Step ${firstInstruction.step_order} (${firstInstruction.page_key})`
        : "the first workflow step",
      returnUrl: firstInstruction?.page_url ?? instruction.page_url
    };
  }

  const isRefresh = savedProgress.currentPageKey === instruction.page_key;
  const isCompletedEarlierPage = instruction.step_order <= savedProgress.completedStepOrder;
  const isExpectedPage = savedProgress.expectedPageKeys.includes(instruction.page_key);
  const allowed = isRefresh || isCompletedEarlierPage || isExpectedPage;

  if (!allowed && instruction.block_out_of_order) {
    const nextStepOrder = Math.min(
      savedProgress.completedStepOrder + 1,
      instruction.total_workflow_steps
    );
    const expectedKeys = savedProgress.expectedPageKeys.join(" or ");
    return {
      progress: savedProgress,
      outOfOrder: true,
      requiredStepText: expectedKeys
        ? `Step ${nextStepOrder} (${expectedKeys})`
        : `Step ${nextStepOrder}`,
      returnUrl: savedProgress.lastValidUrl || instruction.page_url
    };
  }

  const progress: WorkflowProgress = {
    ...savedProgress,
    currentPageKey: instruction.page_key,
    lastValidUrl: window.location.href,
    // Form values are intentionally not persisted, so a fresh document must be
    // reviewed and filled again even when it is a refresh of the valid page.
    currentStepReady: false
  };
  await saveWorkflowProgress(progress);

  return {
    progress,
    outOfOrder: false,
    requiredStepText: `Step ${instruction.step_order} (${instruction.page_key})`,
    returnUrl: progress.lastValidUrl
  };
}

function createInstructionPopup(instruction: AccessLensInstruction) {
  const popup = document.createElement("aside");
  popup.className = "accesslens-guide";
  popup.setAttribute("aria-label", "AccessLens guided process instruction");

  const header = document.createElement("div");
  header.className = "accesslens-guide-header";
  const brand = document.createElement("div");
  brand.className = "accesslens-guide-brand";
  const logo = document.createElement("span");
  logo.className = "accesslens-logo-mark";
  logo.textContent = "AL";
  const brandText = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = "AccessLens";
  const eyebrow = document.createElement("span");
  eyebrow.textContent = "Guided process";
  brandText.append(name, eyebrow);
  brand.append(logo, brandText);

  const controls = document.createElement("div");
  controls.className = "accesslens-guide-controls";
  const minimizeButton = document.createElement("button");
  minimizeButton.type = "button";
  minimizeButton.className = "accesslens-icon-button";
  minimizeButton.setAttribute("aria-label", "Minimize instruction");
  minimizeButton.textContent = "−";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "accesslens-icon-button";
  closeButton.setAttribute("aria-label", "Close instruction");
  closeButton.textContent = "×";
  controls.append(minimizeButton, closeButton);
  header.append(brand, controls);

  const body = document.createElement("div");
  body.className = "accesslens-guide-body";
  const step = document.createElement("div");
  step.className = "accesslens-guide-step";
  step.textContent = `Step ${instruction.step_order} of ${instruction.total_workflow_steps}`;
  const title = document.createElement("h2");
  title.textContent = instruction.instruction_title;
  const text = document.createElement("p");
  text.textContent = instruction.instruction_text;
  const aiSupportButton = document.createElement("button");
  aiSupportButton.type = "button";
  aiSupportButton.className = "accesslens-ai-support-toggle";
  aiSupportButton.textContent = "Ask AI support";
  aiSupportButton.setAttribute("aria-expanded", "false");

  const aiSupport = document.createElement("div");
  aiSupport.className = "accesslens-ai-support";
  aiSupport.id = `accesslens-ai-support-${instruction.id}`;
  aiSupport.hidden = true;
  aiSupportButton.setAttribute("aria-controls", aiSupport.id);
  const aiSupportLabel = document.createElement("label");
  aiSupportLabel.textContent = "What part is difficult to understand?";
  const aiSupportInput = document.createElement("textarea");
  aiSupportInput.rows = 3;
  aiSupportInput.maxLength = 500;
  aiSupportInput.placeholder = "For example: I do not understand what documents I need.";
  aiSupportInput.setAttribute("aria-describedby", `accesslens-ai-support-help-${instruction.id}`);
  const aiSupportHelp = document.createElement("span");
  aiSupportHelp.id = `accesslens-ai-support-help-${instruction.id}`;
  aiSupportHelp.className = "accesslens-ai-support-help";
  aiSupportHelp.textContent = "Do not include names, passwords, or other personal details.";
  const explainButton = document.createElement("button");
  explainButton.type = "button";
  explainButton.className = "accesslens-ai-support-submit";
  explainButton.textContent = "Explain simply";
  const aiSupportStatus = document.createElement("div");
  aiSupportStatus.className = "accesslens-ai-support-status";
  aiSupportStatus.setAttribute("role", "status");
  aiSupportStatus.setAttribute("aria-live", "polite");
  aiSupportLabel.append(aiSupportInput);
  aiSupport.append(aiSupportLabel, aiSupportHelp, explainButton, aiSupportStatus);
  const progress = document.createElement("div");
  progress.className = "accesslens-guide-progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-valuemin", "1");
  progress.setAttribute("aria-valuemax", String(instruction.total_workflow_steps));
  progress.setAttribute("aria-valuenow", String(instruction.step_order));
  const fill = document.createElement("span");
  fill.style.width = `${(instruction.step_order / instruction.total_workflow_steps) * 100}%`;
  progress.append(fill);
  body.append(step, title, text, aiSupportButton, aiSupport, progress);
  popup.append(header, body);

  aiSupportButton.addEventListener("click", () => {
    const expanded = aiSupport.hidden;
    aiSupport.hidden = !expanded;
    aiSupportButton.setAttribute("aria-expanded", String(expanded));
    aiSupportButton.textContent = expanded ? "Hide AI support" : "Ask AI support";

    if (expanded) {
      aiSupportInput.focus();
    }
  });

  explainButton.addEventListener("click", async () => {
    const question = aiSupportInput.value.trim();
    if (!question) {
      aiSupportStatus.className = "accesslens-ai-support-status accesslens-ai-support-error";
      aiSupportStatus.textContent = "Please describe what is difficult to understand.";
      aiSupportInput.focus();
      return;
    }

    explainButton.disabled = true;
    aiSupportInput.disabled = true;
    explainButton.textContent = "Simplifying...";
    aiSupportStatus.className = "accesslens-ai-support-status";
    aiSupportStatus.textContent = "Creating a simple explanation...";

    try {
      const response = await apiFetch(
        `${backendApiUrl}/instructions/${encodeURIComponent(instruction.id)}/ai-support`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: { question }
        }
      );

      if (!response.ok) {
        throw new Error(await getApiError(response, "AI support could not explain this instruction."));
      }

      const data = await response.json() as { explanation?: string };
      if (!data.explanation) {
        throw new Error("AI support did not return an explanation.");
      }

      aiSupportStatus.className = "accesslens-ai-support-status accesslens-ai-support-answer";
      aiSupportStatus.textContent = data.explanation;
    } catch (error) {
      aiSupportStatus.className = "accesslens-ai-support-status accesslens-ai-support-error";
      aiSupportStatus.textContent = error instanceof Error
        ? error.message
        : "AI support is unavailable. Try again shortly.";
    } finally {
      explainButton.disabled = false;
      aiSupportInput.disabled = false;
      explainButton.textContent = "Explain simply";
    }
  });

  minimizeButton.addEventListener("click", () => {
    const minimized = !body.hidden;
    body.hidden = minimized;
    minimizeButton.textContent = minimized ? "+" : "−";
    minimizeButton.setAttribute("aria-label", minimized ? "Expand instruction" : "Minimize instruction");
  });
  closeButton.addEventListener("click", () => popup.remove());

  return popup;
}

function attachBlockingSubmitGuard(onBlocked: () => void) {
  const handler = (event: SubmitEvent) => {
    if (!isManualContinueForm(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    onBlocked();
  };
  document.addEventListener("submit", handler, true);
  return () => document.removeEventListener("submit", handler, true);
}

function isManualContinueForm(target: EventTarget | null) {
  if (!(target instanceof HTMLFormElement)) {
    return false;
  }

  return Array.from(target.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
    'button[type="submit"], input[type="submit"], button:not([type])'
  )).some((control) => normalizeText(
    control instanceof HTMLInputElement ? control.value : control.textContent
  ).toLocaleLowerCase("en") === "continue");
}

function createOutOfOrderWarning(
  instruction: AccessLensInstruction,
  requiredStepText: string,
  returnUrl: string
) {
  const backdrop = document.createElement("div");
  backdrop.className = "accesslens-blocking-backdrop";
  const modal = document.createElement("section");
  modal.className = "accesslens-warning-modal";
  modal.setAttribute("role", "alertdialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "AccessLens workflow order warning");
  const badge = document.createElement("span");
  badge.className = "accesslens-warning-badge";
  badge.textContent = "Out of order";
  const title = document.createElement("h2");
  title.textContent = "Complete the required step first";
  const message = document.createElement("p");
  message.textContent = instruction.out_of_order_message;
  const required = document.createElement("p");
  required.className = "accesslens-required-step";
  required.textContent = `Required first: ${requiredStepText}`;
  const returnButton = document.createElement("button");
  returnButton.type = "button";
  returnButton.className = "accesslens-primary-button";
  returnButton.textContent = "Return to required step";
  returnButton.addEventListener("click", () => {
    if (new URL(returnUrl).href === window.location.href && window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign(returnUrl);
  });
  modal.append(badge, title, message, required, returnButton);
  backdrop.append(modal);
  return backdrop;
}

function createCompletionPanel() {
  const panel = createStatusPanel(
    "AccessLens guide complete",
    "You completed every guided step. Your personal values were not saved by AccessLens."
  );
  panel.classList.add("accesslens-completion-panel");
  const finishButton = document.createElement("button");
  finishButton.type = "button";
  finishButton.className = "accesslens-primary-button";
  finishButton.textContent = "Finish AccessLens Guide";
  finishButton.addEventListener("click", () => {
    const rootNode = panel.getRootNode();
    if (rootNode instanceof ShadowRoot) {
      rootNode.host.remove();
    }
  });
  panel.append(finishButton);
  return panel;
}

function showSubmissionBlockedWarning(shadowRoot: ShadowRoot, messageElement?: HTMLElement) {
  const warningText = "Complete and confirm this AccessLens step before continuing.";
  if (messageElement) {
    messageElement.className = "accesslens-message accesslens-message-error";
    messageElement.textContent = warningText;
  }

  let toast = shadowRoot.querySelector<HTMLElement>(".accesslens-submit-warning");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "accesslens-submit-warning";
    toast.setAttribute("role", "alert");
    shadowRoot.append(toast);
  }
  toast.textContent = warningText;
}

async function resolveTemplateForCurrentPage(): Promise<AccessLensTemplate | null> {
  const response = await apiFetch(
    `${backendApiUrl}/templates/resolve?url=${encodeURIComponent(window.location.href)}&heading=${encodeURIComponent(getCurrentPageHeading())}`
  );

  if (response.ok) {
    const data = await response.json() as { template: AccessLensTemplate };
    return data.template;
  }

  const errorData = await response.json().catch(() => null) as {
    error?: string;
    code?: string;
  } | null;
  if (response.status === 404) {
    return null;
  }

  throw new Error(errorData?.error || "AccessLens could not resolve an approved page template.");
}

function createFieldControl(field: AccessLensField, language: Language) {
  const wrapper = document.createElement("label");
  wrapper.className = "accesslens-field";
  wrapper.htmlFor = field.id;

  const labelText = document.createElement("span");
  const fieldLabel = translateFieldLabel(field.label, language);
  labelText.textContent = field.required ? `${fieldLabel} *` : fieldLabel;

  let input: FormControl;

  if (field.type === "select") {
    const select = document.createElement("select");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = language === "si" ? `${fieldLabel} තෝරන්න` : `Select ${fieldLabel}`;
    select.append(placeholder);

    for (const optionLabel of field.options ?? []) {
      const option = document.createElement("option");
      option.value = optionLabel;
      option.textContent = optionLabel;
      select.append(option);
    }

    input = select;
  } else if (field.type === "textarea") {
    input = document.createElement("textarea");
  } else {
    const textInput = document.createElement("input");
    textInput.type = field.type === "password" ? "text" : field.type;
    input = textInput;
  }

  input.id = field.id;
  input.name = field.id;
  input.required = field.required ?? false;
  wrapper.append(labelText, input);

  return { wrapper, input };
}

function getFieldValue(panel: HTMLElement, fieldName: string) {
  const field = panel.querySelector<FormControl>(`[name="${escapeAttributeValue(fieldName)}"]`);
  return field?.value.trim() ?? "";
}

function getOverlayValues(panel: HTMLElement, fields: AccessLensField[]) {
  return fields.reduce<Record<string, string>>((values, field) => {
    values[field.id] = getFieldValue(panel, field.id);
    return values;
  }, {});
}

function validateValues(values: Record<string, string>, fields: AccessLensField[], language: Language) {
  const missingFields = fields
    .filter((field) => field.required && !values[field.id]?.trim())
    .map((field) => translateFieldLabel(field.label, language));

  if (missingFields.length > 0) {
    return `${t(language, "pleaseEnter")}: ${missingFields.join(", ")}.`;
  }

  for (const field of fields) {
    const value = values[field.id]?.trim() ?? "";
    if (!value || !field.validationPattern) {
      continue;
    }

    try {
      if (!new RegExp(field.validationPattern).test(value)) {
        return field.validationMessage
          ?? `${translateFieldLabel(field.label, language)} is not valid.`;
      }
    } catch {
      return `${translateFieldLabel(field.label, language)} has an invalid validation rule.`;
    }
  }

  return "";
}

function validateInstructionValues(
  values: Record<string, string>,
  instruction: AccessLensInstruction | null
) {
  if (!instruction) {
    return "";
  }

  const requiredCount = Number(instruction.completion_rule.required_field_count ?? 0);
  const enteredValues = Object.values(values).filter((value) => value.trim() !== "");
  if (requiredCount > 0 && enteredValues.length < requiredCount) {
    return `Complete all ${requiredCount} required fields before reviewing this step.`;
  }

  const prototypeRule = instruction.completion_rule.prototype_linear_path;
  if (prototypeRule && typeof prototypeRule === "object" && "field_minimum" in prototypeRule) {
    const minimum = Number((prototypeRule as { field_minimum: unknown }).field_minimum);
    const numericValue = Number(enteredValues[0]);
    if (Number.isFinite(minimum) && (!Number.isFinite(numericValue) || numericValue < minimum)) {
      return `Enter ${minimum} or more to follow this prototype workflow.`;
    }
  }

  return "";
}

function setNativeValue(element: FormControl, value: string) {
  if (element instanceof HTMLSelectElement) {
    const option = Array.from(element.options).find(
      (candidate) => candidate.value === value || normalizeText(candidate.textContent) === value
    );
    element.value = option?.value ?? value;
    return;
  }

  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
}

function updateOriginalField(field: AccessLensField, value: string): FillResult {
  let originalField: Element | null = null;
  const lowConfidence = typeof field.confidence === "number" && field.confidence < lowConfidenceThreshold;

  try {
    originalField = document.querySelector(field.selector);
  } catch {
    return {
      label: field.label,
      ok: false,
      lowConfidence,
      message: `${field.label} has an invalid target selector. Please fill it manually.`
    };
  }

  if (!isSafeFillTarget(originalField)) {
    return {
      label: field.label,
      ok: false,
      lowConfidence,
      message: `${field.label} could not be safely filled. Please fill it manually.`
    };
  }

  setNativeValue(originalField, value);
  originalField.dispatchEvent(new Event("input", { bubbles: true }));
  originalField.dispatchEvent(new Event("change", { bubbles: true }));

  return {
    label: field.label,
    ok: true,
    lowConfidence,
    message: lowConfidence
      ? `${field.label} filled successfully. Low confidence mapping. Please verify manually.`
      : `${field.label} filled successfully.`
  };
}

function fillOriginalForm(values: Record<string, string>, fields: AccessLensField[]) {
  return fields.map((field) => updateOriginalField(field, values[field.id] ?? ""));
}

function createMessage(className: string, text: string) {
  const message = document.createElement("p");
  message.className = className;
  message.setAttribute("role", "status");
  message.textContent = text;
  return message;
}

function createStatusPanel(titleText: string, messageText: string, error = false) {
  const panel = document.createElement("section");
  panel.className = "accesslens-panel";
  panel.setAttribute("aria-label", "AccessLens template status");

  const title = document.createElement("h2");
  title.textContent = titleText;
  const message = createMessage(
    error ? "accesslens-message accesslens-message-error" : "accesslens-description",
    messageText
  );
  panel.append(title, message);
  return panel;
}

function createWebsiteRequestCard(language: Language) {
  const card = document.createElement("div");
  card.className = "accesslens-request-card";

  const header = document.createElement("div");
  header.className = "accesslens-request-header";

  const icon = document.createElement("span");
  icon.className = "accesslens-request-icon";
  icon.textContent = "🌐";

  const title = document.createElement("span");
  title.className = "accesslens-request-title";
  title.textContent = t(language, "unsupportedNotice");

  header.append(icon, title);

  const body = document.createElement("div");
  body.className = "accesslens-request-body";

  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.className = "accesslens-request-input";
  noteInput.placeholder = t(language, "requestNotePlaceholder");

  const requestBtn = document.createElement("button");
  requestBtn.type = "button";
  requestBtn.className = "accesslens-request-button";
  requestBtn.textContent = t(language, "requestWebsite");

  const statusMsg = document.createElement("p");
  statusMsg.className = "accesslens-request-status";

  void apiFetch(`${backendApiUrl}/requests/check?url=${encodeURIComponent(window.location.href)}`)
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json() as { requested: boolean; request?: { request_count: number; status: string } };
        if (data.requested && data.request) {
          card.replaceChildren();
          const successBadge = document.createElement("div");
          successBadge.className = "accesslens-request-success";
          const countText = data.request.request_count > 1 ? ` (${data.request.request_count} requests)` : "";
          successBadge.textContent = `✓ Website Requested${countText} • Status: ${data.request.status.replace("_", " ")}`;
          card.append(successBadge);
        }
      }
    })
    .catch(() => {});

  requestBtn.addEventListener("click", async () => {
    requestBtn.disabled = true;
    requestBtn.textContent = t(language, "requestingWebsite");
    statusMsg.textContent = "";

    try {
      const response = await apiFetch(`${backendApiUrl}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {
          url: window.location.href,
          siteName: document.title || window.location.hostname,
          userNote: noteInput.value.trim()
        }
      });

      if (response.ok) {
        const data = await response.json() as { request: { request_count: number } };
        card.replaceChildren();
        const successBadge = document.createElement("div");
        successBadge.className = "accesslens-request-success";
        const countText = data.request.request_count > 1 ? ` (${data.request.request_count} total requests)` : "";
        successBadge.textContent = `${t(language, "websiteRequestedSuccess")}${countText}`;
        card.append(successBadge);
      } else {
        requestBtn.disabled = false;
        requestBtn.textContent = t(language, "requestWebsite");
        statusMsg.textContent = "Could not submit request. Please try again.";
      }
    } catch {
      requestBtn.disabled = false;
      requestBtn.textContent = t(language, "requestWebsite");
      statusMsg.textContent = "Network error. Could not connect to backend.";
    }
  });

  body.append(noteInput, requestBtn);
  card.append(header, body, statusMsg);
  return card;
}


let currentHighlightedElement: HTMLElement | null = null;
let originalOutlineStyle = "";
let originalOutlineOffsetStyle = "";
let originalBoxShadowStyle = "";

function findTargetElement(selector: string, xpath?: string | null) {
  if (selector) {
    try {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) {
        return element;
      }
    } catch {
      // Try the recorded XPath when a selector is stale or invalid.
    }
  }

  if (xpath) {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue instanceof HTMLElement ? result.singleNodeValue : null;
    } catch {
      return null;
    }
  }

  return null;
}

function highlightTargetElement(selector: string, xpath?: string | null) {
  if (currentHighlightedElement) {
    currentHighlightedElement.style.outline = originalOutlineStyle;
    currentHighlightedElement.style.outlineOffset = originalOutlineOffsetStyle;
    currentHighlightedElement.style.boxShadow = originalBoxShadowStyle;
    currentHighlightedElement = null;
  }

  if (!selector) {
    return false;
  }

  const element = findTargetElement(selector, xpath);
  if (element) {
    currentHighlightedElement = element;
    originalOutlineStyle = element.style.outline;
    originalOutlineOffsetStyle = element.style.outlineOffset;
    originalBoxShadowStyle = element.style.boxShadow;
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    element.style.outline = "4px solid #2563eb";
    element.style.outlineOffset = "3px";
    element.style.boxShadow = "0 0 0 7px rgba(37, 99, 235, 0.2), 0 0 22px rgba(37, 99, 235, 0.75)";
    return true;
  }

  return false;
}

function createReviewDetails(values: Record<string, string>, fields: AccessLensField[], language: Language) {
  const wrapper = document.createElement("div");
  wrapper.className = "accesslens-review";

  const heading = document.createElement("h3");
  heading.textContent = t(language, "reviewDetailsHeading");
  wrapper.append(heading);

  for (const field of fields) {
    const row = document.createElement("div");
    row.className = "accesslens-review-row";

    const label = document.createElement("strong");
    label.textContent = translateFieldLabel(field.label, language);

    const value = document.createElement("span");
    value.textContent = values[field.id] || t(language, "notEntered");

    row.append(label, value);
    wrapper.append(row);
  }

  return wrapper;
}

function createResultList(results: FillResult[]) {
  const list = document.createElement("ul");
  list.className = "accesslens-results";

  for (const result of results) {
    const item = document.createElement("li");
    item.className = result.ok ? "accesslens-result-success" : "accesslens-result-error";
    item.textContent = result.message;
    list.append(item);
  }

  return list;
}

function comparablePageUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.searchParams.delete("_accesslens_recording");
    return url.toString();
  } catch {
    return value;
  }
}

function isStepOnCurrentPage(step: RecordedGuideStep) {
  return comparablePageUrl(step.page_url) === comparablePageUrl(window.location.href);
}

function wasPageReloaded() {
  const navigationEntry = performance.getEntriesByType("navigation")[0];
  return typeof PerformanceNavigationTiming !== "undefined"
    && navigationEntry instanceof PerformanceNavigationTiming
    && navigationEntry.type === "reload";
}

function createRecordedGuidePanel(
  categories: RecordedGuideCategory[],
  restoredProgress: RecordedGuideProgress | null
) {
  const panel = document.createElement("section");
  panel.className = "accesslens-panel accesslens-recorded-guide-panel";
  panel.setAttribute("aria-label", "AccessLens website guide");

  const titlebar = document.createElement("div");
  titlebar.className = "accesslens-titlebar";
  const brand = document.createElement("div");
  brand.className = "accesslens-brand-group";
  const logo = document.createElement("span");
  logo.className = "accesslens-logo-mark";
  logo.textContent = "AL";
  const heading = document.createElement("h2");
  heading.textContent = "AccessLens Guide";
  brand.append(logo, heading);
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "accesslens-icon-button";
  closeButton.setAttribute("aria-label", "Close AccessLens guide");
  closeButton.textContent = "×";
  titlebar.append(brand, closeButton);

  const introduction = document.createElement("p");
  introduction.className = "accesslens-description";
  introduction.textContent = "Choose what you want to do on this website.";

  const categoryLabel = document.createElement("label");
  categoryLabel.className = "accesslens-guide-category-label";
  categoryLabel.textContent = "Category";
  const categorySelect = document.createElement("select");
  categorySelect.className = "accesslens-guide-category-select";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a category";
  categorySelect.append(placeholder);
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = `${category.category} (${category.step_count} step${category.step_count === 1 ? "" : "s"})`;
    categorySelect.append(option);
  });
  categoryLabel.append(categorySelect);

  const guideContent = document.createElement("div");
  guideContent.className = "accesslens-recorded-guide-content";
  guideContent.hidden = true;
  const status = document.createElement("p");
  status.className = "accesslens-guide-target-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  panel.append(titlebar, introduction, categoryLabel, guideContent, status);

  let activeGuide: RecordedGuide | null = null;
  let currentStepIndex = 0;
  let completedStepIds = new Set<string>();
  let replayStepId: string | null = null;
  let replayFromStepIndex: number | null = null;
  let renderVersion = 0;

  const getCurrentGuideProgress = (): RecordedGuideProgress | null => activeGuide
    ? {
        sessionId: activeGuide.id,
        stepIndex: currentStepIndex,
        completedStepIds: [...completedStepIds],
        replayStepId: replayStepId ?? undefined,
        replayFromStepIndex: replayFromStepIndex ?? undefined
      }
    : null;

  const persistCurrentGuideProgress = () => {
    const progress = getCurrentGuideProgress();
    return progress ? saveRecordedGuideProgress(progress) : Promise.resolve();
  };

  const showCompletedStepMessage = () => {
    status.className = "accesslens-guide-target-status accesslens-guide-step-completed";
    status.textContent = "This step is already completed. Select Next to continue.";
  };

  const hasControlCompletionState = (step: RecordedGuideStep, target: HTMLElement) => {
    if (target.getAttribute("aria-pressed") === "true" || target.getAttribute("aria-checked") === "true") {
      return true;
    }

    if (target instanceof HTMLInputElement) {
      if (target.type === "checkbox" || target.type === "radio") {
        return target.checked;
      }
      return step.action_type === "input" && target.value.trim().length > 0;
    }

    if (target instanceof HTMLTextAreaElement) {
      return step.action_type === "input" && target.value.trim().length > 0;
    }

    if (target instanceof HTMLSelectElement) {
      return step.action_type === "select" && target.value.trim().length > 0;
    }

    return step.action_type === "click"
      && (target.matches(":disabled") || target.getAttribute("data-completed") === "true");
  };

  const hasLaterVisibleStep = (stepIndex: number) => {
    if (!activeGuide) return false;
    return activeGuide.steps.slice(stepIndex + 1).some((laterStep) => {
      if (!isStepOnCurrentPage(laterStep)) return false;
      const laterTarget = findTargetElement(laterStep.selector, laterStep.xpath);
      if (!laterTarget) return false;
      const style = window.getComputedStyle(laterTarget);
      return style.display !== "none" && style.visibility !== "hidden";
    });
  };

  const resetGuide = async () => {
    renderVersion++;
    activeGuide = null;
    currentStepIndex = 0;
    completedStepIds = new Set<string>();
    replayStepId = null;
    replayFromStepIndex = null;
    guideContent.hidden = true;
    guideContent.replaceChildren();
    status.textContent = "";
    highlightTargetElement("");
    await clearRecordedGuideProgress();
  };

  const openStepPage = async (step: RecordedGuideStep) => {
    const destination = new URL(step.page_url);
    if (destination.protocol === "http:" || destination.protocol === "https:") {
      const progress = getCurrentGuideProgress();
      if (progress) {
        await saveRecordedGuideProgress({ ...progress, navigationPending: true });
      }
      window.location.assign(destination.href);
    }
  };

  const renderStep = () => {
    if (!activeGuide || activeGuide.steps.length === 0) {
      return;
    }

    renderVersion++;
    const version = renderVersion;
    currentStepIndex = clamp(currentStepIndex, 0, activeGuide.steps.length - 1);
    const step = activeGuide.steps[currentStepIndex];
    const totalSteps = activeGuide.steps.length;
    guideContent.hidden = false;
    guideContent.replaceChildren();
    highlightTargetElement("");

    const meta = document.createElement("div");
    meta.className = "accesslens-recorded-guide-meta";
    const stepNumber = document.createElement("strong");
    stepNumber.textContent = `Step ${currentStepIndex + 1} of ${totalSteps}`;
    const action = document.createElement("span");
    action.textContent = step.action_type === "input" ? "Enter information" : step.action_type;
    meta.append(stepNumber, action);

    const title = document.createElement("h3");
    title.textContent = step.instruction_title;
    const instruction = document.createElement("p");
    instruction.className = "accesslens-recorded-guide-instruction";
    instruction.textContent = step.instruction_text;
    const progress = document.createElement("div");
    progress.className = "accesslens-guide-progress";
    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-valuemin", "1");
    progress.setAttribute("aria-valuemax", String(totalSteps));
    progress.setAttribute("aria-valuenow", String(currentStepIndex + 1));
    const progressFill = document.createElement("span");
    progressFill.style.width = `${((currentStepIndex + 1) / totalSteps) * 100}%`;
    progress.append(progressFill);

    const navigation = document.createElement("div");
    navigation.className = "accesslens-recorded-guide-navigation";
    const previousButton = document.createElement("button");
    previousButton.type = "button";
    previousButton.className = "accesslens-secondary-button";
    previousButton.textContent = "Back";
    previousButton.disabled = currentStepIndex === 0;
    previousButton.addEventListener("click", async () => {
      if (!activeGuide || currentStepIndex === 0) return;
      currentStepIndex--;
      replayStepId = activeGuide.steps[currentStepIndex].id;
      replayFromStepIndex = replayFromStepIndex === null
        ? currentStepIndex
        : Math.min(replayFromStepIndex, currentStepIndex);
      activeGuide.steps.slice(currentStepIndex).forEach((replayStep) => {
        completedStepIds.delete(replayStep.id);
      });
      await persistCurrentGuideProgress();
      const previousStep = activeGuide.steps[currentStepIndex];
      const previousTarget = findTargetElement(previousStep.selector, previousStep.xpath);
      if (!isStepOnCurrentPage(previousStep) || !previousTarget) {
        await openStepPage(previousStep);
        return;
      }
      renderStep();
    });

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.className = "accesslens-primary-button";
    const isLastStep = currentStepIndex === totalSteps - 1;
    nextButton.textContent = isLastStep ? "Finish" : "Next";
    nextButton.addEventListener("click", async () => {
      if (!activeGuide) return;
      if (isLastStep) {
        const completedCategory = activeGuide.category;
        await resetGuide();
        categorySelect.value = "";
        status.className = "accesslens-guide-target-status accesslens-message-success";
        status.textContent = `${completedCategory} guide completed. You can choose another category.`;
        return;
      }

      replayStepId = null;
      currentStepIndex++;
      await persistCurrentGuideProgress();
      const nextStep = activeGuide.steps[currentStepIndex];
      if (!isStepOnCurrentPage(nextStep)) {
        await openStepPage(nextStep);
        return;
      }
      renderStep();
    });
    navigation.append(previousButton, nextButton);

    if (!isStepOnCurrentPage(step)) {
      const openPageButton = document.createElement("button");
      openPageButton.type = "button";
      openPageButton.className = "accesslens-primary-button accesslens-open-step-page";
      openPageButton.textContent = "Open this step's page";
      openPageButton.addEventListener("click", () => void openStepPage(step));
      guideContent.append(meta, title, instruction, progress, openPageButton, navigation);
      status.className = "accesslens-guide-target-status";
      status.textContent = "This step is on another page. Open it to continue with highlighting.";
      return;
    }

    guideContent.append(meta, title, instruction, progress, navigation);
    status.className = "accesslens-guide-target-status";

    const tryHighlight = (attempt: number) => {
      if (version !== renderVersion) return;
      const targetElement = findTargetElement(step.selector, step.xpath);
      const isReplayingStep = replayStepId === step.id
        || (replayFromStepIndex !== null && currentStepIndex >= replayFromStepIndex);
      if (
        !isReplayingStep
        && (
          completedStepIds.has(step.id)
          || (targetElement && hasControlCompletionState(step, targetElement))
        )
      ) {
        completedStepIds.add(step.id);
        void persistCurrentGuideProgress();
        highlightTargetElement("");
        showCompletedStepMessage();
        return;
      }

      if (targetElement && highlightTargetElement(step.selector, step.xpath)) {
        status.className = "accesslens-guide-target-status accesslens-message-success";
        status.textContent = "The element for this step is highlighted on the page.";
        return;
      }
      if (attempt < 4) {
        window.setTimeout(() => tryHighlight(attempt + 1), 500 * (attempt + 1));
      } else if (!isReplayingStep && hasLaterVisibleStep(currentStepIndex)) {
        completedStepIds.add(step.id);
        void persistCurrentGuideProgress();
        showCompletedStepMessage();
      } else {
        status.className = "accesslens-guide-target-status";
        status.textContent = "AccessLens cannot find this step's element on the current page.";
      }
    };
    tryHighlight(0);
  };

  const loadGuide = async (
    sessionId: string,
    stepIndex = 0,
    savedCompletedStepIds: string[] = [],
    savedReplayStepId: string | null = null,
    savedReplayFromStepIndex: number | null = null
  ) => {
    categorySelect.disabled = true;
    guideContent.hidden = false;
    guideContent.textContent = "Loading instructions…";
    status.textContent = "";
    try {
      activeGuide = await fetchRecordedGuide(sessionId);
      currentStepIndex = clamp(stepIndex, 0, Math.max(0, activeGuide.steps.length - 1));
      completedStepIds = new Set(savedCompletedStepIds);
      replayStepId = savedReplayStepId;
      replayFromStepIndex = savedReplayFromStepIndex;
      await persistCurrentGuideProgress();
      renderStep();
    } catch (error) {
      activeGuide = null;
      guideContent.replaceChildren();
      guideContent.hidden = true;
      status.className = "accesslens-guide-target-status accesslens-message-error";
      status.textContent = error instanceof Error ? error.message : "The selected guide could not be loaded.";
      await clearRecordedGuideProgress();
    } finally {
      categorySelect.disabled = false;
    }
  };

  categorySelect.addEventListener("change", () => {
    const sessionId = categorySelect.value;
    highlightTargetElement("");
    if (!sessionId) {
      void resetGuide();
      return;
    }
    completedStepIds = new Set<string>();
    replayStepId = null;
    replayFromStepIndex = null;
    void loadGuide(sessionId);
  });

  const handleRecordedStepInteraction = (event: Event) => {
    if (!activeGuide || guideContent.hidden) return;
    const step = activeGuide.steps[currentStepIndex];
    if (!step) return;

    const expectedEvent = step.action_type === "click" ? "click" : "change";
    if (event.type !== expectedEvent || !(event.target instanceof Node)) return;

    const target = findTargetElement(step.selector, step.xpath);
    if (!target || (event.target !== target && !target.contains(event.target))) return;

    completedStepIds.add(step.id);
    void persistCurrentGuideProgress();
    showCompletedStepMessage();
  };

  document.addEventListener("click", handleRecordedStepInteraction, true);
  document.addEventListener("change", handleRecordedStepInteraction, true);

  closeButton.addEventListener("click", () => {
    renderVersion++;
    highlightTargetElement("");
    void clearRecordedGuideProgress();
    document.removeEventListener("click", handleRecordedStepInteraction, true);
    document.removeEventListener("change", handleRecordedStepInteraction, true);
    panel.getRootNode() instanceof ShadowRoot
      ? (panel.getRootNode() as ShadowRoot).host.remove()
      : panel.remove();
  });

  if (restoredProgress && categories.some((category) => category.id === restoredProgress.sessionId)) {
    categorySelect.value = restoredProgress.sessionId;
    void loadGuide(
      restoredProgress.sessionId,
      restoredProgress.stepIndex,
      restoredProgress.completedStepIds ?? [],
      restoredProgress.replayStepId ?? null,
      restoredProgress.replayFromStepIndex ?? null
    );
  }

  return panel;
}

async function injectOverlay() {
  if (document.getElementById(overlayId) || !document.body) {
    return;
  }

  const root = document.createElement("div");
  root.id = overlayId;
  const shadowRoot = root.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = stylesText;
  shadowRoot.append(style);
  document.body.append(root);

  const loadingPanel = createStatusPanel("AccessLens", "Checking this page and preparing its form...");
  shadowRoot.append(loadingPanel);

  try {
    const [recordedCategories, storedRecordedProgress] = await Promise.all([
      fetchRecordedGuideCategories(),
      getRecordedGuideProgress()
    ]);
    let recordedProgress = storedRecordedProgress;

    if (recordedProgress?.navigationPending) {
      recordedProgress = { ...recordedProgress, navigationPending: undefined };
      await saveRecordedGuideProgress(recordedProgress);
    } else if (recordedProgress && wasPageReloaded()) {
      await clearRecordedGuideProgress();
      recordedProgress = null;
    }

    if (recordedCategories.length > 0) {
      loadingPanel.remove();
      shadowRoot.append(createRecordedGuidePanel(recordedCategories, recordedProgress));
      return;
    }
    if (recordedProgress) {
      await clearRecordedGuideProgress();
    }
  } catch {
    // Preserve the approved-template flow when the optional recorded-guide
    // lookup is temporarily unavailable.
  }

  let instruction: AccessLensInstruction | null = null;
  let workflowAccess: WorkflowPageAccess | null = null;
  let workflowProgress: WorkflowProgress | null = null;
  let workflowMessage: HTMLElement | undefined;

  try {
    instruction = await resolveInstructionForCurrentPage();
    const existingProgress = await getWorkflowProgress();

    if (
      !instruction
      && existingProgress
      && existingProgress.completedStepOrder > 0
      && existingProgress.expectedPageKeys.length === 0
    ) {
      await clearWorkflowProgress();
      loadingPanel.remove();
      shadowRoot.append(createCompletionPanel());
      return;
    }

    if (instruction) {
      workflowAccess = await evaluateWorkflowPage(instruction);
      if (workflowAccess.outOfOrder) {
        loadingPanel.remove();
        const warning = createOutOfOrderWarning(
          instruction,
          workflowAccess.requiredStepText,
          workflowAccess.returnUrl
        );
        attachBlockingSubmitGuard(() => {
          const required = warning.querySelector<HTMLElement>(".accesslens-required-step");
          required?.focus();
        });
        shadowRoot.append(warning);
        return;
      }

      workflowProgress = workflowAccess.progress;
      if (instruction.completion_rule.completes_workflow !== true) {
        document.addEventListener("submit", (event) => {
          if (event.composedPath().includes(root) || !isManualContinueForm(event.target)) {
            return;
          }

          if (!workflowProgress?.currentStepReady) {
            event.preventDefault();
            event.stopImmediatePropagation();
            showSubmissionBlockedWarning(shadowRoot, workflowMessage);
            return;
          }

          workflowProgress = {
            workflowKey: instruction!.workflow_key,
            completedStepOrder: instruction!.step_order,
            expectedPageKeys: [...instruction!.allowed_next_page_keys],
            currentPageKey: instruction!.page_key,
            lastValidUrl: window.location.href,
            currentStepReady: false
          };
          void saveWorkflowProgress(workflowProgress);
        }, true);
      }
      shadowRoot.append(createInstructionPopup(instruction));
    }
  } catch (error) {
    loadingPanel.remove();
    shadowRoot.append(createStatusPanel(
      "AccessLens guidance unavailable",
      error instanceof Error ? error.message : "AccessLens could not load workflow guidance.",
      true
    ));
    return;
  }

  let template: AccessLensTemplate | null;

  try {
    template = await resolveTemplateForCurrentPage();
  } catch (error) {
    loadingPanel.remove();
    const errorPanel = createStatusPanel(
      "AccessLens unavailable",
      error instanceof Error ? error.message : "AccessLens template loading failed.",
      true
    );
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "accesslens-secondary-button";
    closeButton.style.marginTop = "10px";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", () => root.remove());
    errorPanel.append(closeButton);
    shadowRoot.append(errorPanel);
    return;
  }

  if (!template) {
    loadingPanel.remove();
    const unsupportedPanel = createStatusPanel(
      "Website support needed",
      "No approved AccessLens template is available for this website yet."
    );
    const requestCard = createWebsiteRequestCard("en");
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "accesslens-secondary-button";
    closeButton.style.marginTop = "10px";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", () => root.remove());
    unsupportedPanel.append(requestCard, closeButton);
    shadowRoot.append(unsupportedPanel);
    return;
  }

  loadingPanel.remove();
  const fields = template.fields.filter((field) => field.type !== "password");

  if (fields.length === 0 && instruction?.completion_rule.completes_workflow === true) {
    await clearWorkflowProgress();
    shadowRoot.append(createCompletionPanel());
    return;
  }

  if (fields.length === 0) {
    shadowRoot.append(createStatusPanel(
      "AccessLens",
      "This approved template does not contain any supported form fields.",
      true
    ));
    return;
  }

  const draftKey = getDraftStorageKey(template.templateKey);
  const savedDraft = await getLocalDraft(draftKey);

  let viewMode: ViewMode = "wizard";
  let language: Language = "en";
  let currentStepIndex = 0;
  let isDarkMode = false;
  let isCollapsed = false;
  const formValuesState: Record<string, string> = savedDraft ? { ...savedDraft } : {};

  const persistDraftState = () => {
    void saveLocalDraft(draftKey, formValuesState);
  };

  const panel = document.createElement("section");
  panel.className = "accesslens-panel";
  panel.setAttribute("aria-label", "AccessLens form overlay");

  const titlebar = document.createElement("div");
  titlebar.className = "accesslens-titlebar";

  const brandGroup = document.createElement("div");
  brandGroup.className = "accesslens-brand-group";

  const logoMark = document.createElement("div");
  logoMark.className = "accesslens-logo-mark";
  logoMark.textContent = "AL";

  const title = document.createElement("h2");
  title.textContent = "AccessLens";

  const statusBadge = document.createElement("span");
  statusBadge.className = "accesslens-badge accesslens-badge-approved";
  statusBadge.textContent = "Approved";

  brandGroup.append(logoMark, title, statusBadge);

  const headerControls = document.createElement("div");
  headerControls.className = "accesslens-header-controls";

  const dragGrip = document.createElement("span");
  dragGrip.className = "accesslens-drag-grip";
  dragGrip.title = "Drag to reposition";
  dragGrip.textContent = "⠿";

  const themeToggleBtn = document.createElement("button");
  themeToggleBtn.type = "button";
  themeToggleBtn.className = "accesslens-icon-button";
  themeToggleBtn.title = "Toggle Theme";
  themeToggleBtn.setAttribute("aria-label", "Toggle Dark/Light Mode");
  themeToggleBtn.textContent = "🌙";

  const collapseBtn = document.createElement("button");
  collapseBtn.type = "button";
  collapseBtn.className = "accesslens-icon-button";
  collapseBtn.title = "Collapse Panel";
  collapseBtn.setAttribute("aria-label", "Collapse Panel");
  collapseBtn.textContent = "−";

  headerControls.append(dragGrip, themeToggleBtn, collapseBtn);
  titlebar.append(brandGroup, headerControls);

  const panelBody = document.createElement("div");
  panelBody.className = "accesslens-panel-body";

  const languageSwitcher = document.createElement("div");
  languageSwitcher.className = "accesslens-language-switcher";
  languageSwitcher.setAttribute("aria-label", "Language selector");

  const englishButton = document.createElement("button");
  englishButton.type = "button";
  englishButton.className = "accesslens-language-btn active";
  englishButton.textContent = "English";

  const sinhalaButton = document.createElement("button");
  sinhalaButton.type = "button";
  sinhalaButton.className = "accesslens-language-btn";
  sinhalaButton.textContent = "සිංහල";

  languageSwitcher.append(englishButton, sinhalaButton);

  const description = document.createElement("div");
  description.className = "accesslens-description";
  description.textContent = template.templateName;

  const modeSwitcher = document.createElement("div");
  modeSwitcher.className = "accesslens-mode-switcher";

  const wizardModeBtn = document.createElement("button");
  wizardModeBtn.type = "button";
  wizardModeBtn.className = `accesslens-mode-btn ${(viewMode as ViewMode) === "wizard" ? "active" : ""}`;
  wizardModeBtn.textContent = "Step-by-Step Wizard";

  const allFieldsModeBtn = document.createElement("button");
  allFieldsModeBtn.type = "button";
  allFieldsModeBtn.className = `accesslens-mode-btn ${(viewMode as ViewMode) === "all" ? "active" : ""}`;
  allFieldsModeBtn.textContent = "All Fields View";

  modeSwitcher.append(wizardModeBtn, allFieldsModeBtn);

  const message = document.createElement("p");
  message.className = "accesslens-message";
  message.setAttribute("role", "status");
  workflowMessage = message;

  const form = document.createElement("form");
  form.className = "accesslens-form";

  const formContentContainer = document.createElement("div");
  formContentContainer.className = "accesslens-form-content";

  const reviewContainer = document.createElement("div");
  reviewContainer.className = "accesslens-review-container";
  reviewContainer.hidden = true;

  const resultContainer = document.createElement("div");
  resultContainer.className = "accesslens-result-container";

  const actions = document.createElement("div");
  actions.className = "accesslens-actions";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "accesslens-secondary-button";

  const separateWindowButton = document.createElement("button");
  separateWindowButton.type = "button";
  separateWindowButton.className = "accesslens-secondary-button accesslens-window-button";

  form.append(formContentContainer, actions, reviewContainer, resultContainer);
  panelBody.append(languageSwitcher, description, modeSwitcher, form, message);
  panel.append(titlebar, panelBody);
  shadowRoot.append(panel);

  const setCurrentStepReady = (ready: boolean) => {
    if (!instruction || !workflowProgress) {
      return;
    }

    workflowProgress = {
      ...workflowProgress,
      currentPageKey: instruction.page_key,
      currentStepReady: ready
    };
    void saveWorkflowProgress(workflowProgress);
  };

  themeToggleBtn.addEventListener("click", () => {
    isDarkMode = !isDarkMode;
    panel.classList.toggle("accesslens-dark", isDarkMode);
    themeToggleBtn.textContent = isDarkMode ? "☀️" : "🌙";
  });

  collapseBtn.addEventListener("click", () => {
    isCollapsed = !isCollapsed;
    panelBody.hidden = isCollapsed;
    panel.classList.toggle("accesslens-panel-collapsed", isCollapsed);
    collapseBtn.textContent = isCollapsed ? "+" : "−";
    collapseBtn.title = isCollapsed ? "Expand Panel" : "Collapse Panel";
  });

  const renderStaticText = () => {
    panel.lang = language === "si" ? "si" : "en";
    englishButton.className = `accesslens-language-btn ${language === "en" ? "active" : ""}`;
    sinhalaButton.className = `accesslens-language-btn ${language === "si" ? "active" : ""}`;
    wizardModeBtn.textContent = t(language, "stepByStepWizard");
    allFieldsModeBtn.textContent = t(language, "allFieldsView");
    closeButton.textContent = t(language, "close");
    separateWindowButton.textContent = t(language, "separateWindow");
  };

  const movePanelTo = (left: number, top: number) => {
    const panelRect = panel.getBoundingClientRect();
    const maxLeft = Math.max(16, window.innerWidth - panelRect.width - 16);
    const maxTop = Math.max(16, window.innerHeight - panelRect.height - 16);
    panel.style.left = `${clamp(left, 16, maxLeft)}px`;
    panel.style.top = `${clamp(top, 16, maxTop)}px`;
    panel.style.right = "auto";
    panel.classList.add("accesslens-detached");
  };

  titlebar.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) {
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    const offsetX = event.clientX - panelRect.left;
    const offsetY = event.clientY - panelRect.top;
    panel.classList.add("accesslens-dragging");
    titlebar.setPointerCapture(event.pointerId);
    movePanelTo(panelRect.left, panelRect.top);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      movePanelTo(moveEvent.clientX - offsetX, moveEvent.clientY - offsetY);
    };

    const handlePointerUp = () => {
      panel.classList.remove("accesslens-dragging");
      titlebar.removeEventListener("pointermove", handlePointerMove);
      titlebar.removeEventListener("pointerup", handlePointerUp);
      titlebar.removeEventListener("pointercancel", handlePointerUp);
    };

    titlebar.addEventListener("pointermove", handlePointerMove);
    titlebar.addEventListener("pointerup", handlePointerUp);
    titlebar.addEventListener("pointercancel", handlePointerUp);
  });

  const syncStateFromDom = () => {
    fields.forEach((field) => {
      const value = getFieldValue(panel, field.id);
      if (value !== "") {
        formValuesState[field.id] = value;
      }
    });
    persistDraftState();
  };

  const syncStateToDom = () => {
    fields.forEach((field) => {
      const input = panel.querySelector<FormControl>(`[name="${escapeAttributeValue(field.id)}"]`);
      if (input && formValuesState[field.id] !== undefined) {
        input.value = formValuesState[field.id];
      }
    });
  };

  const handleReviewFlow = () => {
    syncStateFromDom();
    const validationError = validateValues(formValuesState, fields, language)
      || validateInstructionValues(formValuesState, instruction);
    message.className = "accesslens-message";
    resultContainer.replaceChildren();

    if (validationError) {
      message.classList.add("accesslens-message-error");
      message.textContent = validationError;
      return;
    }

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "accesslens-primary-button";
    confirmButton.textContent = t(language, "confirmAndFill");

    confirmButton.addEventListener("click", () => {
      syncStateFromDom();
      const latestValidationError = validateValues(formValuesState, fields, language)
        || validateInstructionValues(formValuesState, instruction);
      message.className = "accesslens-message";
      resultContainer.replaceChildren();

      if (latestValidationError) {
        message.classList.add("accesslens-message-error");
        message.textContent = latestValidationError;
        return;
      }

      const results = fillOriginalForm(formValuesState, fields);
      const hasErrors = results.some((result) => !result.ok);
      resultContainer.append(createResultList(results));
      message.classList.add(hasErrors ? "accesslens-message-error" : "accesslens-message-success");
      message.textContent = hasErrors ? t(language, "fillWarning") : t(language, "fillSuccess");
      setCurrentStepReady(!hasErrors);
      if (!hasErrors) {
        void clearLocalDraft(draftKey);
      }
    });

    reviewContainer.replaceChildren(createReviewDetails(formValuesState, fields, language), confirmButton);
    reviewContainer.hidden = false;
    message.textContent = t(language, "reviewMessage");
  };

  const renderFormContent = () => {
    renderStaticText();
    reviewContainer.hidden = true;
    reviewContainer.replaceChildren();
    resultContainer.replaceChildren();
    message.textContent = "";

    wizardModeBtn.className = `accesslens-mode-btn ${(viewMode as ViewMode) === "wizard" ? "active" : ""}`;
    allFieldsModeBtn.className = `accesslens-mode-btn ${(viewMode as ViewMode) === "all" ? "active" : ""}`;

    formContentContainer.replaceChildren();
    actions.replaceChildren();

    if ((viewMode as ViewMode) === "all") {
      highlightTargetElement("");

      fields.forEach((field) => {
        const { wrapper, input } = createFieldControl(field, language);
        if (formValuesState[field.id]) {
          input.value = formValuesState[field.id];
        }
        input.addEventListener("input", (e) => {
          formValuesState[field.id] = (e.target as FormControl).value.trim();
          setCurrentStepReady(false);
          persistDraftState();
        });
        formContentContainer.append(wrapper);
      });

      const reviewButton = document.createElement("button");
      reviewButton.type = "button";
      reviewButton.className = "accesslens-primary-button";
      reviewButton.textContent = t(language, "reviewDetails");
      reviewButton.addEventListener("click", handleReviewFlow);

      actions.append(reviewButton, separateWindowButton, closeButton);
    } else {
      const currentField = fields[currentStepIndex];

      if (currentField) {
        highlightTargetElement(currentField.selector);
      }

      const wizardContainer = document.createElement("div");
      wizardContainer.className = "accesslens-wizard-container";

      const header = document.createElement("div");
      header.className = "accesslens-wizard-header";

      const meta = document.createElement("div");
      meta.className = "accesslens-wizard-meta";
      const stepText = document.createElement("span");
      stepText.textContent = language === "si"
        ? `පියවර ${currentStepIndex + 1}/${fields.length}`
        : `Step ${currentStepIndex + 1} of ${fields.length}`;
      const percentText = document.createElement("span");
      const progressPercent = Math.round(((currentStepIndex + 1) / fields.length) * 100);
      percentText.textContent = `${progressPercent}% ${t(language, "completed")}`;
      meta.append(stepText, percentText);

      const progressBar = document.createElement("div");
      progressBar.className = "accesslens-progress-bar";
      const progressFill = document.createElement("div");
      progressFill.className = "accesslens-progress-fill";
      progressFill.style.width = `${progressPercent}%`;
      progressBar.append(progressFill);

      header.append(meta, progressBar);

      const dotsContainer = document.createElement("div");
      dotsContainer.className = "accesslens-step-dots";
      fields.forEach((_, idx) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = `accesslens-dot ${idx === currentStepIndex ? "active" : ""} ${
          formValuesState[fields[idx].id] ? "completed" : ""
        }`;
        dot.title = language === "si"
          ? `පියවර ${idx + 1}: ${translateFieldLabel(fields[idx].label, language)}`
          : `Go to Step ${idx + 1}: ${fields[idx].label}`;
        dot.addEventListener("click", () => {
          syncStateFromDom();
          currentStepIndex = idx;
          renderFormContent();
        });
        dotsContainer.append(dot);
      });

      const card = document.createElement("div");
      card.className = "accesslens-wizard-card";

      const { wrapper, input } = createFieldControl(currentField, language);
      if (formValuesState[currentField.id]) {
        input.value = formValuesState[currentField.id];
      }
      input.addEventListener("input", (e) => {
        formValuesState[currentField.id] = (e.target as FormControl).value.trim();
        setCurrentStepReady(false);
        persistDraftState();
      });

      const hint = document.createElement("p");
      hint.className = "accesslens-wizard-hint";
      hint.textContent = t(language, "hint");

      card.append(wrapper, hint);

      const nav = document.createElement("div");
      nav.className = "accesslens-wizard-nav";

      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "accesslens-secondary-button";
      prevBtn.textContent = t(language, "back");
      prevBtn.disabled = currentStepIndex === 0;
      prevBtn.addEventListener("click", () => {
        syncStateFromDom();
        if (currentStepIndex > 0) {
          currentStepIndex--;
          renderFormContent();
        }
      });

      const isLastStep = currentStepIndex === fields.length - 1;
      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "accesslens-primary-button";
      nextBtn.textContent = isLastStep ? t(language, "reviewDetails") : t(language, "next");

      nextBtn.addEventListener("click", () => {
        syncStateFromDom();
        if (isLastStep) {
          handleReviewFlow();
        } else {
          currentStepIndex++;
          renderFormContent();
        }
      });

      nav.append(prevBtn, nextBtn);
      wizardContainer.append(header, dotsContainer, card, nav);
      formContentContainer.append(wizardContainer);
      actions.append(separateWindowButton, closeButton);
    }
  };

  wizardModeBtn.addEventListener("click", () => {
    syncStateFromDom();
    viewMode = "wizard";
    renderFormContent();
  });

  allFieldsModeBtn.addEventListener("click", () => {
    syncStateFromDom();
    viewMode = "all";
    renderFormContent();
  });

  englishButton.addEventListener("click", () => {
    syncStateFromDom();
    language = "en";
    renderFormContent();
  });

  sinhalaButton.addEventListener("click", () => {
    syncStateFromDom();
    language = "si";
    renderFormContent();
  });

  separateWindowButton.addEventListener("click", () => {
    syncStateFromDom();
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;

    if (!runtime || typeof runtime.sendMessage !== "function") {
      message.className = "accesslens-message accesslens-message-error";
      message.textContent = t(language, "separateWindowError");
      return;
    }

    runtime.sendMessage(
      {
        type: "OPEN_ACCESSLENS_WINDOW",
        session: {
          templateName: template.templateName,
          fields,
          values: formValuesState,
          language
        }
      },
      (response) => {
        if (runtime.lastError || !response?.ok) {
          message.className = "accesslens-message accesslens-message-error";
          message.textContent = response?.error || runtime.lastError?.message || t(language, "separateWindowError");
        }
      }
    );
  });

  closeButton.addEventListener("click", () => {
    highlightTargetElement("");
    root.remove();
  });

  chrome.runtime?.onMessage?.addListener((incomingMessage, _sender, sendResponse) => {
    if (incomingMessage.type !== "ACCESSLENS_FILL_VALUES" || !incomingMessage.values) {
      return;
    }

    const results = fillOriginalForm(incomingMessage.values, fields);
    const hasErrors = results.some((result) => !result.ok);
    resultContainer.replaceChildren(createResultList(results));
    message.className = `accesslens-message ${
      hasErrors ? "accesslens-message-error" : "accesslens-message-success"
    }`;
    message.textContent = hasErrors ? t(language, "fillWarning") : t(language, "fillSuccess");
    setCurrentStepReady(!hasErrors);
    sendResponse({ ok: !hasErrors, results });
  });

  renderFormContent();
}

void injectOverlay();
initOriginalPageDraftHandler();

