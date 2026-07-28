export async function copyPngDataUrl(dataUrl, dependencies = {}) {
  if (!/^data:image\/png(?:;[^,]*)?,/i.test(dataUrl || '')) {
    throw new TypeError('La capture doit être une image PNG.');
  }

  const clipboard = dependencies.clipboard ?? globalThis.navigator?.clipboard;
  const ClipboardItemCtor = dependencies.ClipboardItemCtor ?? globalThis.ClipboardItem;
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;

  if (!clipboard?.write || !ClipboardItemCtor || !fetchImpl) {
    throw new Error('La copie d’image n’est pas disponible dans ce navigateur.');
  }

  const response = await fetchImpl(dataUrl);
  const blob = await response.blob();
  if (blob.type !== 'image/png') {
    throw new TypeError('La capture décodée n’est pas une image PNG.');
  }

  await clipboard.write([
    new ClipboardItemCtor({ 'image/png': blob })
  ]);
}
