import { readerWindowLayout, readerWindowSize } from './window-layout.js';
import {
  normalizeUiLanguagePreference,
  setUiLanguage,
  t
} from './i18n.js';
import { focusHorizontalReaderWindow } from './reader-window.js';
import {
  openReaderFallback,
  removeAllContextMenus
} from './browser-compat.js';

const api = globalThis.browser ?? globalThis.chrome;
let readerWindowId = null;
const READER_WINDOW_SIZE_KEY = 'readerWindowSize';
const HORIZONTAL_READER_URL = api.runtime.getURL('src/sidepanel.html?layout=horizontal');

async function refreshContextMenu() {
  const { uiLanguage = 'auto' } = await api.storage.local.get('uiLanguage');
  setUiLanguage(normalizeUiLanguagePreference(uiLanguage));
  await removeAllContextMenus(api);
  api.contextMenus.create({
    id: 'rsvp-selection',
    title: t('readSelection'),
    contexts: ['selection']
  });
}

api.runtime.onInstalled.addListener(() => {
  void refreshContextMenu();
});
api.runtime.onStartup.addListener(() => {
  void refreshContextMenu();
});
api.storage.onChanged.addListener(changes => {
  if (changes.uiLanguage) void refreshContextMenu();
});
api.action?.onClicked?.addListener(() => {
  if (api.sidebarAction?.open) void api.sidebarAction.open();
});

async function openHorizontalReader(tab) {
  if (readerWindowId !== null) {
    try {
      await api.windows.update(readerWindowId, { focused: true });
      return;
    } catch { readerWindowId = null; }
  }

  try {
    const existingWindowId = await focusHorizontalReaderWindow(
      api.windows,
      HORIZONTAL_READER_URL
    );
    if (existingWindowId !== null) {
      readerWindowId = existingWindowId;
      return;
    }
  } catch (error) {
    console.warn('Unable to locate an existing RSVP Reader window', error);
  }

  const parent = await api.windows.get(tab.windowId).catch(() => null);
  const stored = await api.storage.local.get(READER_WINDOW_SIZE_KEY);
  const bounds = readerWindowLayout(parent || {}, stored[READER_WINDOW_SIZE_KEY]);
  const created = await api.windows.create({
    url: HORIZONTAL_READER_URL,
    type: 'popup',
    focused: true,
    ...bounds
  });
  readerWindowId = created.id;
}

api.windows.onBoundsChanged.addListener(windowInfo => {
  if (windowInfo.id !== readerWindowId) return;
  const size = readerWindowSize(windowInfo);
  if (!size) return;
  void api.storage.local.set({ [READER_WINDOW_SIZE_KEY]: size });
});

api.windows.onRemoved.addListener(windowId => { if (windowId === readerWindowId) readerWindowId = null; });

api.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'rsvp-selection' || !info.selectionText?.trim()) return;
  let pageCapture = null;
  let captureError = null;
  try {
    pageCapture = await api.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch (error) {
    captureError = String(error?.message || error);
    console.warn(t('manualCaptureUnavailable'), error);
  }
  await api.storage.local.set({ activeSelection: {
    text: info.selectionText.trim(), sourceUrl: info.pageUrl || tab?.url || '',
    tabUrl: tab?.url || '', frameUrl: info.frameUrl || '', pageUrl: info.pageUrl || '',
    tabId: tab?.id, capturedAt: Date.now(), pageCapture, captureError
  }});
  try {
    await openHorizontalReader(tab);
  } catch (error) {
    console.error('Unable to open the RSVP Reader window', error);
    await openReaderFallback(api, {
      tabId: tab.id,
      windowId: tab.windowId,
      panelPath: 'src/sidepanel.html'
    });
  }
});
