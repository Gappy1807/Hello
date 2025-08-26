const STORAGE_KEY = 'pdm_by_host';

function setStatus(text) {
  const el = document.getElementById('status');
  el.textContent = text || '';
}

// get active tab
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function hostFromUrl(url) {
  try { return new URL(url).hostname; } catch { return null; }
}

function readStateForHost(host) {
  return new Promise((res) => {
    chrome.storage.local.get(STORAGE_KEY, (obj) => {
      const byHost = obj[STORAGE_KEY] || {};
      res(Boolean(byHost[host]));
    });
  });
}

function writeStateForHost(host, enabled) {
  return new Promise((res) => {
    chrome.storage.local.get(STORAGE_KEY, (obj) => {
      const byHost = obj[STORAGE_KEY] || {};
      byHost[host] = Boolean(enabled);
      chrome.storage.local.set({ [STORAGE_KEY]: byHost }, () => res());
    });
  });
}

async function applyToTab(tabId, enabled) {
  // execute directly in the page to add/remove class
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (enabled) => {
      try {
        document.documentElement.classList.toggle('pdm-dark', !!enabled);
      } catch (e) {
        // ignore
      }
    },
    args: [enabled]
  });
}

document.getElementById('toggle').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab || !tab.url) { setStatus('Open a pinterest.com tab'); return; }
  const host = hostFromUrl(tab.url);
  if (!host || !host.endsWith('pinterest.com')) { setStatus('Open a pinterest.com page'); return; }

  const current = await readStateForHost(host);
  const next = !current;

  // persist first
  await writeStateForHost(host, next);

  // then apply immediately in the active tab (best-effort)
  try {
    await applyToTab(tab.id, next);
    setStatus(next ? 'Dark mode: ON' : 'Dark mode: OFF');
  } catch (e) {
    // if direct apply fails, stored value will be picked up on next load by content script
    setStatus(next ? 'Saved: ON (reload page if unchanged)' : 'Saved: OFF (reload page if unchanged)');
  }
});

// when popup opens, show current stored state
(async function init() {
  const tab = await getActiveTab();
  if (!tab || !tab.url) { setStatus('Open a Pinterest tab'); return; }
  const host = hostFromUrl(tab.url);
  if (!host || !host.endsWith('pinterest.com')) { setStatus('Open pinterest.com'); return; }
  const current = await readStateForHost(host);
  setStatus(current ? 'Dark mode: ON' : 'Dark mode: OFF');
})();
