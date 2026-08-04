// content.js

// 1. Inject the Floating UI
const panelHtml = `
  <div id="al-panel" style="position: fixed; bottom: 20px; right: 20px; width: 320px; background: rgba(30, 41, 59, 0.95); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; padding: 16px; z-index: 2147483647; display: flex; flex-direction: column; gap: 12px;">
    <div style="font-weight: 600; font-size: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 8px;">AccessLens PoC (Debug Mode)</div>
    <div style="display: flex; gap: 6px;">
      <button id="al-btn-record" style="flex: 1; padding: 8px 4px; background: #ef4444; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 500; font-size: 12px;">Record</button>
      <button id="al-btn-stop" style="flex: 1; padding: 8px 4px; background: #64748b; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 500; font-size: 12px;" disabled>Stop</button>
      <button id="al-btn-play" style="flex: 1; padding: 8px 4px; background: #3b82f6; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 500; font-size: 12px;">Play</button>
      <button id="al-btn-clear" style="flex: 1; padding: 8px 4px; background: #475569; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 500; font-size: 12px;">Clear All</button>
    </div>
    <div id="al-status" style="font-size: 13px; color: #94a3b8;">Status: Idle</div>
    
    <div id="al-playback-ui" style="display: none; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 12px; flex-direction: column; gap: 8px;">
      <div id="al-step-label" style="font-size: 13px; color: #e2e8f0; font-weight: 500; margin-bottom: 4px;"></div>
      <div style="display: flex; gap: 8px;">
        <button id="al-btn-prev" style="flex: 1; padding: 6px 10px; background: #475569; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;" disabled>Prev</button>
        <button id="al-btn-next" style="flex: 1; padding: 6px 10px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;" disabled>Next</button>
      </div>
      <button id="al-btn-delete-step" style="width: 100%; padding: 6px 10px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px; margin-top: 4px;">Delete This Step</button>
      <button id="al-btn-exit" style="width: 100%; padding: 6px 10px; background: #64748b; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px; margin-top: 4px;">Exit Guide</button>
    </div>
  </div>
`;

const wrapper = document.createElement('div');
wrapper.innerHTML = panelHtml;
document.body.appendChild(wrapper);

// State Variables
let isRecording = false;
let isPlaying = false;
let steps = [];
let currentPlaybackIndex = 0;
let highlightedElement = null;

// UI References
const btnRecord = document.getElementById('al-btn-record');
const btnStop = document.getElementById('al-btn-stop');
const btnPlay = document.getElementById('al-btn-play');
const btnClear = document.getElementById('al-btn-clear');
const statusText = document.getElementById('al-status');
const playbackUi = document.getElementById('al-playback-ui');
const stepLabel = document.getElementById('al-step-label');
const btnPrev = document.getElementById('al-btn-prev');
const btnNext = document.getElementById('al-btn-next');
const btnExit = document.getElementById('al-btn-exit');
const btnDeleteStep = document.getElementById('al-btn-delete-step');

// Helper: Smart CSS Selector Generator (Foolproof string version)
function getCssPath(el) {
  if (!(el instanceof Element)) return;

  // 1. Safe ID check (Fixes the 'a#6' crash)
  if (el.id) {
    return el.tagName.toLowerCase() + '[id="' + el.id + '"]';
  }

  // 2. Use the 'name' attribute for forms
  if (el.name && ['input', 'select', 'textarea'].includes(el.tagName.toLowerCase())) {
    let nameSelector = el.tagName.toLowerCase() + '[name="' + el.name + '"]';
    if (el.type === 'radio' || el.type === 'checkbox') {
      nameSelector += '[value="' + el.value + '"]';
    }
    return nameSelector;
  }

  // 3. Fallback: Build path
  const path = [];
  let current = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.nodeName.toLowerCase();

    if (current.id) {
      selector += '[id="' + current.id + '"]';
      path.unshift(selector);
      break; 
    } else {
      let sib = current;
      let nth = 1;
      while ((sib = sib.previousElementSibling)) {
        if (sib.nodeName.toLowerCase() === selector) nth++;
      }
      if (nth !== 1) selector += ':nth-of-type(' + nth + ')';
    }
    path.unshift(selector);
    current = current.parentNode;
  }
  return path.join(" > ");
}

// Helper: Label Extractor
function extractLabel(el) {
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.innerText.trim();
  }
  return el.placeholder || el.innerText?.substring(0, 30) || el.name || el.tagName.toLowerCase();
}

// 2. Initialize
chrome.storage.local.get(['al_isRecording', 'al_isPlaying', 'al_playbackIndex', 'al_steps'], (result) => {
  console.log('[AccessLens] Storage Loaded:', result);
  
  isRecording = result.al_isRecording || false;
  isPlaying = result.al_isPlaying || false;
  currentPlaybackIndex = result.al_playbackIndex || 0;
  steps = result.al_steps || [];

  if (isRecording) {
    btnRecord.disabled = true;
    btnPlay.disabled = true;
    btnStop.disabled = false;
    statusText.innerText = `Status: Recording (${steps.length} steps)`;
    document.addEventListener('change', handleRecordEvent, true);
    document.addEventListener('click', handleRecordEvent, true);
  } else if (isPlaying && steps.length > 0) {
    handlePlaybackState();
  } else if (steps.length > 0) {
    statusText.innerText = `Status: Saved ${steps.length} steps`;
  } else {
    statusText.innerText = `Status: Idle (0 steps)`;
  }
});

// 3. Recording Event Handler (Updated with logs and broader capture)
const handleRecordEvent = (e) => {
  if (!isRecording) return;
  
  if (e.target.closest('#al-panel')) {
    console.log('[AccessLens] Ignored: Clicked inside the AccessLens control panel.');
    return;
  }

  const target = e.target;
  const tagName = target.tagName.toLowerCase();
  
  console.log(`[AccessLens] Event intercepted: Type=${e.type}, Tag=${tagName}`);

  // Broadened valid tags to include generic containers if they trigger a click
  const validTags = ['input', 'select', 'textarea', 'button', 'a', 'label', 'div', 'span', 'td', 'li'];
  
  if (validTags.includes(tagName) || target.getAttribute('role') === 'button') {
    const selector = getCssPath(target);
    const label = extractLabel(target);
    
    // Check for duplicates
    if (steps.length > 0 && steps[steps.length - 1].selector === selector) {
      console.log(`[AccessLens] Ignored duplicate event for selector: ${selector}`);
      return;
    }

    const newStep = { 
      selector, 
      label, 
      action: e.type, 
      url: window.location.href 
    };
    
    steps.push(newStep);
    console.log(`[AccessLens] Step Captured!`, newStep);
    
    chrome.storage.local.set({ al_steps: steps }, () => {
      statusText.innerText = `Status: Recording (${steps.length} steps)`;
    });
  } else {
    console.warn(`[AccessLens] Ignored event on unsupported tag: ${tagName}`);
  }
};

// 4. Playback Logic (Updated with logs)
function handlePlaybackState() {
  const currentStep = steps[currentPlaybackIndex];
  if (!currentStep) return;

  console.log(`[AccessLens] Playing Step ${currentPlaybackIndex + 1}:`, currentStep);

  if (window.location.href !== currentStep.url) {
    console.log(`[AccessLens] Redirecting... Current URL: ${window.location.href}, Expected URL: ${currentStep.url}`);
    statusText.innerText = `Status: Navigating to step page...`;
    window.location.href = currentStep.url;
    return;
  }

  playbackUi.style.display = 'flex';
  statusText.innerText = 'Status: Playing Guide';
  stepLabel.innerText = `Step ${currentPlaybackIndex + 1}/${steps.length}: "${currentStep.label}"`;
  
  btnPrev.disabled = currentPlaybackIndex === 0;
  btnNext.disabled = currentPlaybackIndex === steps.length - 1;

  if (highlightedElement) highlightedElement.style.outline = '';
  
  setTimeout(() => {
    const target = document.querySelector(currentStep.selector);
    if (target) {
      console.log(`[AccessLens] Element found for playback:`, target);
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.style.outline = '4px solid #ef4444';
      highlightedElement = target;
    } else {
      console.error(`[AccessLens] Failed to find element with selector: ${currentStep.selector}`);
      stepLabel.innerText += " (Element not found on this page)";
    }
  }, 500);
}

// 5. Button Listeners (Logs added)
btnRecord.addEventListener('click', () => {
  console.log('[AccessLens] Started Recording');
  isRecording = true;
  isPlaying = false;
  steps = [];
  chrome.storage.local.set({ al_isRecording: true, al_isPlaying: false, al_steps: [], al_playbackIndex: 0 });
  
  btnRecord.disabled = true;
  btnPlay.disabled = true;
  btnStop.disabled = false;
  playbackUi.style.display = 'none';
  statusText.innerText = 'Status: Recording...';
  
  document.addEventListener('change', handleRecordEvent, true);
  document.addEventListener('click', handleRecordEvent, true);
});

btnStop.addEventListener('click', () => {
  console.log('[AccessLens] Stopped Recording');
  isRecording = false;
  chrome.storage.local.set({ al_isRecording: false });
  
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
  console.log('[AccessLens] Started Playback');
  isPlaying = true;
  currentPlaybackIndex = 0;
  
  chrome.storage.local.set({ al_isPlaying: true, al_playbackIndex: 0 }, () => {
    handlePlaybackState();
  });
});

btnClear.addEventListener('click', () => {
  console.log('[AccessLens] Cleared all steps');
  isRecording = false;
  isPlaying = false;
  steps = [];
  currentPlaybackIndex = 0;

  if (highlightedElement) {
    highlightedElement.style.outline = '';
    highlightedElement = null;
  }

  document.removeEventListener('change', handleRecordEvent, true);
  document.removeEventListener('click', handleRecordEvent, true);

  chrome.storage.local.set({
    al_isRecording: false,
    al_isPlaying: false,
    al_playbackIndex: 0,
    al_steps: []
  }, () => {
    btnRecord.disabled = false;
    btnPlay.disabled = false;
    btnStop.disabled = true;
    playbackUi.style.display = 'none';
    statusText.innerText = 'Status: Cleared (0 steps)';
  });
});

btnNext.addEventListener('click', () => {
  if (currentPlaybackIndex < steps.length - 1) {
    currentPlaybackIndex++;
    chrome.storage.local.set({ al_playbackIndex: currentPlaybackIndex }, () => {
      handlePlaybackState();
    });
  }
});

btnPrev.addEventListener('click', () => {
  if (currentPlaybackIndex > 0) {
    currentPlaybackIndex--;
    chrome.storage.local.set({ al_playbackIndex: currentPlaybackIndex }, () => {
      handlePlaybackState();
    });
  }
});

btnExit.addEventListener('click', () => {
  console.log('[AccessLens] Exited Playback');
  isPlaying = false;
  chrome.storage.local.set({ al_isPlaying: false, al_playbackIndex: 0 });
  if (highlightedElement) highlightedElement.style.outline = '';
  playbackUi.style.display = 'none';
  statusText.innerText = `Status: Saved ${steps.length} steps`;
});

btnDeleteStep.addEventListener('click', () => {
  console.log(`[AccessLens] Deleting step ${currentPlaybackIndex + 1}`);
  
  // Remove the current step from the array
  steps.splice(currentPlaybackIndex, 1);
  
  // If we just deleted the last step, we need to exit playback entirely
  if (steps.length === 0) {
    btnExit.click(); 
    statusText.innerText = `Status: Cleared (0 steps)`;
    chrome.storage.local.set({ al_steps: [] });
    return;
  }
  
  // If we deleted the very last item in a multi-step sequence, move the index back by one
  if (currentPlaybackIndex >= steps.length) {
    currentPlaybackIndex = steps.length - 1;
  }

  // Save the updated array and re-render the UI
  chrome.storage.local.set({ 
    al_steps: steps, 
    al_playbackIndex: currentPlaybackIndex 
  }, () => {
    handlePlaybackState();
    statusText.innerText = 'Status: Playing Guide';
  });
});
