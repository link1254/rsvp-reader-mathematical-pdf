export function localPdfKey(pdfUrl) {
  if (typeof pdfUrl !== 'string') return null;
  try {
    const url = new URL(pdfUrl);
    if (url.protocol !== 'file:') return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

export function localPdfFileName(pdfUrl) {
  const key = localPdfKey(pdfUrl);
  if (!key) return '';
  try {
    return decodeURIComponent(new URL(key).pathname.split('/').at(-1) || '');
  } catch {
    return '';
  }
}

export function matchesLocalPdfFile(file, pdfUrl) {
  const expected = localPdfFileName(pdfUrl);
  if (!file?.name || !expected) return false;
  return file.name.normalize('NFC').toLocaleLowerCase()
    === expected.normalize('NFC').toLocaleLowerCase();
}

export function localPdfBytes(payload) {
  const data = payload?.pdfData;
  if (data instanceof Uint8Array && data.byteLength) return data;
  if (data instanceof ArrayBuffer && data.byteLength) return new Uint8Array(data);
  return null;
}
