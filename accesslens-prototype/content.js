// content.js

// 1. Inject the Floating UI
const panelHtml = `
  <div id="al-panel" style="position: fixed; bottom: 20px; right: 20px; width: 300px; background: rgba(30, 41, 59, 0.95); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; padding: 16px; z-index: 9999999; display: flex; flex-direction: column; gap: 12px;">
    <div style="font-weight: 600; font-size: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 8px;">AccessLens PoC</div>
    <div style="display: flex; gap: 8px;">
      <button id="al-btn-record" style="flex: 1; padding: 8px 12px; background: #ef4444; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 500;">Record</button>
      <button id="al-btn-stop" style="flex: 1; padding: 8px 12px; background: #64748b; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 500;" disabled>Stop</button>
      <button id="al-btn-play" style="flex: 1; padding: 8px 12px; background: #3b82f6; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 500;">Play</button>
    </div>
    <div id="al-status" style="font-size: 13px; color: #94a3b8;">Status: Idle</div>
    <div id="al-playback-ui" style="display: none; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 12px; flex-direction: column; gap: 8px;">
      <div id="al-step-label" style="font-size: 13px; color: #e2e8f0; font-weight: 500; margin-bottom: 4px;">Step 1: Click/Fill "Input"</div>
      <div style="display: flex; gap: 8px;">
        <button id="al-btn-prev" style="flex: 1; padding: 6px 10px; background: #475569; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;" disabled>Prev</button>
        <button id="al-btn-next" style="flex: 1; padding: 6px 10px; background: #475569; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;" disabled>Next</button>
      </div>
    </div>
  </div>
`;

const wrapper = document.createElement('div');
wrapper.innerHTML = panelHtml;
document.body.appendChild(wrapper);

// 2. State Variables
let isRecording = false;
let steps = JSON.parse(localStorage.getItem('al_poc_steps')) || [];
let currentPlaybackIndex = 0;
let highlightedElement = null;

// UI Elements
const btnRecord = document.getElementById('al-btn-record');
const btnStop = document.getElementById('al-btn-stop');
const btnPlay = document.getElementById('al-btn-play');
const statusText = document.getElementById('al-status');
const playbackUi = document.getElementById('al-playback-ui');
const stepLabel = document.getElementById('al-step-label');
const btnPrev = document.getElementById('al-btn-prev');
const btnNext = document.getElementById('al-btn-next');

// 3. Helper: Generate unique CSS path
function getCssPath(el) {
  if (!(el instanceof Element)) return;
  const path = [];
  while (el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector += '#' + el.id;
      path.unshift(selector);
      break;
    } else {
      let sib = el, nth = 1;
      while (sib = sib.previousElementSibling) {
        if (sib.nodeName.toLowerCase() == selector) nth++;
      }
      if (nth != 1) selector += `:nth-of-type(${nth})`;
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join(" > ");
}

// 4. Helper: Extract Label
function extractLabel(el) {
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.innerText.trim();
  }
  return el.placeholder || el.innerText?.substring(0, 30) || el.name || 'Input Field';
}

// 5. Recording Logic
const handleRecordEvent = (e) => {
  if (!isRecording) return;
  
  // Ignore clicks inside the AccessLens panel
  if (e.target.closest('#al-panel')) return;

  const tagName = e.target.tagName.toLowerCase();
  const validTags = ['input', 'select', 'textarea', 'button', 'a'];
  
  if (validTags.includes(tagName) || e.target.getAttribute('role') === 'button') {
    const selector = getCssPath(e.target);
    const label = extractLabel(e.target);
    
    // Prevent immediate duplicates
    if (steps.length > 0 && steps[steps.length - 1].selector === selector) return;

    steps.push({ selector, label, action: e.type });
    localStorage.setItem('al_poc_steps', JSON.stringify(steps));
    statusText.innerText = `Status: Recording (Captured ${steps.length} steps)`;
  }
};

// 6. Playback Logic
function renderStep(index) {
  if (highlightedElement) {
    highlightedElement.style.outline = ''; // Remove previous highlight
  }

  const step = steps[index];
  stepLabel.innerText = `Step ${index + 1}: Click/Fill "${step.label}"`;
  btnPrev.disabled = index === 0;
  btnNext.disabled = index === steps.length - 1;

  const target = document.querySelector(step.selector);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.outline = '4px solid #ef4444'; // Red highlight
    highlightedElement = target;
  }
}

// 7. Event Listeners for UI
btnRecord.addEventListener('click', () => {
  isRecording = true;
  steps = [];
  localStorage.removeItem('al_poc_steps');
  btnRecord.disabled = true;
  btnPlay.disabled = true;
  btnStop.disabled = false;
  playbackUi.style.display = 'none';
  statusText.innerText = 'Status: Recording...';
  
  document.addEventListener('change', handleRecordEvent, true);
  document.addEventListener('click', handleRecordEvent, true);
});

btnStop.addEventListener('click', () => {
  isRecording = false;
  btnRecord.disabled = false;
  btnPlay.disabled = false;
  btnStop.disabled = true;
  statusText.innerText = `Status: Saved ${steps.length} steps`;
  
  document.removeEventListener('change', handleRecordEvent, true);
  document.removeEventListener('click', handleRecordEvent, true);
});

btnPlay.addEventListener('click', () => {
  if (steps.length === 0) {
    alert("No steps recorded yet.");
    return;
  }
  playbackUi.style.display = 'flex';
  statusText.innerText = 'Status: Playing Guide';
  currentPlaybackIndex = 0;
  renderStep(currentPlaybackIndex);
});

btnPrev.addEventListener('click', () => renderStep(--currentPlaybackIndex));
btnNext.addEventListener('click', () => renderStep(++currentPlaybackIndex));
