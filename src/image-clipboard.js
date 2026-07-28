import { t } from './i18n.js';

export async function copyPngDataUrl(dataUrl, dependencies = {}) {
  if (!/^data:image\/png(?:;[^,]*)?,/i.test(dataUrl || '')) {
    throw new TypeError(t('pngCaptureRequired'));
  }

  const clipboard = dependencies.clipboard ?? globalThis.navigator?.clipboard;
  const ClipboardItemCtor = dependencies.ClipboardItemCtor ?? globalThis.ClipboardItem;
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;

  if (!clipboard?.write || !ClipboardItemCtor || !fetchImpl) {
    throw new Error(t('imageCopyUnavailable'));
  }

  const response = await fetchImpl(dataUrl);
  const blob = await response.blob();
  if (blob.type !== 'image/png') {
    throw new TypeError(t('decodedCaptureNotPng'));
  }

  await clipboard.write([
    new ClipboardItemCtor({ 'image/png': blob })
  ]);
}
