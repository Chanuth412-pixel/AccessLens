import stylesText from "./contentStyles.css?inline";
import type { AccessLensField, AccessLensTemplate } from "../types/accessLensTemplate";

const overlayId = "accesslens-overlay-root";
const templateApiUrl = "http://localhost:4000/api/templates/match";

function createTextInput(field: AccessLensField) {
  const wrapper = document.createElement("label");
  wrapper.className = "accesslens-field";
  wrapper.htmlFor = field.id;

  const labelText = document.createElement("span");
  labelText.textContent = field.required ? `${field.label} *` : field.label;

  const input = field.type === "textarea"
    ? document.createElement("textarea")
    : document.createElement("input");

  input.id = field.id;
  input.name = field.id;

  if (input instanceof HTMLInputElement) {
    input.type = field.type === "textarea" || field.type === "select" ? "text" : field.type;
  }

  wrapper.append(labelText, input);

  return { wrapper, input };
}

async function fetchTemplateForCurrentPage() {
  const response = await fetch(
    `${templateApiUrl}?url=${encodeURIComponent(window.location.href)}`
  );

  if (response.status === 404) {
    throw new Error("No approved AccessLens template was found for this page.");
  }

  if (!response.ok) {
    throw new Error("AccessLens could not load the template from the backend.");
  }

  const data = (await response.json()) as { template: AccessLensTemplate };
  return data.template;
}

function getOverlayValues(panel: HTMLElement, fields: AccessLensField[]) {
  return fields.reduce<Record<string, string>>((values, field) => {
    values[field.id] = getFieldValue(panel, field.id);
    return values;
  }, {});
}

function getFieldValue(panel: HTMLElement, fieldName: string) {
  const field = panel.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[name="${fieldName}"]`
  );

  return field?.value.trim() ?? "";
}

function validateValues(values: Record<string, string>, fields: AccessLensField[]) {
  const missingFields = fields
    .filter((field) => field.required && !values[field.id]?.trim())
    .map((field) => field.label);

  if (missingFields.length === 0) {
    return "";
  }

  return `Please enter: ${missingFields.join(", ")}.`;
}

function updateOriginalField(field: AccessLensField, value: string) {
  const originalField = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    field.selector
  );

  if (!originalField) {
    return `${field.label} target was not found on the original page.`;
  }

  originalField.value = value;
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

async function injectOverlay() {
  if (document.getElementById(overlayId)) {
    return;
  }

  const root = document.createElement("div");
  root.id = overlayId;

  const shadowRoot = root.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = stylesText;

  shadowRoot.append(style);
  document.body.append(root);

  let template: AccessLensTemplate;

  try {
    template = await fetchTemplateForCurrentPage();
  } catch (error) {
    const panel = document.createElement("section");
    panel.className = "accesslens-panel";
    panel.setAttribute("aria-label", "AccessLens template status");

    const title = document.createElement("h2");
    title.textContent = "AccessLens";

    const message = createMessage(
      "accesslens-message accesslens-message-error",
      error instanceof Error ? error.message : "AccessLens template loading failed."
    );

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "accesslens-secondary-button";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", () => root.remove());

    panel.append(title, message, closeButton);
    shadowRoot.append(panel);
    return;
  }

  const panel = document.createElement("section");
  panel.className = "accesslens-panel";
  panel.setAttribute("aria-label", "AccessLens form overlay");

  const title = document.createElement("h2");
  title.textContent = "AccessLens";

  const description = document.createElement("p");
  description.className = "accesslens-description";
  description.textContent = template.templateName;

  const message = document.createElement("p");
  message.className = "accesslens-message";
  message.setAttribute("role", "status");

  const form = document.createElement("form");
  form.className = "accesslens-form";

  template.fields.forEach((field) => {
    const fieldControl = createTextInput(field);
    form.append(fieldControl.wrapper);
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
    message.textContent =
      "AccessLens filled the original form using the database template. Please review it manually before submitting.";
  });

  closeButton.addEventListener("click", () => {
    root.remove();
  });
}

void injectOverlay();
