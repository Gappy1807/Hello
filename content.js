// content.js (Pinterest - debug build)
const CLASS = 'pdm-dark';
const STYLE_ID = 'pdm-style';
const STORAGE_KEY = 'pdm_by_host';

function log(...args) {
  try { console.log('PDM:', ...args); } catch (e) {}
}

function waitForDocumentElement(cb) {
  if (document.documentElement) return cb();
  const i = setInterval(() => {
    if (document.documentElement) { clearInterval(i); cb(); }
  }, 50);
}

function injectCSS() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
/* Basic dark theme for Pinterest containers (images/videos are left untouched) */
html.${CLASS} { color-scheme: dark; background: #0b0b0b !important; }
html.${CLASS} body { background: #0b0b0b !important; color: #e6e6e6 !important; }

/* Links, accents */
html.${CLASS} a { color: #9ecbff !important; }

/* Common containers -> dark surfaces */
html.${CLASS} header,
html.${CLASS} nav,
html.${CLASS} [role="dialog"],
html.${CLASS} section,
html.${CLASS} article,
html.${CLASS} aside,
html.${CLASS} main,
html.${CLASS} .Grid,
html.${CLASS} .Board,
html.${CLASS} .Pin {
  background-color: #141414 !important;
  color: inherit !important;
}

/* Inputs */
html.${CLASS} input,
html.${CLASS} textarea,
html.${CLASS} select {
  background-color: #1c1c1c !important;
  color: #fff !important;
  caret-color: #fff !important;
}

/* Buttons */
html.${CLASS} button {
  background-color: #202020 !important;
  color: #eee !important;
}

/* Don't invert or change media (images/videos/svg) */
html.${CLASS} img,
html.${CLASS} video,
html.${CLASS} svg,
html.${CLASS} canvas,
html.${CLASS} picture {
  filter: none !important;
  background: transparent !important;
}

/* Scrollbars (Chromium) */
html.${CLASS} *::-webkit-scrollbar { width: 12px; height:12px; }
html.${CLASS} *::-webkit-scrollbar-thumb { background: #2d2d2d; border-radius: 8px; }
html.${CLASS} *::-webkit-scrollbar-track { background: #0f0f0f; }
  `;
  document.documentElement.appendChild(style);
  log('CSS injected');
}

function getHostKey() {
  return location.hostname;
}

function getStorageMap() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (obj) => resolve(obj[STORAGE_KEY] || {}));
  });
}

function getEnabled() {
  return getStorageMap().then(map => Boolean(map[getHostKey()]));
}

function setEnabled(enabled) {
  return getStorageMap().then(map => {
    map[getHostKey()] = Boolean(enabled);
    return new Promise((res) => chrome.storage.local.set({ [STORAGE_KEY]: map }, res));
  });
}

function apply(enabled) {
  try {
    if (enabled) document.documentElement.classList.add(CLASS);
    else document.documentElement.classList.remove(CLASS);
    log('apply ->', enabled);
  } catch (e) {
    log('apply error', e);
  }
}

function toggle() {
  return getEnabled().then(curr => setEnabled(!curr).then(() => {
    apply(!curr);
    return !curr;
  }));
}

// re-apply if storage changes (e.g., toggled from popup or other frame)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes[STORAGE_KEY]) return;
  const byHost = changes[STORAGE_KEY].newValue || {};
  const enabled = Boolean(byHost[getHostKey()]);
  apply(enabled);
  log('storage.onChanged -> apply', enabled);
});

// message listener (fallback)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'PDM_TOGGLE') {
    toggle().then(enabled => sendResponse({ ok: true, enabled }));
    return true;
  }
  if (msg.type === 'PDM_STATUS') {
    getEnabled().then(enabled => sendResponse({ ok: true, enabled }));
    return true;
  }
});

// start up
waitForDocumentElement(() => {
  injectCSS();
  getEnabled().then(enabled => {
    apply(enabled);
    log('initial state', enabled);
  });

  // If Pinterest code removes our class, re-add it when needed
  const mo = new MutationObserver(() => {
    getEnabled().then(enabled => {
      const has = document.documentElement.classList.contains(CLASS);
      if (enabled && !has) {
        document.documentElement.classList.add(CLASS);
        log('reapplied by MutationObserver');
      }
    });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });

  window.__PDM_LOADED = true;
  log('content script ready for', location.hostname);
});
