export const SELECTION_SOURCES = Object.freeze({
  PDF: 'pdf',
  HTML: 'html'
});

export function decodeRepeatedly(value) {
  let decoded = value;
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

export function resolvePdfUrl(payload) {
  const values = [
    payload?.tabUrl,
    payload?.pageUrl,
    payload?.frameUrl,
    payload?.sourceUrl
  ].filter(Boolean);

  for (const raw of values) {
    const decoded = decodeRepeatedly(raw);
    const direct = decoded.match(
      /(?:file|https?):\/\/[^?#"']+\.pdf(?:[?#][^"']*)?/i
    )?.[0];
    if (direct) return direct;

    try {
      const url = new URL(raw);
      for (const key of ['file', 'url', 'src']) {
        const value = url.searchParams.get(key);
        if (value && /\.pdf(?:$|[?#])/i.test(value)) {
          return decodeRepeatedly(value);
        }
      }
    } catch {
      // Internal browser PDF viewers can expose non-standard URLs.
    }
  }
  return null;
}

export function selectionSource(payload) {
  return resolvePdfUrl(payload)
    ? SELECTION_SOURCES.PDF
    : SELECTION_SOURCES.HTML;
}
