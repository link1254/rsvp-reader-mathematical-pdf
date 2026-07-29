import {
  cropMathRegion,
  detectMathRegions,
  selectRegionForLabel,
  selectRegionForRect
} from './math-region-detector.js';
import {
  buildSelectionSegments,
  chooseSelectionCandidate,
  confirmWeakMathRegions,
  locateSelectionItems
} from './pdf-selection-layout.js';
import {
  parseEquationLabel,
  tokenizeDetectedProse
} from './selection-engine.js';
import {
  detectionStageProgress,
  selectionSearchProgress
} from './loading-progress.js';
import { t } from './i18n.js';

const DETECTION_RENDER_SCALE = 2;
const TARGET_EQUATION_PIXEL_RATIO = 2;
const MAX_EQUATION_RENDER_PIXELS = 16_000_000;

export function equationImagePixelRatio(
  canvas,
  maxPixels = MAX_EQUATION_RENDER_PIXELS
) {
  const pixels = Number(canvas?.width) * Number(canvas?.height);
  if (!Number.isFinite(pixels) || pixels <= 0) return 1;
  const memoryRatio = Math.sqrt(Math.max(0, maxPixels) / pixels);
  return Math.max(1, Math.min(TARGET_EQUATION_PIXEL_RATIO, memoryRatio));
}

export async function renderEquationImageCanvas(
  page,
  detectionCanvas,
  signal = null
) {
  const pixelRatio = equationImagePixelRatio(detectionCanvas);
  if (pixelRatio <= 1) return { canvas: detectionCanvas, pixelRatio: 1 };

  try {
    signal?.throwIfAborted();
    const viewport = page.getViewport({
      scale: DETECTION_RENDER_SCALE * pixelRatio
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({
      canvasContext: canvas.getContext('2d'),
      viewport
    }).promise;
    signal?.throwIfAborted();
    return { canvas, pixelRatio };
  } catch (error) {
    signal?.throwIfAborted();
    console.warn(
      'High-resolution equation rendering unavailable; using the detection image.',
      error
    );
    return { canvas: detectionCanvas, pixelRatio: 1 };
  }
}

function reportDetectionProgress(onStatus, stage, progress = {}) {
  const states = {
    preparing: t('preparingModelImage'),
    queued: t('waitingDetectionEngine'),
    'model-download': t('loadingMathModel'),
    'model-compile': t('initializingMathModel'),
    'model-ready': t('initializingMathModel'),
    inference: t('analyzingMathNotations'),
    postprocess: t('checkingDetectedRegions')
  };
  onStatus(
    states[stage] || t('localMathAnalysisProgress'),
    detectionStageProgress(stage, progress)
  );
}

function decodeRepeatedly(value) {
  let decoded = value;
  for (let i = 0; i < 3; i++) {
    try { const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next; } catch { break; }
  }
  return decoded;
}

export function resolvePdfUrl(payload) {
  const values = [payload?.tabUrl, payload?.pageUrl, payload?.frameUrl, payload?.sourceUrl].filter(Boolean);
  for (const raw of values) {
    const decoded = decodeRepeatedly(raw);
    const direct = decoded.match(/(?:file|https?):\/\/[^?#"']+\.pdf(?:[?#][^"']*)?/i)?.[0];
    if (direct) return direct;
    try {
      const url = new URL(raw);
      for (const key of ['file', 'url', 'src']) {
        const value = url.searchParams.get(key);
        if (value && /\.pdf(?:$|[?#])/i.test(value)) return decodeRepeatedly(value);
      }
    } catch { /* URL interne non standard */ }
  }
  return null;
}

function word(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function selectionWords(text) { return text.split(/\s+/).map(word).filter(value => value.length >= 2); }

function mathCharacters(value) {
  return [...value.normalize('NFC')]
    .filter(char => !/\s/.test(char))
    .map(char => char === '\u0003' ? '□' : /[-–]/.test(char) ? '−' : char);
}

function isRecoverablePdfGlyph(char) {
  return /[0-9□ℏħΑ-ω∂∇≡≈≠≤≥±×÷∝→↦⇒∑∫∏√∞+−*/^_<>()[\]{}]/.test(char);
}

function findFuzzyMathMatch(stream, needle) {
  const maxSkippedGlyphs = Math.max(2, Math.min(6, Math.ceil(needle.length * .25)));
  let best = null;
  let ambiguous = false;
  for (let start = 0; start < stream.length; start++) {
    if (stream[start].char !== needle[0]) continue;
    let cursor = start;
    let matched = 0;
    let skipped = 0;
    while (cursor < stream.length && matched < needle.length) {
      if (stream[cursor].char === needle[matched]) {
        matched++;
        cursor++;
        continue;
      }
      if (skipped >= maxSkippedGlyphs || !isRecoverablePdfGlyph(stream[cursor].char)) break;
      skipped++;
      cursor++;
    }
    if (matched !== needle.length) continue;
    const candidate = { start, end: cursor - 1, skipped };
    const score = skipped * 100 + candidate.end - candidate.start;
    if (!best || score < best.score) {
      best = { ...candidate, score };
      ambiguous = false;
    } else if (score === best.score && candidate.start !== best.start) {
      ambiguous = true;
    }
  }
  return ambiguous ? null : best;
}

export function findMathItemRange(items, expression, preferredRange = null) {
  const needle = mathCharacters(expression).join('');
  if (needle.length < 2) return null;
  const stream = [];
  items.forEach((item, itemIndex) => {
    if (preferredRange && (itemIndex < preferredRange.start || itemIndex > preferredRange.end)) return;
    mathCharacters(item.str).forEach(char => stream.push({ char, itemIndex }));
  });
  const haystack = stream.map(entry => entry.char).join('');
  const exactMatches = [];
  for (let from = 0; from <= haystack.length - needle.length;) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) break;
    exactMatches.push({ start: index, end: index + needle.length - 1 });
    from = index + 1;
  }
  if (exactMatches.length > 1) return null;
  const match = exactMatches[0] || findFuzzyMathMatch(stream, needle);
  if (!match) return null;
  let start = match.start;
  let recoveredPrefix = 0;
  while (start > 0 && recoveredPrefix < 3 && isRecoverablePdfGlyph(stream[start - 1].char)) {
    const previousItem = stream[start - 1].itemIndex;
    const firstItem = stream[start].itemIndex;
    if (firstItem - previousItem > 2) break;
    start--;
    recoveredPrefix++;
  }
  return {
    start: stream[start].itemIndex,
    end: stream[match.end].itemIndex
  };
}

export function findMathItemRangeFromContext(items, before, after) {
  const beforeWords = selectionWords(before);
  const afterWords = selectionWords(after);
  if (beforeWords.length < 2 || afterWords.length < 2) return null;
  const tokens = [];
  items.forEach((item, itemIndex) => item.str.split(/\s+/).forEach(part => {
    const value = word(part);
    if (value.length >= 2) tokens.push({ value, itemIndex });
  }));

  for (let beforeSize = Math.min(4, beforeWords.length); beforeSize >= 2; beforeSize--) {
    const beforeNeedle = beforeWords.slice(-beforeSize);
    for (let afterSize = Math.min(4, afterWords.length); afterSize >= 2; afterSize--) {
      const afterNeedle = afterWords.slice(0, afterSize);
      let from = 0;
      while (from < tokens.length) {
        const beforeIndex = findSequence(tokens, beforeNeedle, from);
        if (beforeIndex < 0) break;
        const afterIndex = findSequence(tokens, afterNeedle, beforeIndex + beforeSize);
        if (afterIndex < 0) break;
        let start = tokens[beforeIndex + beforeSize - 1].itemIndex + 1;
        let end = tokens[afterIndex].itemIndex - 1;
        while (start <= end && !items[start].str.trim()) start++;
        while (end >= start && !items[end].str.trim()) end--;
        if (start <= end && end - start <= 60) return { start, end };
        from = beforeIndex + 1;
      }
    }
  }
  return null;
}

function findSequence(haystack, needle, from = 0) {
  if (!needle.length) return -1;
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j].value !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

function locateSelection(items, text, viewport) {
  const tokens = [];
  items.forEach((item, itemIndex) => item.str.split(/\s+/).forEach(part => {
    const value = word(part); if (value.length >= 2) tokens.push({ value, itemIndex });
  }));
  const selected = selectionWords(text);
  if (selected.length < 2) return null;
  const size = Math.min(5, selected.length);
  let start = findSequence(tokens, selected.slice(0, size));
  if (start < 0) start = findSequence(tokens, selected.slice(0, Math.min(2, size)));
  if (start < 0) return null;
  let end = findSequence(tokens, selected.slice(-size), start);
  if (end < 0) end = Math.min(tokens.length - 1, start + selected.length);
  else end += size - 1;
  const relevant = tokens.slice(start, end + 1).map(token => items[token.itemIndex]);
  const ys = relevant.map(item => viewport.convertToViewportPoint(item.transform[4], item.transform[5])[1]);
  return [Math.max(0, Math.min(...ys) - 90), Math.min(viewport.height, Math.max(...ys) + 90)];
}

function isParagraphTextItem(item) {
  return item.height > 0 && selectionWords(item.str).length >= 5;
}

function mathSignal(value) {
  return (value.match(/[0-9□ℏħΑ-ω∂∇≡≈≠≤≥±×÷∝→↦⇒∑∫∏√∞+−*/^_<>()[\]{}]/g) || []).length;
}

function selectEquationCluster(items, labelItem) {
  const content = items.filter(item => item !== labelItem);
  if (!content.length) return [labelItem];
  const heights = content.map(item => item.height).filter(height => height > 0).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || labelItem.height || 10;
  const joinGap = medianHeight * 2;
  const sorted = [...content].sort((a, b) => a.transform[4] - b.transform[4]);
  const clusters = [];
  for (const item of sorted) {
    const start = item.transform[4];
    const end = start + item.width;
    const cluster = clusters.at(-1);
    if (!cluster || start - cluster.end > joinGap) clusters.push({ items: [item], start, end });
    else { cluster.items.push(item); cluster.end = Math.max(cluster.end, end); }
  }
  const score = cluster => cluster.items.reduce((sum, item) => sum + mathSignal(item.str), 0) * 100 + cluster.end - cluster.start;
  const best = clusters.sort((a, b) => score(b) - score(a))[0];
  const selected = new Set([...best.items, labelItem]);
  return items.filter(item => selected.has(item));
}

export function findNumberedEquationItems(items, labelItem) {
  const labelIndex = items.indexOf(labelItem);
  if (labelIndex < 0) return [];
  let previousParagraph = -1;
  let nextParagraph = items.length;
  for (let index = labelIndex - 1; index >= 0; index--) {
    if (isParagraphTextItem(items[index])) { previousParagraph = index; break; }
  }
  for (let index = labelIndex + 1; index < items.length; index++) {
    if (isParagraphTextItem(items[index])) { nextParagraph = index; break; }
  }
  const upperY = previousParagraph >= 0 ? items[previousParagraph].transform[5] : Infinity;
  const lowerY = nextParagraph < items.length ? items[nextParagraph].transform[5] : -Infinity;
  const candidates = items.slice(previousParagraph + 1, nextParagraph).filter(item => {
    const y = item.transform[5];
    return item.str.trim() && y < upperY && y > lowerY;
  });
  return selectEquationCluster(candidates, labelItem);
}

function textItemsRect(viewport, items) {
  const visibleItems = items.filter(item => item.str?.trim());
  if (!visibleItems.length) return null;
  const bounds = visibleItems.map(item => {
    const [x, baseline] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    const height = Math.max(8, item.height * viewport.scale);
    return {
      left: x,
      top: baseline - height * 1.3,
      right: x + item.width * viewport.scale,
      bottom: baseline + height * .35
    };
  });
  const x = Math.min(...bounds.map(bound => bound.left));
  const y = Math.min(...bounds.map(bound => bound.top));
  const right = Math.max(...bounds.map(bound => bound.right));
  const bottom = Math.max(...bounds.map(bound => bound.bottom));
  return { x, y, width: right - x, height: bottom - y };
}

function findLabelItems(items, label) {
  const compactLabel = label.replace(/\s/g, '');
  const direct = items.filter(item => item.str.replace(/\s/g, '').includes(compactLabel));
  if (direct.length) return direct;
  const rows = new Map();
  for (const item of items) {
    const y = Math.round(item.transform[5] / 3) * 3;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(item);
  }
  return [...rows.values()]
    .filter(row => row.map(item => item.str).join('').replace(/\s/g, '').includes(compactLabel))
    .map(row => row.at(-1));
}

function pageHint(payload) {
  const values = [payload?.tabUrl, payload?.pageUrl, payload?.frameUrl, payload?.sourceUrl].filter(Boolean);
  for (const raw of values) {
    const decoded = decodeRepeatedly(raw);
    const match = decoded.match(/(?:[#?&]page=|\/page\/)(\d+)/i);
    if (match) return Number(match[1]);
  }
  return null;
}

async function findSelectionPage(pdf, payload, onStatus, signal = null) {
  const hint = pageHint(payload);
  const pageNumbers = [];
  if (hint >= 1 && hint <= pdf.numPages) pageNumbers.push(hint);
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    if (pageNumber !== hint) pageNumbers.push(pageNumber);
  }
  const candidates = [];
  for (let index = 0; index < pageNumbers.length; index++) {
    const pageNumber = pageNumbers[index];
    signal?.throwIfAborted();
    onStatus(
      t('searchingSelectionPage', { page: pageNumber, total: pdf.numPages }),
      { value: selectionSearchProgress(index + 1, pageNumbers.length) }
    );
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    signal?.throwIfAborted();
    const selection = locateSelectionItems(content.items, payload.text);
    if (selection) candidates.push({ page, pageNumber, content, selection });
  }
  return chooseSelectionCandidate(candidates, hint);
}

export function visualRsvpItems(
  segments,
  canvas,
  pageNumber,
  { pixelRatio = 1 } = {}
) {
  const items = [];
  const images = {};
  const imagePixelRatios = {};
  let unresolvedCount = 0;
  for (const segment of segments) {
    if (segment.type === 'math') {
      const region = segment.region;
      const equationId = `vision-${pageNumber}-${segment.regionIndex}`;
      const image = cropMathRegion(
        canvas,
        region,
        region.kind === 'display' ? 8 : 5,
        pixelRatio
      );
      if (!image) continue;
      images[equationId] = image;
      imagePixelRatios[equationId] = pixelRatio;
      const equationItem = {
        value: t(region.kind === 'display' ? 'equation' : 'mathNotation'),
        type: 'equation',
        equationId,
        mathKind: region.kind,
        confidence: region.confidence
      };
      if (segment.equationLabel) equationItem.equationLabel = segment.equationLabel;
      items.push(equationItem);
      continue;
    }
    const tokens = tokenizeDetectedProse(segment.value);
    for (const [tokenIndex, token] of tokens.entries()) {
      const paragraphEnd = segment.paragraphEnd && tokenIndex === tokens.length - 1;
      if (token.type === 'equation') {
        const equationId = `unresolved-${pageNumber}-${unresolvedCount++}`;
        items.push({
          value: t('mathNotation'),
          type: 'equation',
          equationId,
          unresolved: true,
          paragraphEnd
        });
      } else {
        items.push(paragraphEnd ? { ...token, paragraphEnd: true } : token);
      }
    }
  }
  return { items, images, imagePixelRatios, unresolvedCount };
}

export async function renderVisualSelectionFromPdf(
  payload,
  onStatus = () => {},
  { signal = null } = {}
) {
  signal?.throwIfAborted();
  const pdfUrl = resolvePdfUrl(payload);
  if (!pdfUrl) throw new Error(t('pdfAddressMissing'));
  const pdfjsLib = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  onStatus(t('openingPdf'), { indeterminate: true });
  const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
  try {
    const selectedPage = await findSelectionPage(pdf, payload, onStatus, signal);
    if (!selectedPage) {
      throw new Error(t('pdfSelectionAmbiguous'));
    }

    const { page, pageNumber, content, selection } = selectedPage;
    signal?.throwIfAborted();
    const viewport = page.getViewport({ scale: DETECTION_RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    onStatus(t('renderingPage', { page: pageNumber }), { value: 73 });
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    signal?.throwIfAborted();
    onStatus(t('detectingAllMath'), { value: 75 });
    const candidateRegions = await detectMathRegions(canvas, {
      confidence: .4,
      signal,
      onProgress: (stage, progress) => (
        reportDetectionProgress(onStatus, stage, progress)
      )
    });
    const detectedRegions = confirmWeakMathRegions(
      content.items,
      viewport,
      candidateRegions
    );
    signal?.throwIfAborted();
    onStatus(t('preparingReading'), { value: 97 });
    const segments = buildSelectionSegments(content.items, viewport, detectedRegions, selection);
    const hasEquationImages = segments.some(segment => segment.type === 'math');
    if (hasEquationImages) {
      onStatus(t('enhancingEquationImages'), { value: 98 });
    }
    const equationImageSource = hasEquationImages
      ? await renderEquationImageCanvas(page, canvas, signal)
      : { canvas, pixelRatio: 1 };
    const result = visualRsvpItems(
      segments,
      equationImageSource.canvas,
      pageNumber,
      { pixelRatio: equationImageSource.pixelRatio }
    );
    if (!result.items.length) throw new Error(t('noReadableSelection'));
    return {
      ...result,
      pageNumber,
      pdfUrl,
      pageCapture: canvas.toDataURL('image/png'),
      detectedCount: Object.keys(result.images).length
    };
  } finally {
    await pdf.destroy();
  }
}

export async function renderEquationFromPdf(payload, onStatus = () => {}, equationRequests = []) {
  const pdfUrl = resolvePdfUrl(payload);
  if (!pdfUrl) throw new Error(t('pdfAddressMissing'));
  const requestedEquations = equationRequests.filter(Boolean).map((request, index) => {
    const normalized = typeof request === 'string'
      ? { id: `equation-${index}`, value: request, before: '', after: '' }
      : request;
    return {
      ...normalized,
      label: normalized.equationLabel
        || normalized.label
        || parseEquationLabel(normalized.value)
        || null
    };
  });
  const requestedLabels = [...new Set(requestedEquations.map(request => request.label).filter(Boolean))];
  const requestedInline = requestedEquations.filter(request => !request.label);
  if (!requestedEquations.length) return { images: {}, pageNumber: null, pdfUrl };
  const pdfjsLib = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  onStatus('Ouverture du PDF…');
  const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
  const target = selectionWords(payload.text);
  const anchor = target.slice(0, Math.min(5, target.length));

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    onStatus(t('searchingPage', { page: pageNumber, total: pdf.numPages }));
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageWords = selectionWords(content.items.map(item => item.str).join(' '));
    const found = anchor.length && findSequence(pageWords.map(value => ({ value })), anchor) >= 0;
    if (!found) continue;

    const viewport = page.getViewport({ scale: DETECTION_RENDER_SCALE });
    const canvas = document.createElement('canvas'); canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    onStatus(t('detectingMath'));
    const detectedRegions = await detectMathRegions(canvas);
    const selectionRange = locateSelection(content.items, payload.text, viewport);
    const relevantRegions = selectionRange
      ? detectedRegions.filter(region => {
        const centerY = region.y + region.height / 2;
        return centerY >= selectionRange[0] && centerY <= selectionRange[1];
      })
      : detectedRegions;
    const imageRegions = new Map();
    const labelRegions = new Map();
    for (const label of requestedLabels) {
      // Les parenthèses sont indispensables : sans elles, la section "1.2."
      // est confondue avec l'équation "(1.2)" dans le cours de test.
      const associations = findLabelItems(content.items, label)
        .map(labelItem => {
          const labelY = viewport.convertToViewportPoint(labelItem.transform[4], labelItem.transform[5])[1];
          return selectRegionForLabel(relevantRegions, labelY);
        })
        .filter(Boolean);
      const uniqueRegions = [...new Set(associations)];
      if (uniqueRegions.length !== 1) continue;
      labelRegions.set(label, uniqueRegions[0]);
    }
    requestedEquations.filter(request => request.label).forEach(request => {
      const region = labelRegions.get(request.label);
      if (region) imageRegions.set(request.id, { region, padding: 8 });
    });
    for (const request of requestedInline) {
      const expression = request.value;
      const contextRange = findMathItemRangeFromContext(content.items, request.before, request.after);
      const range = findMathItemRange(content.items, expression, contextRange) || contextRange;
      if (!range) continue;
      const equationItems = content.items.slice(range.start, range.end + 1);
      const rect = textItemsRect(viewport, equationItems);
      const region = rect ? selectRegionForRect(relevantRegions, rect) : null;
      if (region) imageRegions.set(request.id, { region, padding: 5 });
    }
    if (imageRegions.size) {
      onStatus(t('enhancingEquationImages'));
      const imageSource = await renderEquationImageCanvas(page, canvas);
      const images = {};
      const imagePixelRatios = {};
      for (const [id, { region, padding }] of imageRegions) {
        const image = cropMathRegion(
          imageSource.canvas,
          region,
          padding,
          imageSource.pixelRatio
        );
        if (!image) continue;
        images[id] = image;
        imagePixelRatios[id] = imageSource.pixelRatio;
      }
      if (Object.keys(images).length) {
        return { images, imagePixelRatios, pageNumber, pdfUrl };
      }
    }
  }
  const requested = requestedEquations.map(request => request.value);
  throw new Error(t('equationNotFound', { labels: requested.join(', ') }));
}
