let port;
let nextConnection = 0;
function send(message) {
  if (!port && Date.now() >= nextConnection) {
    try {
      port = chrome.runtime.connectNative('kr.cleantouch.timeline');
      port.onDisconnect.addListener(() => { void chrome.runtime.lastError; port = null; nextConnection = Date.now() + 3000; });
    } catch { nextConnection = Date.now() + 3000; }
  }
  if (port) { try { port.postMessage(message); } catch { port = null; } }
}
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!sender.tab || !['video-time', 'video-unavailable'].includes(message.type)) return;
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
    if (tabs[0]?.id !== sender.tab.id) return;
    send({ ...message, tabId: sender.tab.id });
  });
});
