import stylesText from "./contentStyles.css?inline";

type AccessLensValues = {
  textInput: string;
  password: string;
  datalist: string;
  textarea: string;
};

const overlayId = "accesslens-overlay-root";

const fields = [
  {
    key: "textInput",
    label: "Text Input",
    originalSelector: '[name="my-text"]',
    required: true
  },
  {
    key: "password",
    label: "Password",
    originalSelector: '[name="my-password"]',
    required: true
  },
  {
    key: "datalist",
    label: "Dropdown Datalist",
    originalSelector: '[name="my-datalist"]',
    required: true
  },
  {
    key: "textarea",
    label: "Textarea",
    originalSelector: '[name="my-textarea"]',
    required: false
  }
] as const;

function createTextInput(id: string, label: string, multiline = false) {
  const wrapper = document.createElement("label");
  wrapper.className = "accesslens-field";
  wrapper.htmlFor = id;

  const labelText = document.createElement("span");
  labelText.textContent = label;

  const input = multiline
    ? document.createElement("textarea")
    : document.createElement("input");

  input.id = id;
  input.name = id;

  if (input instanceof HTMLInputElement) {
    input.type = id === "email" ? "email" : "text";
  }

  wrapper.append(labelText, input);

  return { wrapper, input };
}

function getOverlayValues(panel: HTMLElement): AccessLensValues {
  return {
    textInput: getFieldValue(panel, "textInput"),
    password: getFieldValue(panel, "password"),
    datalist: getFieldValue(panel, "datalist"),
    textarea: getFieldValue(panel, "textarea")
  };
}

function getFieldValue(panel: HTMLElement, fieldName: keyof AccessLensValues) {
  const field = panel.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[name="${fieldName}"]`
  );

  return field?.value.trim() ?? "";
}

function validateValues(values: AccessLensValues) {
  const missingFields = fields
    .filter((field) => field.required && !values[field.key].trim())
    .map((field) => field.label);

  if (missingFields.length === 0) {
    return "";
  }

  return `Please enter: ${missingFields.join(", ")}.`;
}

function updateOriginalField(selector: string, value: string) {
  const originalField = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    selector
  );

  if (!originalField) {
    return;
  }

  originalField.value = value;
  originalField.dispatchEvent(new Event("input", { bubbles: true }));
  originalField.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillOriginalForm(values: AccessLensValues) {
  fields.forEach((field) => {
    updateOriginalField(field.originalSelector, values[field.key]);
  });
}

function injectOverlay() {
  if (document.getElementById(overlayId)) {
    return;
  }

  const root = document.createElement("div");
  root.id = overlayId;

  const shadowRoot = root.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = stylesText;

  const panel = document.createElement("section");
  panel.className = "accesslens-panel";
  panel.setAttribute("aria-label", "AccessLens form overlay");

  const title = document.createElement("h2");
  title.textContent = "AccessLens";

  const description = document.createElement("p");
  description.className = "accesslens-description";
  description.textContent = "Simple form view for this page";

  const message = document.createElement("p");
  message.className = "accesslens-message";
  message.setAttribute("role", "status");

  const form = document.createElement("form");
  form.className = "accesslens-form";

  fields.forEach((field) => {
    const fieldControl = createTextInput(
      field.key,
      field.label,
      field.key === "textarea"
    );
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
  shadowRoot.append(style, panel);
  document.body.append(root);

  fillButton.addEventListener("click", () => {
    const values = getOverlayValues(panel);
    const validationError = validateValues(values);

    message.className = "accesslens-message";

    if (validationError) {
      message.classList.add("accesslens-message-error");
      message.textContent = validationError;
      return;
    }

    fillOriginalForm(values);
    message.classList.add("accesslens-message-success");
    message.textContent =
      "AccessLens filled the original form. Please review it manually before submitting.";
  });

  closeButton.addEventListener("click", () => {
    root.remove();
  });
}

injectOverlay();
