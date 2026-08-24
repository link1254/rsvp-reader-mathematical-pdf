import { readerWindowLayout, readerWindowSize } from './window-layout.js';
import {
  normalizeUiLanguagePreference,
  setUiLanguage,
  t
} from './i18n.js';
import { focusHorizontalReaderWindow } from './reader-window.js';
import {
  SELECTION_SOURCES,
  selectionSource
} from './selection-source.js';

const api = globalThis.browser ?? globalThis.chrome;
let readerWindowId = null;
const READER_WINDOW_SIZE_KEY = 'readerWindowSize';
const HORIZONTAL_READER_URL = api.runtime.getURL('src/sidepanel.html?layout=horizontal');

async function refreshContextMenu() {
  const { uiLanguage = 'auto' } = await api.storage.local.get('uiLanguage');
  setUiLanguage(normalizeUiLanguagePreference(uiLanguage));
  await new Promise(resolve => {
    api.contextMenus.removeAll(resolve);
  });
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

async function structuredWebSelection(tab, frameId) {
  if (!tab?.id || !api.scripting?.executeScript) return null;
  const target = { tabId: tab.id };
  if (Number.isInteger(frameId)) target.frameIds = [frameId];
  await api.scripting.executeScript({
    target,
    files: ['src/content.js']
  });
  const options = Number.isInteger(frameId) ? { frameId } : undefined;
  return api.tabs.sendMessage(
    tab.id,
    { type: 'GET_STRUCTURED_SELECTION' },
    options
  );
}

api.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'rsvp-selection' || !tab?.id) return;
  const basePayload = {
    text: info.selectionText?.trim() || '',
    sourceUrl: info.pageUrl || tab.url || '',
    tabUrl: tab.url || '',
    frameUrl: info.frameUrl || '',
    pageUrl: info.pageUrl || '',
    tabId: tab.id,
    capturedAt: Date.now()
  };
  const sourceType = selectionSource(basePayload);
  let webSelection = null;
  if (sourceType === SELECTION_SOURCES.HTML) {
    try {
      webSelection = await structuredWebSelection(tab, info.frameId);
    } catch (error) {
      console.warn('Structured HTML selection unavailable', error);
    }
  }

  const text = webSelection?.text?.trim() || basePayload.text;
  const hasStructuredContent = webSelection?.segments?.length > 0;
  if (!text && !hasStructuredContent) return;

  let pageCapture = null;
  let captureError = null;
  if (sourceType === SELECTION_SOURCES.PDF) {
    try {
      pageCapture = await api.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    } catch (error) {
      captureError = String(error?.message || error);
      console.warn(t('manualCaptureUnavailable'), error);
    }
  }
  await api.storage.local.set({
    activeSelection: {
      ...basePayload,
      text,
      sourceType,
      pageTitle: webSelection?.title || tab.title || '',
      webSelection,
      pageCapture,
      captureError
    }
  });
  try {
    await openHorizontalReader(tab);
  } catch (error) {
    console.error('Unable to open the RSVP Reader window', error);
    await api.sidePanel.setOptions({ tabId: tab.id, path: 'src/sidepanel.html', enabled: true });
    await api.sidePanel.open({ tabId: tab.id });
  }
});
