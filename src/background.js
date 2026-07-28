import { readerWindowLayout, readerWindowSize } from './window-layout.js';

const api = globalThis.browser ?? globalThis.chrome;
let readerWindowId = null;
const READER_WINDOW_SIZE_KEY = 'readerWindowSize';

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.removeAll(() => {
    api.contextMenus.create({
      id: 'rsvp-selection',
      title: 'Lire la sélection avec RSVP Reader',
      contexts: ['selection']
    });
  });
});

async function openHorizontalReader(tab) {
  if (readerWindowId !== null) {
    try {
      await api.windows.update(readerWindowId, { focused: true });
      return;
    } catch { readerWindowId = null; }
  }

  const parent = await api.windows.get(tab.windowId).catch(() => null);
  const stored = await api.storage.local.get(READER_WINDOW_SIZE_KEY);
  const bounds = readerWindowLayout(parent || {}, stored[READER_WINDOW_SIZE_KEY]);
  const created = await api.windows.create({
    url: api.runtime.getURL('src/sidepanel.html?layout=horizontal'),
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
    console.warn('Capture visuelle du PDF indisponible', error);
  }
  await api.storage.local.set({ activeSelection: {
    text: info.selectionText.trim(), sourceUrl: info.pageUrl || tab?.url || '',
    tabUrl: tab?.url || '', frameUrl: info.frameUrl || '', pageUrl: info.pageUrl || '',
    tabId: tab?.id, capturedAt: Date.now(), pageCapture, captureError
  }});
  try {
    await openHorizontalReader(tab);
  } catch (error) {
    console.error('Impossible d’ouvrir la fenêtre RSVP', error);
    await api.sidePanel.setOptions({ tabId: tab.id, path: 'src/sidepanel.html', enabled: true });
    await api.sidePanel.open({ tabId: tab.id });
  }
});
