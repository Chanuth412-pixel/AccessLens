const recordingTokenParam = '_accesslens_recording';

const panelHtml = `
  <!-- Visual-only redesign styles. IDs and behavior hooks below are preserved. -->
  <style>
    #al-panel,
    #al-panel * {
      box-sizing: border-box;
      font-family: Inter, Manrope, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #al-panel {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: min(380px, calc(100vw - 32px));
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      padding: 18px;
      color: #f8fbff;
      background:
        radial-gradient(circle at 12% 0%, rgba(34, 211, 238, 0.16), transparent 31%),
        radial-gradient(circle at 92% 12%, rgba(139, 92, 246, 0.24), transparent 34%),
        linear-gradient(145deg, rgba(6, 10, 27, 0.98), rgba(11, 18, 42, 0.98) 48%, rgba(17, 12, 37, 0.98));
      border: 1px solid rgba(125, 92, 255, 0.58);
      border-radius: 18px;
      clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px));
      box-shadow:
        0 24px 70px rgba(0, 0, 0, 0.54),
        0 0 34px rgba(34, 211, 238, 0.16),
        0 0 56px rgba(124, 58, 237, 0.14),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(18px) saturate(150%);
      -webkit-backdrop-filter: blur(18px) saturate(150%);
    }

    #al-panel::before {
      position: absolute;
      inset: 1px;
      z-index: -1;
      border-radius: 17px;
      background:
        linear-gradient(rgba(148, 163, 184, 0.055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(148, 163, 184, 0.045) 1px, transparent 1px);
      background-size: 22px 22px;
      clip-path: inherit;
      content: "";
      opacity: 0.42;
      pointer-events: none;
    }

    #al-panel::after {
      position: absolute;
      right: 26px;
      top: 0;
      width: 94px;
      height: 2px;
      background: linear-gradient(90deg, transparent, #22d3ee, #a78bfa, transparent);
      content: "";
      pointer-events: none;
      filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.8));
    }

    .al-panel-header {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(96, 165, 250, 0.18);
    }

    .al-panel-header::after {
      position: absolute;
      left: 0;
      bottom: -1px;
      width: 96px;
      height: 1px;
      background: linear-gradient(90deg, #22d3ee, #8b5cf6, transparent);
      content: "";
      box-shadow: 0 0 12px rgba(34, 211, 238, 0.7);
    }

    .al-panel-title {
      color: #ffffff;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0;
      line-height: 1.2;
    }

    #al-context {
      margin-top: 4px;
      color: #8bdcff;
      font-size: 11px;
      font-weight: 650;
      letter-spacing: 0.01em;
    }

    #al-btn-close {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      padding: 0;
      color: #e0f2fe;
      background: rgba(15, 23, 42, 0.28);
      border: 1px solid rgba(125, 211, 252, 0.22);
      border-radius: 9px;
      cursor: pointer;
      font: 700 22px/1 Inter, system-ui, sans-serif;
      transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
    }

    #al-btn-close:hover {
      color: #ffffff;
      background: rgba(14, 165, 233, 0.18);
      border-color: rgba(125, 211, 252, 0.62);
      box-shadow: 0 0 18px rgba(34, 211, 238, 0.25);
      transform: translateY(-1px);
    }

    .al-action-row,
    #al-playback-nav {
      display: flex;
      gap: 8px;
    }

    #al-panel button {
      min-height: 34px;
      border-radius: 10px;
      color: #ffffff;
      cursor: pointer;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.01em;
      text-shadow: 0 1px 8px rgba(0, 0, 0, 0.42);
      transition:
        background 160ms ease,
        border-color 160ms ease,
        box-shadow 160ms ease,
        opacity 160ms ease,
        transform 160ms ease;
    }

    #al-panel button:focus-visible,
    #al-instruction:focus-visible {
      outline: 2px solid rgba(34, 211, 238, 0.72);
      outline-offset: 2px;
    }

    #al-panel button:hover:not(:disabled) {
      filter: brightness(1.08) saturate(1.08);
      transform: translateY(-1px);
    }

    #al-panel button:active:not(:disabled) {
      transform: translateY(0);
    }

    #al-panel button:disabled {
      cursor: not-allowed;
      opacity: 0.62;
      filter: grayscale(0.22);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }

    #al-btn-record,
    #al-btn-stop,
    #al-btn-play,
    #al-btn-clear {
      flex: 1;
      min-height: 42px;
      padding: 10px 8px;
      border: 1px solid transparent;
      border-bottom-width: 2px;
      border-radius: 13px;
      font-size: 13px;
    }

    #al-btn-record {
      background: linear-gradient(145deg, #ff4d6f, #e11d48 48%, #8f1232);
      border-color: rgba(251, 113, 133, 0.72);
      border-bottom-color: rgba(136, 19, 55, 0.95);
      box-shadow:
        0 10px 22px rgba(225, 29, 72, 0.22),
        0 0 20px rgba(239, 68, 68, 0.22),
        inset 0 1px 0 rgba(255, 255, 255, 0.34);
    }

    #al-btn-record:hover:not(:disabled) {
      border-color: rgba(253, 164, 175, 0.92);
      box-shadow:
        0 12px 26px rgba(225, 29, 72, 0.32),
        0 0 28px rgba(248, 113, 113, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.38);
    }

    #al-btn-play,
    #al-btn-next,
    #al-btn-suggest-instruction {
      background: linear-gradient(145deg, #3b82f6, #0ea5e9 48%, #06b6d4);
      border-color: rgba(103, 232, 249, 0.78);
      border-bottom-color: rgba(14, 116, 144, 0.95);
      box-shadow:
        0 10px 22px rgba(14, 165, 233, 0.26),
        0 0 24px rgba(34, 211, 238, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.36);
    }

    #al-btn-stop,
    #al-btn-clear,
    #al-btn-prev {
      background: linear-gradient(145deg, rgba(51, 65, 85, 0.98), rgba(26, 37, 63, 0.98) 48%, rgba(14, 23, 48, 0.98));
      border-color: rgba(148, 163, 184, 0.48);
      border-bottom-color: rgba(15, 23, 42, 0.95);
      box-shadow:
        0 8px 18px rgba(0, 0, 0, 0.24),
        inset 0 1px 0 rgba(255, 255, 255, 0.14);
    }

    #al-btn-stop:hover:not(:disabled),
    #al-btn-clear:hover:not(:disabled),
    #al-btn-prev:hover:not(:disabled) {
      border-color: rgba(186, 230, 253, 0.58);
      box-shadow:
        0 10px 22px rgba(15, 23, 42, 0.28),
        0 0 18px rgba(125, 211, 252, 0.14),
        inset 0 1px 0 rgba(255, 255, 255, 0.18);
    }

    #al-status {
      position: relative;
      min-height: 38px;
      padding: 10px 12px 10px 15px;
      overflow: hidden;
      color: #9fb1ca;
      background: rgba(8, 13, 32, 0.66);
      border: 1px solid rgba(96, 165, 250, 0.16);
      border-radius: 12px;
      font-size: 12.5px;
      line-height: 1.42;
      box-shadow: inset 0 1px 18px rgba(59, 130, 246, 0.06);
    }

    #al-status::before {
      position: absolute;
      left: 0;
      top: 9px;
      bottom: 9px;
      width: 3px;
      border-radius: 999px;
      background: linear-gradient(#22d3ee, #8b5cf6);
      content: "";
      box-shadow: 0 0 12px rgba(34, 211, 238, 0.64);
    }

    #al-step-editor {
      display: none;
      flex-direction: column;
      gap: 11px;
      padding-top: 13px;
      border-top: 1px solid rgba(96, 165, 250, 0.16);
    }

    .al-step-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    #al-step-label {
      color: #ffffff;
      font-size: 14px;
      font-weight: 850;
      line-height: 1.25;
    }

    #al-step-target {
      margin-top: 4px;
      color: #8da0bb;
      font-size: 11px;
      font-weight: 650;
      letter-spacing: 0.02em;
    }

    #al-step-save-state {
      flex: 0 0 auto;
      border: 1px solid rgba(74, 222, 128, 0.28);
      border-radius: 999px;
      padding: 4px 9px;
      color: #bbf7d0;
      background: rgba(20, 83, 45, 0.88);
      box-shadow: 0 0 16px rgba(34, 197, 94, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12);
      font-size: 10px;
      font-weight: 850;
    }

    #al-instruction-editor {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    #al-instruction-editor label,
    .al-instruction-kicker {
      color: #67e8f9;
      font-size: 10.5px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    #al-instruction,
    #al-instruction-view {
      position: relative;
      width: 100%;
      color: #ffffff;
      background:
        linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(24, 18, 51, 0.94)),
        radial-gradient(circle at 100% 0%, rgba(34, 211, 238, 0.12), transparent 32%);
      border: 1px solid rgba(96, 165, 250, 0.34);
      border-radius: 14px;
      box-shadow: inset 0 0 28px rgba(59, 130, 246, 0.08), 0 0 18px rgba(124, 58, 237, 0.08);
      clip-path: polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%);
    }

    #al-instruction {
      min-height: 86px;
      resize: vertical;
      padding: 12px;
      font: 13px/1.5 Inter, system-ui, sans-serif;
    }

    #al-instruction::placeholder {
      color: rgba(203, 213, 225, 0.58);
    }

    #al-instruction-view {
      display: none;
      padding: 14px 14px 14px 18px;
    }

    #al-instruction-view::before {
      position: absolute;
      left: 0;
      top: 14px;
      bottom: 14px;
      width: 3px;
      border-radius: 999px;
      background: linear-gradient(#22d3ee, #8b5cf6);
      content: "";
      box-shadow: 0 0 14px rgba(34, 211, 238, 0.72);
    }

    #al-instruction-text {
      color: #ffffff;
      font-size: 16px;
      font-weight: 850;
      line-height: 1.48;
    }

    #al-ai-suggestion-status {
      display: none;
      color: #93c5fd;
      font-size: 11px;
      line-height: 1.42;
    }

    #al-btn-save-step {
      width: 100%;
      padding: 8px 10px;
      background: linear-gradient(145deg, #16a34a, #059669);
      border: 1px solid rgba(74, 222, 128, 0.38);
      box-shadow: 0 0 18px rgba(34, 197, 94, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }

    #al-btn-prev,
    #al-btn-next {
      flex: 1;
      padding: 7px 10px;
      border: 1px solid transparent;
    }

    #al-btn-delete-step {
      width: 100%;
      padding: 7px 10px;
      background: linear-gradient(145deg, #be123c, #831843);
      border: 1px solid rgba(251, 113, 133, 0.36);
      box-shadow: 0 0 18px rgba(244, 63, 94, 0.14);
    }

    #al-btn-exit {
      display: none;
      width: 100%;
      padding: 7px 10px;
      background: rgba(15, 23, 42, 0.58);
      border: 1px solid rgba(125, 211, 252, 0.24);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    #al-btn-exit:hover:not(:disabled) {
      border-color: rgba(125, 211, 252, 0.52);
      box-shadow: 0 0 18px rgba(34, 211, 238, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }

    @media (max-width: 460px) {
      #al-panel {
        right: 12px;
        bottom: 12px;
        width: calc(100vw - 24px);
        padding: 15px;
      }

      .al-action-row {
        gap: 6px;
      }

      #al-btn-record,
      #al-btn-stop,
      #al-btn-play,
      #al-btn-clear {
        min-width: 0;
        font-size: 11px;
      }
    }
  </style>

  <div id="al-panel">
    <div class="al-panel-header">
      <div>
        <div class="al-panel-title">AccessLens Flow Recorder</div>
        <div id="al-context">Loading recording...</div>
      </div>
      <button id="al-btn-close" type="button" aria-label="Close AccessLens recorder" title="Close">&times;</button>
    </div>

    <div class="al-action-row">
      <button id="al-btn-record">Record</button>
      <button id="al-btn-stop" disabled>Finish</button>
      <button id="al-btn-play">Play</button>
      <button id="al-btn-clear">Clear</button>
    </div>

    <div id="al-status" role="status">Loading...</div>

    <div id="al-step-editor">
      <div class="al-step-header">
        <div>
          <div id="al-step-label"></div>
          <div id="al-step-target"></div>
        </div>
        <span id="al-step-save-state">Needs instruction</span>
      </div>
      <div id="al-instruction-editor">
        <label for="al-instruction">Instruction shown to the user</label>
        <button id="al-btn-suggest-instruction">Suggest with AI</button>
        <div id="al-ai-suggestion-status"></div>
        <textarea id="al-instruction" rows="3" maxlength="2000" placeholder="Example: Click Create account to begin registration."></textarea>
        <button id="al-btn-save-step">Save Step to Database</button>
      </div>
      <div id="al-instruction-view">
        <div class="al-instruction-kicker">Instruction</div>
        <div id="al-instruction-text"></div>
      </div>
      <div id="al-playback-nav">
        <button id="al-btn-prev">Previous</button>
        <button id="al-btn-next">Next</button>
      </div>
      <button id="al-btn-delete-step">Delete This Step</button>
      <button id="al-btn-exit">Exit Playback</button>
    </div>
  </div>
`;

const wrapper = document.createElement('div');
wrapper.innerHTML = panelHtml;
document.body.appendChild(wrapper);

let isRecording = false;
let isPlaying = false;
let steps = [];
let currentStepIndex = 0;
let highlightedElement = null;
let recordingSetup = null;
let isSaving = false;
let isSuggestingInstruction = false;
let suggestionRequestId = 0;

const btnRecord = document.getElementById('al-btn-record');
const btnClose = document.getElementById('al-btn-close');
const btnStop = document.getElementById('al-btn-stop');
const btnPlay = document.getElementById('al-btn-play');
const btnClear = document.getElementById('al-btn-clear');
const statusText = document.getElementById('al-status');
const contextText = document.getElementById('al-context');
const stepEditor = document.getElementById('al-step-editor');
const stepLabel = document.getElementById('al-step-label');
const stepTarget = document.getElementById('al-step-target');
const stepSaveState = document.getElementById('al-step-save-state');
const instructionEditor = document.getElementById('al-instruction-editor');
const instructionView = document.getElementById('al-instruction-view');
const instructionText = document.getElementById('al-instruction-text');
const playbackNav = document.getElementById('al-playback-nav');
const instructionInput = document.getElementById('al-instruction');
const aiSuggestionStatus = document.getElementById('al-ai-suggestion-status');
const btnSaveStep = document.getElementById('al-btn-save-step');
const btnSuggestInstruction = document.getElementById('al-btn-suggest-instruction');
const btnPrev = document.getElementById('al-btn-prev');
const btnNext = document.getElementById('al-btn-next');
const btnExit = document.getElementById('al-btn-exit');
const btnDeleteStep = document.getElementById('al-btn-delete-step');

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}

function recordingApi(path, options = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'AL_RECORDING_API', path, method: options.method || 'GET', body: options.body },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || 'Recording API request failed.'));
          return;
        }
        resolve(response.data);
      }
    );
  });
}

function getRecordingToken() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get(recordingTokenParam);
  if (token) {
    url.searchParams.delete(recordingTokenParam);
    window.history.replaceState(window.history.state, '', url.toString());
  }
  return token;
}

function cleanPageUrl(rawUrl = window.location.href) {
  const url = new URL(rawUrl);
  url.searchParams.delete(recordingTokenParam);
  return url.toString();
}

function escapeCss(value) {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function getCssPath(element) {
  if (!(element instanceof Element)) return '';
  if (element.id) return `${element.tagName.toLowerCase()}#${escapeCss(element.id)}`;

  if (element.getAttribute('name') && ['input', 'select', 'textarea'].includes(element.tagName.toLowerCase())) {
    return `${element.tagName.toLowerCase()}[name="${escapeCss(element.getAttribute('name'))}"]`;
  }

  const path = [];
  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
    let selector = current.nodeName.toLowerCase();
    const siblings = Array.from(current.parentElement?.children || []).filter((item) => item.nodeName === current.nodeName);
    if (siblings.length > 1) selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    path.unshift(selector);
    current = current.parentElement;
  }
  return `body > ${path.join(' > ')}`;
}

function getXPath(element) {
  if (!(element instanceof Element)) return null;
  if (element.id) return `//*[@id="${element.id.replace(/"/g, '\\"')}"]`;
  const parts = [];
  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const tag = current.nodeName.toLowerCase();
    const siblings = Array.from(current.parentElement?.children || []).filter((item) => item.nodeName === current.nodeName);
    parts.unshift(`${tag}[${Math.max(1, siblings.indexOf(current) + 1)}]`);
    if (current === document.body) break;
    current = current.parentElement;
  }
  return `/${parts.join('/')}`;
}

function extractLabel(element) {
  if (element.id) {
    const label = document.querySelector(`label[for="${escapeCss(element.id)}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim().slice(0, 300);
  }
  return (
    element.getAttribute('aria-label')
    || element.getAttribute('placeholder')
    || element.textContent
    || element.getAttribute('name')
    || element.tagName.toLowerCase()
  ).trim().replace(/\s+/g, ' ').slice(0, 300);
}

function normalizeAction(event, element) {
  if (event.type === 'change' && element.tagName.toLowerCase() === 'select') return 'select';
  if (event.type === 'change' && ['input', 'textarea'].includes(element.tagName.toLowerCase())) return 'input';
  return event.type === 'click' ? 'click' : 'change';
}

function toLocalStep(step) {
  return {
    stepOrder: step.step_order,
    pageUrl: step.page_url,
    pageTitle: step.page_title,
    action: step.action_type,
    selector: step.selector,
    xpath: step.xpath,
    label: step.element_label,
    instruction: step.instruction_text,
    metadata: step.element_metadata || {},
    saved: true
  };
}

async function persistLocalState() {
  await storageSet({
    accesslens_recording_setup: recordingSetup,
    al_isRecording: isRecording,
    al_isPlaying: isPlaying,
    al_playbackIndex: currentStepIndex,
    al_steps: steps
  });
}

function clearHighlight() {
  if (highlightedElement) {
    highlightedElement.style.outline = highlightedElement.dataset.alPreviousOutline || '';
    delete highlightedElement.dataset.alPreviousOutline;
    highlightedElement = null;
  }
}

function highlightCurrentStep() {
  clearHighlight();
  const step = steps[currentStepIndex];
  if (!step) return false;
  const target = document.querySelector(step.selector);
  if (target instanceof HTMLElement) {
    target.dataset.alPreviousOutline = target.style.outline;
    target.style.outline = '4px solid #ef4444';
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightedElement = target;
    return true;
  }
  return false;
}

function renderStepEditor(shouldHighlight = isPlaying) {
  const step = steps[currentStepIndex];
  const isCompleted = recordingSetup?.status === 'completed';
  if (!step || (isCompleted && !isPlaying)) {
    stepEditor.style.display = 'none';
    clearHighlight();
    return;
  }

  stepEditor.style.display = 'flex';
  stepLabel.textContent = `Step ${currentStepIndex + 1} of ${steps.length}`;
  stepTarget.textContent = `${step.action.toUpperCase()} - ${step.label}`;
  instructionInput.value = step.instruction || '';
  instructionText.textContent = step.instruction || 'No instruction was saved for this step.';
  stepSaveState.textContent = step.saved ? 'Saved' : 'Needs saving';
  stepSaveState.style.background = step.saved ? '#14532d' : '#78350f';
  stepSaveState.style.color = step.saved ? '#bbf7d0' : '#fde68a';
  btnSuggestInstruction.disabled = isSuggestingInstruction || isSaving;
  btnSuggestInstruction.textContent = isSuggestingInstruction ? 'Suggesting...' : 'Suggest with AI';
  instructionEditor.style.display = isPlaying ? 'none' : 'flex';
  instructionView.style.display = isPlaying ? 'block' : 'none';
  playbackNav.style.display = isPlaying ? 'flex' : 'none';
  btnDeleteStep.style.display = isPlaying ? 'none' : 'block';
  btnPrev.disabled = currentStepIndex === 0;
  btnNext.disabled = currentStepIndex === steps.length - 1;
  btnExit.style.display = isPlaying ? 'block' : 'none';
  if (shouldHighlight) {
    const highlighted = highlightCurrentStep();
    statusText.textContent = highlighted
      ? `Playing step ${currentStepIndex + 1} of ${steps.length}. Follow the instruction, then click Next.`
      : `Step ${currentStepIndex + 1} remains active. Click Next to continue on this page.`;
  }
}

function setAiSuggestionStatus(message, isError = false) {
  aiSuggestionStatus.style.display = message ? 'block' : 'none';
  aiSuggestionStatus.style.color = isError ? '#fca5a5' : '#93c5fd';
  aiSuggestionStatus.textContent = message || '';
}

async function suggestInstructionForCurrentStep({ automatic = false } = {}) {
  const step = steps[currentStepIndex];
  if (!recordingSetup?.sessionId || !step || step.saved || isSaving || isSuggestingInstruction) return;

  const originalInstruction = instructionInput.value;
  const requestId = suggestionRequestId + 1;
  suggestionRequestId = requestId;
  isSuggestingInstruction = true;
  setAiSuggestionStatus(automatic ? 'AI is drafting an instruction...' : 'Creating AI suggestion...');
  renderStepEditor(false);

  try {
    const data = await recordingApi(
      `/api/developer/recordings/${encodeURIComponent(recordingSetup.sessionId)}/instruction-suggestion`,
      {
        method: 'POST',
        body: {
          category: recordingSetup.category,
          siteName: recordingSetup.siteName,
          pageTitle: step.pageTitle,
          pageUrl: step.pageUrl,
          actionType: step.action,
          elementLabel: step.label,
          elementMetadata: step.metadata
        }
      }
    );
    const suggestion = (data?.suggestion || '').trim();
    if (!suggestion) throw new Error('AI did not return an instruction.');
    if (requestId !== suggestionRequestId) return;

    if (!instructionInput.value.trim() || instructionInput.value === originalInstruction) {
      step.instruction = suggestion;
      step.saved = false;
      instructionInput.value = suggestion;
      await persistLocalState();
      setAiSuggestionStatus('AI suggestion added. Edit it if needed, then save.');
    } else {
      setAiSuggestionStatus('AI suggestion ready, but your manual text was kept.');
    }
  } catch (error) {
    const fallback = step.action === 'input' || step.action === 'change'
      ? `Enter the required information in ${step.label}.`
      : step.action === 'select'
        ? `Select the correct option from ${step.label}.`
        : `Click ${step.label}.`;
    if (!instructionInput.value.trim()) {
      step.instruction = fallback;
      instructionInput.value = fallback;
      await persistLocalState();
    }
    setAiSuggestionStatus(`AI suggestion unavailable: ${error.message}`, true);
  } finally {
    if (requestId === suggestionRequestId) {
      isSuggestingInstruction = false;
      renderStepEditor(false);
    }
  }
}

function updateControls() {
  btnStop.disabled = !isRecording;
  btnPlay.disabled = steps.length === 0 || isRecording;
  btnClear.disabled = recordingSetup?.status === 'completed';
  btnRecord.disabled = isRecording || !recordingSetup || recordingSetup.status === 'completed';
  contextText.textContent = recordingSetup
    ? `${recordingSetup.category} - ${recordingSetup.baseDomain || new URL(recordingSetup.url).hostname}`
    : 'Start from the AccessLens Developer Console';
}

async function initialize() {
  const token = getRecordingToken();
  const stored = await storageGet([
    'accesslens_recording_setup', 'al_isRecording', 'al_isPlaying', 'al_playbackIndex', 'al_steps'
  ]);

  recordingSetup = stored.accesslens_recording_setup || null;
  steps = Array.isArray(stored.al_steps) ? stored.al_steps : [];
  currentStepIndex = Number(stored.al_playbackIndex) || 0;
  isPlaying = Boolean(stored.al_isPlaying);
  isRecording = Boolean(stored.al_isRecording);
  const storedStepIndex = currentStepIndex;
  const storedIsPlaying = isPlaying;

  const sessionId = token || recordingSetup?.sessionId;
  if (sessionId) {
    try {
      const storedSessionId = recordingSetup?.sessionId;
      const localSteps = storedSessionId === sessionId ? steps : [];
      const data = await recordingApi(`/api/developer/recordings/${encodeURIComponent(sessionId)}`);
      const session = data.session;
      recordingSetup = {
        sessionId: session.id,
        requestId: session.website_request_id,
        category: session.category,
        siteName: session.site_name,
        url: session.site_url,
        baseDomain: session.base_domain,
        startedAt: session.started_at,
        status: session.status
      };
      const mergedSteps = new Map(session.steps.map((step) => [step.step_order, toLocalStep(step)]));
      localSteps.forEach((step) => {
        if (!step.saved || !mergedSteps.has(step.stepOrder)) mergedSteps.set(step.stepOrder, step);
      });
      steps = Array.from(mergedSteps.values()).sort((left, right) => left.stepOrder - right.stepOrder);
      isRecording = session.status === 'recording';
      isPlaying = session.status === 'completed' && storedSessionId === session.id && storedIsPlaying;
      currentStepIndex = isPlaying
        ? Math.min(Math.max(0, storedStepIndex), Math.max(0, steps.length - 1))
        : Math.max(0, steps.length - 1);
      await persistLocalState();
    } catch (error) {
      isRecording = false;
      isPlaying = false;
      statusText.textContent = `Could not load recording: ${error.message}`;
    }
  }

  if (isRecording) {
    document.addEventListener('change', handleRecordEvent, true);
    document.addEventListener('click', handleRecordEvent, true);
    statusText.textContent = `Recording (${steps.length} steps). Perform an action, then add its instruction.`;
  } else if (isPlaying && steps.length) {
    statusText.textContent = `Playing step ${currentStepIndex + 1} of ${steps.length}.`;
  } else if (steps.length) {
    statusText.textContent = `Recording has ${steps.length} saved step${steps.length === 1 ? '' : 's'}.`;
  } else {
    statusText.textContent = recordingSetup ? 'Ready to record.' : 'Open a recording from the Developer Console.';
  }
  updateControls();
  renderStepEditor();
}

function handleRecordEvent(event) {
  if (!isRecording || !(event.target instanceof Element) || event.target.closest('#al-panel')) return;
  const pendingStepIndex = steps.findIndex((step) => !step.saved);
  if (pendingStepIndex >= 0) {
    currentStepIndex = pendingStepIndex;
    statusText.textContent = `Save or delete step ${pendingStepIndex + 1} before recording another action.`;
    renderStepEditor(false);
    return;
  }
  const element = event.target;
  const tagName = element.tagName.toLowerCase();
  const validTags = ['input', 'select', 'textarea', 'button', 'a', 'label', 'div', 'span', 'td', 'li'];
  if (!validTags.includes(tagName) && element.getAttribute('role') !== 'button') return;

  const selector = getCssPath(element);
  const action = normalizeAction(event, element);
  const previous = steps[steps.length - 1];
  if (previous && previous.selector === selector && previous.action === action) return;

  const step = {
    stepOrder: steps.length + 1,
    pageUrl: cleanPageUrl(),
    pageTitle: document.title.slice(0, 300),
    action,
    selector,
    xpath: getXPath(element),
    label: extractLabel(element),
    instruction: '',
    metadata: {
      tagName,
      inputType: element.getAttribute('type') || null,
      role: element.getAttribute('role'),
      name: element.getAttribute('name'),
      required: element.hasAttribute('required')
    },
    saved: false
  };
  steps.push(step);
  currentStepIndex = steps.length - 1;
  isPlaying = false;
  void persistLocalState();
  statusText.textContent = `Step ${step.stepOrder} captured. Add its instruction and save it.`;
  updateControls();
  renderStepEditor();
  void suggestInstructionForCurrentStep({ automatic: true });
}

async function saveCurrentStep() {
  const step = steps[currentStepIndex];
  const instruction = instructionInput.value.trim();
  if (!recordingSetup?.sessionId || !step || !instruction || isSaving) {
    statusText.textContent = !instruction ? 'Enter an instruction before saving this step.' : 'No active recording session.';
    instructionInput.focus();
    return;
  }

  isSaving = true;
  btnSaveStep.disabled = true;
  btnSaveStep.textContent = 'Saving...';
  try {
    await recordingApi(
      `/api/developer/recordings/${encodeURIComponent(recordingSetup.sessionId)}/steps/${step.stepOrder}`,
      {
        method: 'PUT',
        body: {
          pageUrl: step.pageUrl,
          pageTitle: step.pageTitle,
          actionType: step.action,
          selector: step.selector,
          xpath: step.xpath,
          elementLabel: step.label,
          instructionTitle: `Step ${step.stepOrder}: ${step.label}`.slice(0, 300),
          instructionText: instruction,
          elementMetadata: step.metadata
        }
      }
    );
    step.instruction = instruction;
    step.saved = true;
    await persistLocalState();
    statusText.textContent = `Step ${step.stepOrder} saved to the database.`;
    renderStepEditor();
  } catch (error) {
    statusText.textContent = `Could not save step: ${error.message}`;
  } finally {
    isSaving = false;
    btnSaveStep.disabled = false;
    btnSaveStep.textContent = 'Save Step to Database';
  }
}

instructionInput.addEventListener('input', () => {
  const step = steps[currentStepIndex];
  if (!step) return;
  step.instruction = instructionInput.value;
  step.saved = false;
  void persistLocalState();
  renderStepEditor(false);
});

btnSaveStep.addEventListener('click', () => void saveCurrentStep());
btnSuggestInstruction.addEventListener('click', () => void suggestInstructionForCurrentStep());

btnRecord.addEventListener('click', () => {
  if (!recordingSetup?.sessionId || recordingSetup.status === 'completed') {
    statusText.textContent = recordingSetup?.status === 'completed'
      ? 'This recording is completed. Start a new recording from the Developer Console.'
      : 'Start this recording from the Developer Console.';
    return;
  }
  isRecording = true;
  isPlaying = false;
  document.addEventListener('change', handleRecordEvent, true);
  document.addEventListener('click', handleRecordEvent, true);
  void persistLocalState();
  statusText.textContent = `Recording (${steps.length} steps).`;
  updateControls();
});

btnStop.addEventListener('click', async () => {
  const incompleteIndex = steps.findIndex((step) => !step.saved || !step.instruction.trim());
  if (steps.length === 0 || incompleteIndex >= 0) {
    currentStepIndex = Math.max(0, incompleteIndex);
    renderStepEditor();
    statusText.textContent = steps.length === 0
      ? 'Record and save at least one step before finishing.'
      : `Save the instruction for step ${incompleteIndex + 1} before finishing.`;
    return;
  }

  try {
    await recordingApi(`/api/developer/recordings/${encodeURIComponent(recordingSetup.sessionId)}`, {
      method: 'PATCH', body: { status: 'completed' }
    });
    isRecording = false;
    recordingSetup.status = 'completed';
    document.removeEventListener('change', handleRecordEvent, true);
    document.removeEventListener('click', handleRecordEvent, true);
    await persistLocalState();
    statusText.textContent = `Recording completed. Returning to the first recorded page...`;
    updateControls();
    renderStepEditor(false);
    const firstPageUrl = steps[0].pageUrl;
    if (cleanPageUrl() !== firstPageUrl) {
      window.location.assign(firstPageUrl);
    } else {
      statusText.textContent = `Recording completed. Click Play to start from step 1.`;
    }
  } catch (error) {
    statusText.textContent = `Could not finish recording: ${error.message}`;
  }
});

btnPlay.addEventListener('click', async () => {
  if (!steps.length) return;
  isPlaying = true;
  currentStepIndex = 0;
  statusText.textContent = 'Opening step 1...';
  await persistLocalState();
  updateControls();
  if (cleanPageUrl() !== steps[0].pageUrl) {
    window.location.assign(steps[0].pageUrl);
  } else {
    renderStepEditor(true);
  }
});

btnPrev.addEventListener('click', async () => {
  if (currentStepIndex > 0) currentStepIndex--;
  await persistLocalState();
  const stepPageUrl = steps[currentStepIndex]?.pageUrl;
  if (isPlaying && stepPageUrl && cleanPageUrl() !== stepPageUrl) {
    window.location.assign(stepPageUrl);
  } else {
    renderStepEditor(isPlaying);
  }
});

btnNext.addEventListener('click', async () => {
  if (currentStepIndex < steps.length - 1) currentStepIndex++;
  await persistLocalState();
  const stepPageUrl = steps[currentStepIndex]?.pageUrl;
  if (isPlaying && stepPageUrl && cleanPageUrl() !== stepPageUrl) {
    window.location.assign(stepPageUrl);
  } else {
    renderStepEditor(isPlaying);
  }
});

btnExit.addEventListener('click', () => {
  isPlaying = false;
  clearHighlight();
  void persistLocalState();
  statusText.textContent = `${steps.length} recorded steps.`;
  updateControls();
  renderStepEditor(false);
});

btnDeleteStep.addEventListener('click', async () => {
  const step = steps[currentStepIndex];
  if (!step || isSaving || !recordingSetup?.sessionId) return;
  try {
    await recordingApi(
      `/api/developer/recordings/${encodeURIComponent(recordingSetup.sessionId)}/steps/${step.stepOrder}`,
      { method: 'DELETE' }
    );
    const removedOrder = step.stepOrder;
    steps.splice(currentStepIndex, 1);
    steps.forEach((remainingStep, index) => { remainingStep.stepOrder = index + 1; });
    currentStepIndex = Math.min(currentStepIndex, Math.max(0, steps.length - 1));
    await persistLocalState();
    statusText.textContent = `Step ${removedOrder} deleted from the database.`;
  } catch (error) {
    statusText.textContent = `Could not delete step: ${error.message}`;
  }
  updateControls();
  renderStepEditor();
});

btnClear.addEventListener('click', async () => {
  try {
    if (recordingSetup?.sessionId) {
      await recordingApi(`/api/developer/recordings/${encodeURIComponent(recordingSetup.sessionId)}/steps`, { method: 'DELETE' });
    }
    steps = [];
    currentStepIndex = 0;
    clearHighlight();
    await persistLocalState();
    statusText.textContent = 'All recorded steps cleared.';
    updateControls();
    renderStepEditor();
  } catch (error) {
    statusText.textContent = `Could not clear database steps: ${error.message}`;
  }
});

btnClose.addEventListener('click', () => {
  document.removeEventListener('change', handleRecordEvent, true);
  document.removeEventListener('click', handleRecordEvent, true);
  clearHighlight();
  wrapper.remove();
});

void initialize();
