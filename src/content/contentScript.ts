import stylesText from "./contentStyles.css?inline";
import type { AccessLensField, AccessLensTemplate } from "../types/accessLensTemplate";

const overlayId = "accesslens-overlay-root";
const backendApiUrl = "http://localhost:4000/api";
const lowConfidenceThreshold = 0.7;

type TemplateSource = "approved" | "ai" | "database_draft";

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

async function getApiError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null) as { error?: string } | null;
  return data?.error || fallback;
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

  const response = await fetch(`${backendApiUrl}/ai/generate-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: window.location.href,
      title: normalizeText(document.title, 300),
      language: normalizeText(
        document.documentElement.lang || navigator.language || "unknown",
        30
      ),
      elements
    })
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
  const response = await fetch(
    `${backendApiUrl}/templates/match?url=${encodeURIComponent(window.location.href)}`
  );

  if (response.ok) {
    const data = await response.json() as { template: AccessLensTemplate };
    return { template: data.template, source: "approved", saved: true };
  }

  if (response.status !== 404) {
    throw new Error(await getApiError(response, "AccessLens could not reach the template backend."));
  }

  const generated = await generateAiTemplate();
  return {
    template: generated.template,
    source: generated.source,
    saved: generated.saved
  };
}

function createFieldControl(field: AccessLensField) {
  const wrapper = document.createElement("label");
  wrapper.className = "accesslens-field";
  wrapper.htmlFor = field.id;

  const labelText = document.createElement("span");
  labelText.textContent = field.required ? `${field.label} *` : field.label;

  let input: FormControl;

  if (field.type === "select") {
    const select = document.createElement("select");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = `Select ${field.label}`;
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

function validateValues(values: Record<string, string>, fields: AccessLensField[]) {
  const missingFields = fields
    .filter((field) => field.required && !values[field.id]?.trim())
    .map((field) => field.label);

  return missingFields.length === 0 ? "" : `Please enter: ${missingFields.join(", ")}.`;
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

function createReviewDetails(values: Record<string, string>, fields: AccessLensField[]) {
  const wrapper = document.createElement("div");
  wrapper.className = "accesslens-review";

  const heading = document.createElement("h3");
  heading.textContent = "Review details";
  wrapper.append(heading);

  for (const field of fields) {
    const row = document.createElement("div");
    row.className = "accesslens-review-row";

    const label = document.createElement("strong");
    label.textContent = field.label;

    const value = document.createElement("span");
    value.textContent = values[field.id] || "Not entered";

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
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "accesslens-secondary-button";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", () => root.remove());
    errorPanel.append(closeButton);
    shadowRoot.append(errorPanel);
    return;
  }

  loadingPanel.remove();
  const { template, source } = resolved;
  const fields = template.fields.filter((field) => field.type !== "password");
  const isRuntimeAiTemplate = source !== "approved";
  const panel = document.createElement("section");
  panel.className = "accesslens-panel";
  panel.setAttribute("aria-label", "AccessLens form overlay");

  const title = document.createElement("h2");
  title.textContent = "AccessLens";

  const description = document.createElement("div");
  description.className = isRuntimeAiTemplate
    ? "accesslens-description accesslens-ai-draft"
    : "accesslens-description";

  if (isRuntimeAiTemplate) {
    const draftTitle = document.createElement("strong");
    draftTitle.textContent = "AI-generated temporary template";
    const draftNotice = document.createElement("p");
    draftNotice.textContent = "This website does not have an approved AccessLens template yet.";
    const draftReview = document.createElement("p");
    draftReview.textContent = "Please review all mappings carefully before filling the original form.";
    description.append(draftTitle, draftNotice, draftReview);
  } else {
    description.textContent = template.templateName;
  }

  const message = document.createElement("p");
  message.className = "accesslens-message";
  message.setAttribute("role", "status");

  const form = document.createElement("form");
  form.className = "accesslens-form";

  fields.forEach((field) => {
    form.append(createFieldControl(field).wrapper);
  });

  const reviewContainer = document.createElement("div");
  reviewContainer.className = "accesslens-review-container";
  reviewContainer.hidden = true;

  const resultContainer = document.createElement("div");
  resultContainer.className = "accesslens-result-container";

  const actions = document.createElement("div");
  actions.className = "accesslens-actions";
  const reviewButton = document.createElement("button");
  reviewButton.type = "button";
  reviewButton.className = "accesslens-primary-button";
  reviewButton.textContent = "Review Details";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "accesslens-secondary-button";
  closeButton.textContent = "Close";
  actions.append(reviewButton, closeButton);
  form.append(actions, reviewContainer, resultContainer);
  panel.append(title, description, form, message);
  shadowRoot.append(panel);

  form.addEventListener("input", () => {
    reviewContainer.hidden = true;
    reviewContainer.replaceChildren();
    resultContainer.replaceChildren();
    message.textContent = "";
  });

  reviewButton.addEventListener("click", () => {
    const values = getOverlayValues(panel, fields);
    const validationError = validateValues(values, fields);
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
    confirmButton.textContent = "Confirm and Fill Original Form";

    confirmButton.addEventListener("click", () => {
      const latestValues = getOverlayValues(panel, fields);
      const latestValidationError = validateValues(latestValues, fields);
      message.className = "accesslens-message";
      resultContainer.replaceChildren();

      if (latestValidationError) {
        message.classList.add("accesslens-message-error");
        message.textContent = latestValidationError;
        return;
      }

      const results = fillOriginalForm(latestValues, fields);
      const hasErrors = results.some((result) => !result.ok);
      resultContainer.append(createResultList(results));
      message.classList.add(hasErrors ? "accesslens-message-error" : "accesslens-message-success");
      message.textContent = hasErrors
        ? "Some fields need manual attention. The original form was not submitted."
        : "Fields were filled. Review the original website form before submitting it yourself.";
    });

    reviewContainer.replaceChildren(createReviewDetails(values, fields), confirmButton);
    reviewContainer.hidden = false;
    message.textContent = "Review the details and mappings before confirming.";
  });

  closeButton.addEventListener("click", () => root.remove());
}

void injectOverlay();
