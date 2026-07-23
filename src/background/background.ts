declare const chrome: {
  runtime: {
    onMessage: {
      addListener: (
        callback: (
          message: { type: string; url: string; method?: string; headers?: Record<string, string>; body?: unknown },
          sender: unknown,
          sendResponse: (response: unknown) => void
        ) => boolean | void
      ) => void;
    };
  };
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "FETCH_API") {
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
    return true; // async response
  }
});
