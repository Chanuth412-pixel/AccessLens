import stylesText from "./contentStyles.css?inline";
import type { AccessLensField, AccessLensTemplate } from "../types/accessLensTemplate";

const overlayId = "accesslens-overlay-root";
const backendApiUrl = "http://localhost:4000/api";

type TemplateSource = "approved" | "ai" | "database_draft";

type ResolvedTemplate = {
  template: AccessLensTemplate;
  source: TemplateSource;
  saved: boolean;
};

type DomElementSnapshot = {
  tag: "input" | "select" | "textarea";
  selector: string;
  label: string;
  inputType: string;
  required: boolean;
  options: string[];
  formContext: string;
};

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

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

function createSelector(element: FormControl) {
  if (element.id) {
    const selector = `#${escapeCssIdentifier(element.id)}`;
    if (isUniqueSelector(selector)) {
      return selector;
    }
  }

  if (element.name) {
    const selector = `${element.tagName.toLowerCase()}[name="${escapeAttributeValue(element.name)}"]`;
    if (isUniqueSelector(selector)) {
      return selector;
    }
  }

  for (const attribute of ["data-testid", "data-field", "aria-label"] as const) {
    const value = element.getAttribute(attribute);
    if (!value) {
      continue;
    }

    const selector = `${element.tagName.toLowerCase()}[${attribute}="${escapeAttributeValue(value)}"]`;
    if (isUniqueSelector(selector)) {
      return selector;
    }
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    const tag = current.tagName.toLowerCase();
    const siblings = current.parentElement
      ? Array.from(current.parentElement.children).filter((sibling) => sibling.tagName === current?.tagName)
      : [];
    const position = siblings.indexOf(current) + 1;
    path.unshift(`${tag}:nth-of-type(${Math.max(position, 1)})`);

    const selector = path.join(" > ");
    if (isUniqueSelector(selector)) {
      return selector;
    }

    current = current.parentElement;
  }

  return path.join(" > ");
}

function getControlLabel(element: FormControl, index: number) {
  const associatedLabel = Array.from(element.labels ?? [])
    .map((label) => normalizeText(label.textContent))
    .find(Boolean);

  return associatedLabel
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

function isSupportedControl(element: FormControl) {
  if (element.disabled || element.closest(`[aria-hidden="true"]`)) {
    return false;
  }

  if (element instanceof HTMLInputElement) {
    const excludedTypes = new Set([
      "button",
      "checkbox",
      "color",
      "file",
      "hidden",
      "image",
      "radio",
      "range",
      "reset",
      "submit"
    ]);

    if (excludedTypes.has(element.type)) {
      return false;
    }
  }

  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function buildDomSnapshot() {
  const controls = Array.from(
    document.querySelectorAll<FormControl>("input, select, textarea")
  )
    .filter(isSupportedControl)
    .slice(0, 100);

  return controls.reduce<DomElementSnapshot[]>((snapshot, element, index) => {
    const selector = createSelector(element);

    if (!selector || !isUniqueSelector(selector)) {
      return snapshot;
    }

    snapshot.push({
      tag: element.tagName.toLowerCase() as DomElementSnapshot["tag"],
      selector,
      label: getControlLabel(element, index),
      inputType: element instanceof HTMLInputElement ? element.type : element.tagName.toLowerCase(),
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

  return response.json() as Promise<{
    template: AccessLensTemplate;
    source: "ai" | "database_draft";
    saved: boolean;
  }>;
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
    textInput.type = field.type;
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

function updateOriginalField(field: AccessLensField, value: string) {
  let originalField: FormControl | null = null;

  try {
    originalField = document.querySelector<FormControl>(field.selector);
  } catch {
    return `${field.label} has an invalid target selector.`;
  }

  if (!originalField) {
    return `${field.label} target was not found on the original page.`;
  }

  setNativeValue(originalField, value);
  originalField.dispatchEvent(new Event("input", { bubbles: true }));
  originalField.dispatchEvent(new Event("change", { bubbles: true }));

  return "";
}

function fillOriginalForm(values: Record<string, string>, fields: AccessLensField[]) {
  return fields
    .map((field) => updateOriginalField(field, values[field.id] ?? ""))
    .filter(Boolean);
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
  const panel = document.createElement("section");
  panel.className = "accesslens-panel";
  panel.setAttribute("aria-label", "AccessLens form overlay");

  const title = document.createElement("h2");
  title.textContent = "AccessLens";
  const description = document.createElement("p");
  description.className = source === "approved"
    ? "accesslens-description"
    : "accesslens-description accesslens-ai-draft";
  description.textContent = source === "approved"
    ? template.templateName
    : `AI draft: ${template.templateName}. Review all fields before using it.`;

  const message = document.createElement("p");
  message.className = "accesslens-message";
  message.setAttribute("role", "status");
  const form = document.createElement("form");
  form.className = "accesslens-form";

  template.fields.forEach((field) => {
    form.append(createFieldControl(field).wrapper);
  });

  const actions = document.createElement("div");
  actions.className = "accesslens-actions";
  const fillButton = document.createElement("button");
  fillButton.type = "button";
  fillButton.className = "accesslens-primary-button";
  fillButton.textContent = "Fill Original Form";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "accesslens-secondary-button";
  closeButton.textContent = "Close";
  actions.append(fillButton, closeButton);
  form.append(actions);
  panel.append(title, description, form, message);
  shadowRoot.append(panel);

  fillButton.addEventListener("click", () => {
    const values = getOverlayValues(panel, template.fields);
    const validationError = validateValues(values, template.fields);
    message.className = "accesslens-message";

    if (validationError) {
      message.classList.add("accesslens-message-error");
      message.textContent = validationError;
      return;
    }

    const fillErrors = fillOriginalForm(values, template.fields);

    if (fillErrors.length > 0) {
      message.classList.add("accesslens-message-error");
      message.textContent = fillErrors.join(" ");
      return;
    }

    message.classList.add("accesslens-message-success");
    message.textContent = source === "approved"
      ? "The original form was filled from the approved template. Review it before submitting."
      : "The original form was filled from an AI draft. Check every field carefully before submitting.";
  });

  closeButton.addEventListener("click", () => root.remove());
}

void injectOverlay();
