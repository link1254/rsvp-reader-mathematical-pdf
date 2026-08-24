import { tokenizeDetectedProse } from './selection-engine.js';
import { t } from './i18n.js';

function normalizedSegments(payload) {
  const segments = payload?.webSelection?.segments;
  if (Array.isArray(segments) && segments.length) return segments;
  const text = String(payload?.text || '').trim();
  return text ? [{ type: 'text', value: text, paragraphEnd: true }] : [];
}

function textItems(segment) {
  const tokens = tokenizeDetectedProse(String(segment.value || ''));
  return tokens.map((token, index) => {
    const paragraphEnd = segment.paragraphEnd === true
      && index === tokens.length - 1;
    return paragraphEnd ? { ...token, paragraphEnd: true } : token;
  });
}

export function webSelectionItems(payload) {
  const items = [];
  let equationIndex = 0;

  for (const segment of normalizedSegments(payload)) {
    if (segment?.type !== 'equation') {
      items.push(...textItems(segment));
      continue;
    }

    const displayMode = segment.displayMode === true;
    const equationText = String(
      segment.latex || segment.accessibleText || segment.value || ''
    ).trim();
    const item = {
      value: t(displayMode ? 'equation' : 'mathNotation'),
      type: 'equation',
      equationId: `web-equation-${equationIndex++}`,
      sourceType: 'html',
      mathKind: displayMode ? 'display' : 'inline',
      displayMode,
      equationText,
      latex: String(segment.latex || '').trim() || null,
      mathml: String(segment.mathml || '').trim() || null
    };
    if (segment.paragraphEnd === true) item.paragraphEnd = true;
    items.push(item);
  }

  return items;
}
