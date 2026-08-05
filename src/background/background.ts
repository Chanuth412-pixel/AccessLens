import type { WorkflowProgress } from "../types/instruction";

type AccessLensWindowSession = {
  id: string;
  tabId: number;
  templateName: string;
  fields: unknown[];
  values: Record<string, string>;
  language: "en" | "si";
};

type RuntimeMessage = {
  type: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  session?: Omit<AccessLensWindowSession, "id" | "tabId">;
  sessionId?: string;
  values?: Record<string, string>;
  progress?: WorkflowProgress;
  draftKey?: string;
  draftValues?: Record<string, string>;
};

declare const chrome: {
  runtime: {
    lastError?: { message?: string };
    getURL: (path: string) => string;
    onMessage: {
      addListener: (
        callback: (
          message: RuntimeMessage,
          sender: { tab?: { id?: number } },
          sendResponse: (response: unknown) => void
        ) => boolean | void
      ) => void;
    };
  };
  storage: {
    session: {
      get: (
        key: string,
        callback: (items: Record<string, WorkflowProgress | undefined>) => void
      ) => void;
      set: (items: Record<string, WorkflowProgress>, callback: () => void) => void;
      remove: (key: string, callback: () => void) => void;
    };
    local: {
      get: (
        key: string,
        callback: (items: Record<string, Record<string, string> | undefined>) => void
      ) => void;
      set: (items: Record<string, Record<string, string>>, callback: () => void) => void;
      remove: (key: string, callback: () => void) => void;
    };
  };
  tabs: {
    sendMessage: (
      tabId: number,
      message: RuntimeMessage,
      callback: (response: unknown) => void
    ) => void;
  };
  windows: {
    create: (
      options: { url: string; type: "popup"; width: number; height: number; focused: boolean },
      callback?: () => void
    ) => void;
  };
};

const workflowProgressStorageKey = "accesslens-workflow-progress";

function createSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getSessionKey(sessionId: string) {
  return `accesslens-window:${sessionId}`;
}

// Personal form values stay in extension memory only. Workflow ordering state is
// stored separately by the content script and never includes these values.
const windowSessions = new Map<string, AccessLensWindowSession>();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_LOCAL_DRAFT" && message.draftKey) {
    const key = message.draftKey;
    chrome.storage.local.get(key, (items) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message || "Could not read local draft." });
        return;
      }
      sendResponse({ ok: true, values: items?.[key] ?? null });
    });
    return true;
  }

  if (message.type === "SAVE_LOCAL_DRAFT" && message.draftKey && message.draftValues) {
    const key = message.draftKey;
    const values = message.draftValues;
    chrome.storage.local.set({ [key]: values }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message || "Could not save local draft." });
        return;
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "CLEAR_LOCAL_DRAFT" && message.draftKey) {
    const key = message.draftKey;
    chrome.storage.local.remove(key, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message || "Could not clear local draft." });
        return;
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "GET_WORKFLOW_PROGRESS") {
    chrome.storage.session.get(workflowProgressStorageKey, (items) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message || "Could not read workflow progress." });
        return;
      }

      sendResponse({ ok: true, progress: items?.[workflowProgressStorageKey] ?? null });
    });
    return true;
  }

  if (message.type === "SAVE_WORKFLOW_PROGRESS" && message.progress) {
    chrome.storage.session.set({ [workflowProgressStorageKey]: message.progress }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message || "Could not save workflow progress." });
        return;
      }

      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "CLEAR_WORKFLOW_PROGRESS") {
    chrome.storage.session.remove(workflowProgressStorageKey, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message || "Could not clear workflow progress." });
        return;
      }

      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "FETCH_API" && message.url) {
    fetch(message.url, {
      method: message.method || "GET",
      headers: message.headers || {},
      body: message.body ? JSON.stringify(message.body) : undefined
    })
      .then(async (res) => {
        const text = await res.text();
        let data: unknown = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
        sendResponse({ ok: res.ok, status: res.status, data });
      })
      .catch((error: Error) => {
        sendResponse({ ok: false, status: 0, error: error.message });
      });
    return true;
  }

  if (message.type === "OPEN_ACCESSLENS_WINDOW" && message.session) {
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ ok: false, error: "Could not identify the current tab." });
      return;
    }

    const id = createSessionId();
    const session: AccessLensWindowSession = { ...message.session, id, tabId };
    windowSessions.set(getSessionKey(id), session);
    chrome.windows.create({
      url: chrome.runtime.getURL(`openPanel.html?sessionId=${encodeURIComponent(id)}`),
      type: "popup",
      width: 520,
      height: 760,
      focused: true
    });
    sendResponse({ ok: true, sessionId: id });
    return true;
  }

  if (message.type === "GET_ACCESSLENS_WINDOW_SESSION" && message.sessionId) {
    const session = windowSessions.get(getSessionKey(message.sessionId));
    sendResponse(session ? { ok: true, session } : { ok: false, error: "Session not found." });
    return true;
  }

  if (message.type === "ACCESSLENS_FILL_VALUES" && message.sessionId && message.values) {
    const session = windowSessions.get(getSessionKey(message.sessionId));
    if (!session) {
      sendResponse({ ok: false, error: "Session not found." });
      return;
    }

    chrome.tabs.sendMessage(
      session.tabId,
      { type: "ACCESSLENS_FILL_VALUES", values: message.values },
      (response) => sendResponse(response ?? { ok: false, error: "Original page did not respond." })
    );
    return true;
  }
});
