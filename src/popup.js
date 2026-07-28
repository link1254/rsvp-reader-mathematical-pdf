import {
  applyDocumentTranslations,
  normalizeUiLanguagePreference,
  setUiLanguage
} from './i18n.js';

const api = globalThis.browser ?? globalThis.chrome;
const { uiLanguage = 'auto' } = await api.storage.local.get('uiLanguage');
setUiLanguage(normalizeUiLanguagePreference(uiLanguage));
applyDocumentTranslations(document);
const open = (params = '') => api.tabs.create({ url: api.runtime.getURL(`src/reader.html${params}`) });
document.querySelector('#open').onclick = () => open();
document.querySelector('#page').onclick = async () => {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  try {
    const data = await api.tabs.sendMessage(tab.id, { type: 'GET_PAGE_TEXT' });
    const key = `transfer-${Date.now()}`;
    await api.storage.local.set({ [key]: data });
    open(`?transfer=${encodeURIComponent(key)}`);
  } catch { open('?errorKey=pageExtractionFailed'); }
  window.close();
};
