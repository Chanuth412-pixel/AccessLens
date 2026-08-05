const apiBaseUrl = 'http://localhost:4000';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'AL_RECORDING_API' || typeof message.path !== 'string') return;

  if (!message.path.startsWith('/api/developer/recordings') && !message.path.startsWith('/api/guides')) {
    sendResponse({ ok: false, error: 'Unsupported recording API path.' });
    return;
  }

  fetch(`${apiBaseUrl}${message.path}`, {
    method: message.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: message.body === undefined ? undefined : JSON.stringify(message.body)
  })
    .then(async (response) => {
      const data = await response.json().catch(() => null);
      sendResponse({
        ok: response.ok,
        status: response.status,
        data,
        error: response.ok ? undefined : data?.error || 'Recording API request failed.'
      });
    })
    .catch((error) => sendResponse({ ok: false, status: 0, error: error.message }));

  return true;
});
