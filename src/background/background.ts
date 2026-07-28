type AccessLensWindowSession = {
  id: string;
  tabId: number;
  templateName: string;
  fields: unknown[];
  values: Record<string, string>;
  language: "en" | "si";
  isRuntimeAiTemplate: boolean;
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
};

declare const chrome: {
  runtime: {
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
    local: {
      get: (
        key: string,
        callback: (items: Record<string, AccessLensWindowSession | undefined>) => void
      ) => void;
      set: (items: Record<string, AccessLensWindowSession>, callback?: () => void) => void;
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

function createSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getSessionKey(sessionId: string) {
  return `accesslens-window:${sessionId}`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    chrome.storage.local.set({ [getSessionKey(id)]: session }, () => {
      chrome.windows.create({
        url: chrome.runtime.getURL(`openPanel.html?sessionId=${encodeURIComponent(id)}`),
        type: "popup",
        width: 520,
        height: 760,
        focused: true
      });
      sendResponse({ ok: true, sessionId: id });
    });
    return true;
  }

  if (message.type === "GET_ACCESSLENS_WINDOW_SESSION" && message.sessionId) {
    chrome.storage.local.get(getSessionKey(message.sessionId), (items) => {
      const session = items[getSessionKey(message.sessionId as string)];
      sendResponse(session ? { ok: true, session } : { ok: false, error: "Session not found." });
    });
    return true;
  }

  if (message.type === "ACCESSLENS_FILL_VALUES" && message.sessionId && message.values) {
    chrome.storage.local.get(getSessionKey(message.sessionId), (items) => {
      const session = items[getSessionKey(message.sessionId as string)];
      if (!session) {
        sendResponse({ ok: false, error: "Session not found." });
        return;
      }

      chrome.tabs.sendMessage(
        session.tabId,
        { type: "ACCESSLENS_FILL_VALUES", values: message.values },
        (response) => sendResponse(response ?? { ok: false, error: "Original page did not respond." })
      );
    });
    return true;
  }
});
