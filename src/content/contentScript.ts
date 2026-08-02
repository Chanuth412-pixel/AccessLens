import stylesText from "./contentStyles.css?inline";
import type { AccessLensField, AccessLensTemplate } from "../types/accessLensTemplate";
import type { AccessLensInstruction, WorkflowProgress } from "../types/instruction";

const overlayId = "accesslens-overlay-root";
const backendApiUrl = "http://localhost:4000/api";
const lowConfidenceThreshold = 0.7;

type TemplateSource = "approved" | "ai" | "database_draft";
type ViewMode = "all" | "wizard";
type Language = "en" | "si";

type ResolvedTemplate = {
  template: AccessLensTemplate;
  source: TemplateSource;
  saved: boolean;
};

type DomElementSnapshot = {
  tag: "input" | "select" | "textarea";
  selector: string;
  selectorCandidates: string[];
  label: string;
  id?: string;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
  inputType: string;
  required: boolean;
  options: string[];
  formContext: string;
};

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

function escapeCssIdentifier(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
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
    temporaryAiTemplate: "Temporary AI template",
    temporaryAiTemplateNotice: "Review mappings before filling.",
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
    temporaryAiTemplate: "තාවකාලික AI ආකෘතිය",
    temporaryAiTemplateNotice: "පිරවීමට පෙර ගැළපීම් පරීක්ෂා කරන්න.",
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

function isUniqueSelector(selector: string) {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function addUniqueSelector(selectors: string[], selector: string) {
  if (selector && isUniqueSelector(selector) && !selectors.includes(selector)) {
    selectors.push(selector);
  }
}

function createSelectorCandidates(element: FormControl) {
  const tag = element.tagName.toLowerCase();
  const selectors: string[] = [];

  if (element.id) {
    addUniqueSelector(selectors, `#${escapeCssIdentifier(element.id)}`);
  }

  if (element.name) {
    addUniqueSelector(selectors, `${tag}[name="${escapeAttributeValue(element.name)}"]`);
  }

  for (const attribute of ["data-testid", "data-test", "data-cy", "data-field"] as const) {
    const value = element.getAttribute(attribute);
    if (value) {
      addUniqueSelector(selectors, `${tag}[${attribute}="${escapeAttributeValue(value)}"]`);
    }
  }

  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    addUniqueSelector(selectors, `${tag}[aria-label="${escapeAttributeValue(ariaLabel)}"]`);
  }

  const placeholder = element.getAttribute("placeholder");
  if (placeholder) {
    addUniqueSelector(selectors, `${tag}[placeholder="${escapeAttributeValue(placeholder)}"]`);
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    const currentTag = current.tagName.toLowerCase();
    const siblings = current.parentElement
      ? Array.from(current.parentElement.children).filter((sibling) => sibling.tagName === current?.tagName)
      : [];
    const position = siblings.indexOf(current) + 1;
    path.unshift(`${currentTag}:nth-of-type(${Math.max(position, 1)})`);

    const selector = path.join(" > ");
    if (isUniqueSelector(selector)) {
      addUniqueSelector(selectors, selector);
      break;
    }

    current = current.parentElement;
  }

  return selectors.slice(0, 8);
}

function getControlLabel(element: FormControl, index: number) {
  const associatedLabel = Array.from(element.labels ?? [])
    .map((label) => normalizeText(label.textContent))
    .find(Boolean);

  const labelledBy = element.getAttribute("aria-labelledby")
    ?.split(/\s+/)
    .map((id) => normalizeText(document.getElementById(id)?.textContent))
    .find(Boolean);

  return associatedLabel
    || labelledBy
    || normalizeText(element.getAttribute("aria-label"))
    || normalizeText(element.getAttribute("placeholder"))
    || normalizeText(element.name)
    || normalizeText(element.id)
    || `Field ${index + 1}`;
}

function getFormContext(element: FormControl) {
  const fieldset = element.closest("fieldset");
  const legend = fieldset?.querySelector("legend");
  const form = element.closest("form");

  return normalizeText(legend?.textContent)
    || normalizeText(form?.getAttribute("aria-label"))
    || normalizeText(form?.getAttribute("name"))
    || normalizeText(form?.id)
    || "";
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

function buildDomSnapshot() {
  const controls = Array.from(
    document.querySelectorAll<FormControl>("input, select, textarea")
  )
    .filter(isSupportedControl)
    .slice(0, 100);

  return controls.reduce<DomElementSnapshot[]>((snapshot, element, index) => {
    const selectorCandidates = createSelectorCandidates(element);
    const selector = selectorCandidates[0];

    if (!selector) {
      return snapshot;
    }

    snapshot.push({
      tag: element.tagName.toLowerCase() as DomElementSnapshot["tag"],
      selector,
      selectorCandidates,
      label: getControlLabel(element, index),
      id: normalizeText(element.id) || undefined,
      name: normalizeText(element.name) || undefined,
      placeholder: normalizeText(element.getAttribute("placeholder")) || undefined,
      ariaLabel: normalizeText(element.getAttribute("aria-label")) || undefined,
      inputType: element instanceof HTMLInputElement ? element.type || "text" : element.tagName.toLowerCase(),
      required: element.required || element.getAttribute("aria-required") === "true",
      options: element instanceof HTMLSelectElement
        ? Array.from(element.options)
          .filter((option) => !option.disabled && normalizeText(option.textContent))
          .map((option) => normalizeText(option.textContent))
          .slice(0, 100)
        : [],
      formContext: getFormContext(element)
    });

    return snapshot;
  }, []);
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
      },
      callback: (response: {
        ok?: boolean;
        status?: number;
        data?: unknown;
        error?: string;
        progress?: WorkflowProgress | null;
      } | undefined) => void
    ) => void;
  };
};

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
  const progress = document.createElement("div");
  progress.className = "accesslens-guide-progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-valuemin", "1");
  progress.setAttribute("aria-valuemax", String(instruction.total_workflow_steps));
  progress.setAttribute("aria-valuenow", String(instruction.step_order));
  const fill = document.createElement("span");
  fill.style.width = `${(instruction.step_order / instruction.total_workflow_steps) * 100}%`;
  progress.append(fill);
  body.append(step, title, text, progress);
  popup.append(header, body);

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

function withRuntimeSafetyDefaults(template: AccessLensTemplate) {
  return {
    ...template,
    source: "ai-runtime-generated" as const,
    policies: template.policies ?? {
      storePersonalData: false,
      autoSubmit: false,
      manualReviewRequired: true
    },
    fields: template.fields.map((field) => ({
      ...field,
      originalLabel: field.originalLabel ?? field.label,
      confidence: typeof field.confidence === "number" ? field.confidence : 0.5,
      events: field.events ?? ["input", "change"],
      temporary: true
    }))
  };
}

function validateRuntimeTemplate(template: AccessLensTemplate) {
  const safeTemplate = withRuntimeSafetyDefaults(template);

  if (!Array.isArray(safeTemplate.fields) || safeTemplate.fields.length === 0) {
    throw new Error("AI template did not include any fields.");
  }

  if (
    safeTemplate.policies.storePersonalData !== false
    || safeTemplate.policies.autoSubmit !== false
    || safeTemplate.policies.manualReviewRequired !== true
  ) {
    throw new Error("AI template policies are not safe.");
  }

  for (const field of safeTemplate.fields) {
    if (
      !field.id
      || !field.label
      || !field.type
      || !field.selector
      || typeof field.required !== "boolean"
      || typeof field.confidence !== "number"
      || field.confidence < 0
      || field.confidence > 1
    ) {
      throw new Error("AI template has an invalid field mapping.");
    }

    let target: Element | null = null;
    try {
      target = document.querySelector(field.selector);
    } catch {
      throw new Error(`AI template selector is invalid: ${field.selector}`);
    }

    if (!isSafeFillTarget(target)) {
      throw new Error(`AI template points to an unsafe or unavailable field: ${field.label}`);
    }
  }

  return safeTemplate;
}

async function generateAiTemplate() {
  const elements = buildDomSnapshot();

  if (elements.length === 0) {
    throw new Error("No supported form fields were found on this page.");
  }

  const response = await apiFetch(`${backendApiUrl}/ai/generate-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      url: window.location.href,
      title: normalizeText(document.title, 300),
      heading: getCurrentPageHeading(),
      language: normalizeText(
        document.documentElement.lang || navigator.language || "unknown",
        30
      ),
      elements
    }
  });

  if (!response.ok) {
    throw new Error(await getApiError(response, "AccessLens could not generate an AI template."));
  }

  const generated = await response.json() as {
    template: AccessLensTemplate;
    source: "ai" | "database_draft";
    saved: boolean;
  };

  return {
    ...generated,
    template: validateRuntimeTemplate(generated.template)
  };
}

async function resolveTemplateForCurrentPage(): Promise<ResolvedTemplate> {
  const response = await apiFetch(
    `${backendApiUrl}/templates/resolve?url=${encodeURIComponent(window.location.href)}&heading=${encodeURIComponent(getCurrentPageHeading())}`
  );

  if (response.ok) {
    const data = await response.json() as { template: AccessLensTemplate };
    return { template: data.template, source: "approved", saved: true };
  }

  const errorData = await response.json().catch(() => null) as {
    error?: string;
    code?: string;
  } | null;
  if (
    errorData?.code === "KNOWN_SITE_PAGE_NOT_CONFIGURED"
    || errorData?.code === "AMBIGUOUS_TEMPLATE_MATCH"
    || response.status !== 404
  ) {
    throw new Error(errorData?.error || "AccessLens could not resolve an approved page template.");
  }

  const generated = await generateAiTemplate();
  return {
    template: generated.template,
    source: generated.source,
    saved: generated.saved
  };
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
let originalBoxShadowStyle = "";

function highlightTargetElement(selector: string) {
  if (currentHighlightedElement) {
    currentHighlightedElement.style.outline = originalOutlineStyle;
    currentHighlightedElement.style.boxShadow = originalBoxShadowStyle;
    currentHighlightedElement = null;
  }

  if (!selector) {
    return;
  }

  try {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) {
      currentHighlightedElement = element;
      originalOutlineStyle = element.style.outline;
      originalBoxShadowStyle = element.style.boxShadow;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.style.outline = "4px solid #2563eb";
      element.style.boxShadow = "0 0 16px rgba(37, 99, 235, 0.7)";
    }
  } catch {
    // Ignore selector syntax error
  }
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

  let resolved: ResolvedTemplate;

  try {
    resolved = await resolveTemplateForCurrentPage();
  } catch (error) {
    loadingPanel.remove();
    const errorPanel = createStatusPanel(
      "AccessLens",
      error instanceof Error ? error.message : "AccessLens template loading failed.",
      true
    );
    const requestCard = createWebsiteRequestCard("en");
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "accesslens-secondary-button";
    closeButton.style.marginTop = "10px";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", () => root.remove());
    errorPanel.append(requestCard, closeButton);
    shadowRoot.append(errorPanel);
    return;

  }

  loadingPanel.remove();
  const { template, source } = resolved;
  const fields = template.fields.filter((field) => field.type !== "password");
  const isRuntimeAiTemplate = source !== "approved";

  if (fields.length === 0 && instruction?.completion_rule.completes_workflow === true) {
    await clearWorkflowProgress();
    shadowRoot.append(createCompletionPanel());
    return;
  }

  let viewMode: ViewMode = "wizard";
  let language: Language = "en";
  let currentStepIndex = 0;
  let isDarkMode = false;
  let isCollapsed = false;
  const formValuesState: Record<string, string> = {};

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
  statusBadge.className = `accesslens-badge ${isRuntimeAiTemplate ? "accesslens-badge-ai" : "accesslens-badge-approved"}`;
  statusBadge.textContent = isRuntimeAiTemplate ? "AI Mapped" : "Approved";

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
  description.className = isRuntimeAiTemplate
    ? "accesslens-description accesslens-ai-draft"
    : "accesslens-description";

  let draftTitle: HTMLElement | null = null;
  let draftNotice: HTMLElement | null = null;
  let requestCardContainer: HTMLElement | null = null;

  if (isRuntimeAiTemplate) {
    draftTitle = document.createElement("strong");
    draftNotice = document.createElement("p");
    requestCardContainer = createWebsiteRequestCard(language);
    description.append(draftTitle, draftNotice, requestCardContainer);
  } else {
    description.textContent = template.templateName;
  }



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

    if (draftTitle && draftNotice) {
      draftTitle.textContent = t(language, "temporaryAiTemplate");
      draftNotice.textContent = t(language, "temporaryAiTemplateNotice");
    }
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
          language,
          isRuntimeAiTemplate
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

