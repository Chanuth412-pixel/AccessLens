import type { AccessLensField } from "./types/accessLensTemplate";

type Language = "en" | "si";

type AccessLensWindowSession = {
  id: string;
  tabId: number;
  templateName: string;
  fields: AccessLensField[];
  values: Record<string, string>;
  language: Language;
  isRuntimeAiTemplate: boolean;
};

declare const chrome: {
  runtime: {
    lastError?: { message?: string };
    sendMessage: (
      message: { type: string; sessionId?: string; values?: Record<string, string> },
      callback: (response: { ok: boolean; session?: AccessLensWindowSession; error?: string } | undefined) => void
    ) => void;
  };
};

const text = {
  en: {
    allFields: "All Fields",
    close: "Close",
    fillOriginal: "Fill original form",
    hint: "Place this window beside the website, enter details here, then fill the original form.",
    loading: "Loading AccessLens window...",
    missingSession: "AccessLens session not found. Open this window again from the website overlay.",
    notEntered: "Not entered",
    temporaryAiTemplate: "Temporary AI template",
    temporaryAiTemplateNotice: "Review mappings before filling."
  },
  si: {
    allFields: "සියලු ක්ෂේත්‍ර",
    close: "වසන්න",
    fillOriginal: "මුල් පෝරමය පුරවන්න",
    hint: "මෙම කවුළුව වෙබ් අඩවිය අසල තබා තොරතුරු ඇතුළත් කර මුල් පෝරමය පුරවන්න.",
    loading: "AccessLens කවුළුව පූරණය වෙමින් පවතී...",
    missingSession: "AccessLens සැසිය හමු නොවීය. වෙබ් අඩවි overlay එකෙන් නැවත විවෘත කරන්න.",
    notEntered: "ඇතුළත් කර නැත",
    temporaryAiTemplate: "තාවකාලික AI ආකෘතිය",
    temporaryAiTemplateNotice: "පිරවීමට පෙර ගැළපීම් පරීක්ෂා කරන්න."
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

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const windowStyles = `
  * {
    box-sizing: border-box;
  }

  html,
  body {
    min-height: 100%;
    margin: 0;
    background: #f8fafc;
    color: #0f172a;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  #accesslens-window-root {
    min-height: 100vh;
    padding: 16px;
    display: flex;
    justify-content: center;
  }

  .accesslens-panel {
    width: 100%;
    max-width: 440px;
    min-height: fit-content;
    padding: 20px;
    border: 2px solid #2563eb;
    border-radius: 16px;
    background: #ffffff;
    box-shadow:
      0 20px 50px -10px rgba(15, 23, 42, 0.2),
      0 0 0 1px rgba(37, 99, 235, 0.25);
  }

  .accesslens-titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: -4px -4px 12px;
    padding: 4px;
    border-radius: 8px;
  }

  .accesslens-panel h2 {
    margin: 0;
    font-size: 20px;
    line-height: 1.25;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #0f172a;
  }

  .accesslens-language-switcher {
    display: inline-flex;
    width: fit-content;
    gap: 2px;
    margin: -2px 0 12px;
    padding: 3px;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    background: #f8fafc;
  }

  .accesslens-language-btn {
    min-height: 28px;
    border: none;
    border-radius: 999px;
    padding: 0 12px;
    background: transparent;
    color: #64748b;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .accesslens-language-btn:hover {
    color: #1e293b;
    background: #f1f5f9;
  }

  .accesslens-language-btn.active {
    background: #ffffff;
    color: #2563eb;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
  }

  .accesslens-description,
  .accesslens-window-intro {
    margin: 8px 0 14px;
    color: #64748b;
    font-size: 13.5px;
    line-height: 1.45;
  }

  .accesslens-ai-draft {
    border: 1px solid #fde68a;
    border-left: 4px solid #f59e0b;
    border-radius: 8px;
    padding: 10px 12px;
    background: #fffbeb;
    color: #92400e;
  }

  .accesslens-ai-draft strong,
  .accesslens-ai-draft p {
    display: inline;
    margin: 0;
  }

  .accesslens-ai-draft strong {
    margin-right: 8px;
    color: #78350f;
    font-size: 13.5px;
  }

  .accesslens-form,
  .accesslens-form-content,
  .accesslens-field {
    display: grid;
  }

  .accesslens-form {
    gap: 12px;
  }

  .accesslens-form-content {
    gap: 12px;
  }

  .accesslens-field {
    gap: 6px;
    color: #334155;
    font-size: 13.5px;
    font-weight: 600;
  }

  .accesslens-field input,
  .accesslens-field textarea,
  .accesslens-field select {
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 10px 12px;
    background: #ffffff;
    color: #0f172a;
    font: inherit;
    font-size: 14px;
    font-weight: 400;
    transition: all 0.15s ease;
  }

  .accesslens-field textarea {
    min-height: 80px;
    resize: vertical;
  }

  .accesslens-field input:focus,
  .accesslens-field textarea:focus,
  .accesslens-field select:focus {
    border-color: #2563eb;
    outline: 3px solid rgba(37, 99, 235, 0.15);
    background: #ffffff;
  }

  .accesslens-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .accesslens-primary-button,
  .accesslens-secondary-button {
    min-height: 40px;
    border-radius: 8px;
    padding: 0 16px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .accesslens-primary-button {
    flex: 1;
    border: 1px solid #2563eb;
    background: #2563eb;
    color: #ffffff;
    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.18);
  }

  .accesslens-secondary-button {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #334155;
  }

  .accesslens-primary-button:hover {
    background: #1d4ed8;
    border-color: #1d4ed8;
  }

  .accesslens-secondary-button:hover {
    background: #f8fafc;
    border-color: #94a3b8;
    color: #0f172a;
  }

  .accesslens-message {
    min-height: 20px;
    margin: 10px 0 0;
    font-size: 13px;
    line-height: 1.4;
  }

  .accesslens-message-error {
    color: #dc2626;
  }

  .accesslens-message-success {
    color: #16a34a;
  }
`;

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function translateFieldLabel(label: string, language: Language) {
  if (language === "en") {
    return label;
  }

  return sinhalaFieldLabels[normalizeText(label).toLowerCase()] ?? label;
}

function getSessionId() {
  return new URLSearchParams(window.location.search).get("sessionId") ?? "";
}

function createFieldControl(field: AccessLensField, language: Language, value = "") {
  const wrapper = document.createElement("label");
  wrapper.className = "accesslens-field";
  wrapper.htmlFor = field.id;

  const translatedLabel = translateFieldLabel(field.label, language);
  const labelText = document.createElement("span");
  labelText.textContent = field.required ? `${translatedLabel} *` : translatedLabel;

  let input: FormControl;

  if (field.type === "select") {
    const select = document.createElement("select");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = language === "si" ? `${translatedLabel} තෝරන්න` : `Select ${translatedLabel}`;
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
  input.value = value;
  wrapper.append(labelText, input);

  return { wrapper, input };
}

function setMessage(message: HTMLElement, textValue: string, isError = false) {
  message.className = `accesslens-message ${isError ? "accesslens-message-error" : "accesslens-message-success"}`;
  message.textContent = textValue;
}

function renderSession(session: AccessLensWindowSession) {
  const root = document.getElementById("accesslens-window-root");
  if (!root) {
    return;
  }

  let language = session.language;
  const values = { ...session.values };

  const style = document.createElement("style");
  style.textContent = windowStyles;

  const panel = document.createElement("section");
  panel.className = "accesslens-panel";
  panel.setAttribute("aria-label", "AccessLens separate window");

  const titlebar = document.createElement("div");
  titlebar.className = "accesslens-titlebar";

  const title = document.createElement("h2");
  title.textContent = "AccessLens";
  titlebar.append(title);

  const languageSwitcher = document.createElement("div");
  languageSwitcher.className = "accesslens-language-switcher";

  const englishButton = document.createElement("button");
  englishButton.type = "button";
  englishButton.className = "accesslens-language-btn";
  englishButton.textContent = "English";

  const sinhalaButton = document.createElement("button");
  sinhalaButton.type = "button";
  sinhalaButton.className = "accesslens-language-btn";
  sinhalaButton.textContent = "සිංහල";
  languageSwitcher.append(englishButton, sinhalaButton);

  const notice = document.createElement("div");
  notice.className = "accesslens-description accesslens-ai-draft";
  const noticeTitle = document.createElement("strong");
  const noticeText = document.createElement("p");
  notice.append(noticeTitle, noticeText);

  const intro = document.createElement("p");
  intro.className = "accesslens-window-intro";

  const form = document.createElement("form");
  form.className = "accesslens-form";

  const formContent = document.createElement("div");
  formContent.className = "accesslens-form-content";

  const actions = document.createElement("div");
  actions.className = "accesslens-actions";

  const fillButton = document.createElement("button");
  fillButton.type = "button";
  fillButton.className = "accesslens-primary-button";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "accesslens-secondary-button";

  const message = document.createElement("p");
  message.className = "accesslens-message";
  message.setAttribute("role", "status");

  const renderText = () => {
    document.documentElement.lang = language === "si" ? "si" : "en";
    englishButton.className = `accesslens-language-btn ${language === "en" ? "active" : ""}`;
    sinhalaButton.className = `accesslens-language-btn ${language === "si" ? "active" : ""}`;
    noticeTitle.textContent = text[language].temporaryAiTemplate;
    noticeText.textContent = text[language].temporaryAiTemplateNotice;
    intro.textContent = text[language].hint;
    fillButton.textContent = text[language].fillOriginal;
    closeButton.textContent = text[language].close;
  };

  const renderFields = () => {
    formContent.replaceChildren();
    for (const field of session.fields) {
      const { wrapper, input } = createFieldControl(field, language, values[field.id] ?? "");
      input.addEventListener("input", () => {
        values[field.id] = input.value.trim();
      });
      formContent.append(wrapper);
    }
  };

  englishButton.addEventListener("click", () => {
    language = "en";
    renderText();
    renderFields();
  });

  sinhalaButton.addEventListener("click", () => {
    language = "si";
    renderText();
    renderFields();
  });

  fillButton.addEventListener("click", () => {
    chrome.runtime.sendMessage(
      { type: "ACCESSLENS_FILL_VALUES", sessionId: session.id, values },
      (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
          setMessage(message, response?.error || chrome.runtime.lastError?.message || "Could not fill the original form.", true);
          return;
        }

        setMessage(message, "Original form filled. Review it before submitting.");
      }
    );
  });

  closeButton.addEventListener("click", () => window.close());

  actions.append(fillButton, closeButton);
  form.append(formContent, actions);
  panel.append(titlebar, languageSwitcher, notice, intro, form, message);
  root.replaceChildren(style, panel);
  renderText();
  renderFields();
}

function renderStatus(textValue: string, isError = false) {
  const root = document.getElementById("accesslens-window-root");
  if (!root) {
    return;
  }

  const style = document.createElement("style");
  style.textContent = windowStyles;
  const panel = document.createElement("section");
  panel.className = "accesslens-panel";
  const title = document.createElement("h2");
  title.textContent = "AccessLens";
  const message = document.createElement("p");
  message.className = isError ? "accesslens-message accesslens-message-error" : "accesslens-description";
  message.textContent = textValue;
  panel.append(title, message);
  root.replaceChildren(style, panel);
}

const sessionId = getSessionId();
renderStatus(text.en.loading);

chrome.runtime.sendMessage({ type: "GET_ACCESSLENS_WINDOW_SESSION", sessionId }, (response) => {
  if (chrome.runtime.lastError || !response?.ok || !response.session) {
    renderStatus(response?.error || chrome.runtime.lastError?.message || text.en.missingSession, true);
    return;
  }

  renderSession(response.session);
});
