import katex from 'katex';
import { unicodeMathToLatex } from './math-renderer.js';
import { webSelectionItems } from './web-selection.js';
import { t } from './i18n.js';

const MATHML_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';
const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const MAX_RENDER_WIDTH = 1600;
const MAX_RENDER_HEIGHT = 600;
const ALLOWED_MATHML_ELEMENTS = new Set([
  'math', 'semantics', 'annotation', 'annotation-xml', 'mrow', 'mi', 'mn',
  'mo', 'mtext', 'mspace', 'ms', 'mfrac', 'msqrt', 'mroot', 'msub', 'msup',
  'msubsup', 'munder', 'mover', 'munderover', 'mmultiscripts', 'mprescripts',
  'none', 'mtable', 'mtr', 'mtd', 'mlabeledtr', 'menclose', 'mstyle',
  'merror', 'mpadded', 'mphantom'
]);
const ALLOWED_MATHML_ATTRIBUTES = new Set([
  'display', 'mathvariant', 'mathsize',
  'scriptlevel', 'displaystyle', 'stretchy', 'symmetric', 'maxsize', 'minsize',
  'largeop', 'movablelimits', 'accent', 'accentunder', 'linethickness',
  'bevelled', 'notation', 'rowspan', 'columnspan', 'columnalign', 'rowalign',
  'columnspacing', 'rowspacing', 'width', 'height', 'depth', 'lspace', 'rspace',
  'fence', 'separator'
]);
const DIMENSION_ATTRIBUTES = new Set([
  'mathsize', 'maxsize', 'minsize', 'linethickness', 'columnspacing',
  'rowspacing', 'width', 'height', 'depth', 'lspace', 'rspace'
]);

function safeAttributeValue(name, value) {
  if (!DIMENSION_ATTRIBUTES.has(name)) return value;
  if (!/^[\d\s.,+\-/%a-z]+$/i.test(value)) return null;
  const numbers = [...value.matchAll(/-?\d*\.?\d+/g)]
    .map(match => Math.abs(Number(match[0])));
  return numbers.every(number => Number.isFinite(number) && number <= 100)
    ? value
    : null;
}

function safeMathMlNode(source, targetDocument) {
  if (source.nodeType === 3) {
    return targetDocument.createTextNode(source.nodeValue || '');
  }
  if (source.nodeType !== 1) return null;
  const name = source.localName?.toLowerCase();
  if (!ALLOWED_MATHML_ELEMENTS.has(name)) return null;

  const element = targetDocument.createElementNS(MATHML_NAMESPACE, name);
  for (const attribute of [...source.attributes]) {
    const attributeName = attribute.name.toLowerCase();
    if (ALLOWED_MATHML_ATTRIBUTES.has(attributeName)) {
      const value = safeAttributeValue(attributeName, attribute.value);
      if (value !== null) element.setAttribute(attributeName, value);
    }
  }
  for (const child of [...source.childNodes]) {
    const safeChild = safeMathMlNode(child, targetDocument);
    if (safeChild) element.append(safeChild);
  }
  return element;
}

export function sourceMathMl(item) {
  if (item.mathml) return item.mathml;
  if (item.latex) {
    return katex.renderToString(item.latex, {
      displayMode: item.displayMode,
      output: 'mathml',
      throwOnError: false,
      strict: false,
      trust: false,
      maxSize: 20,
      maxExpand: 1000
    });
  }
  return katex.renderToString(unicodeMathToLatex(item.equationText), {
    displayMode: item.displayMode,
    output: 'mathml',
    throwOnError: false,
    strict: false,
    trust: false,
    maxSize: 20,
    maxExpand: 1000
  });
}

export function webEquationCaptureCrop(
  item,
  imageWidth,
  imageHeight,
  padding = 8
) {
  const rect = item?.captureRect;
  const viewport = item?.captureViewport;
  if (!rect
    || !viewport
    || !Number.isFinite(imageWidth)
    || !Number.isFinite(imageHeight)
    || imageWidth < 1
    || imageHeight < 1
    || !Number.isFinite(viewport.width)
    || !Number.isFinite(viewport.height)
    || viewport.width < 1
    || viewport.height < 1) return null;

  const scaleX = imageWidth / viewport.width;
  const scaleY = imageHeight / viewport.height;
  const x0 = Math.max(0, Math.floor((rect.x - padding) * scaleX));
  const y0 = Math.max(0, Math.floor((rect.y - padding) * scaleY));
  const x1 = Math.min(
    imageWidth,
    Math.ceil((rect.x + rect.width + padding) * scaleX)
  );
  const y1 = Math.min(
    imageHeight,
    Math.ceil((rect.y + rect.height + padding) * scaleY)
  );
  if (x1 <= x0 || y1 <= y0) return null;
  return {
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0,
    pixelRatio: Math.min(scaleX, scaleY)
  };
}

function sanitizedMathMl(item) {
  const parsed = new DOMParser().parseFromString(sourceMathMl(item), 'text/html');
  const source = parsed.querySelector('math');
  if (!source) throw new Error(t('webEquationRenderUnavailable'));
  const safe = safeMathMlNode(source, document);
  safe.setAttribute('display', 'block');
  return safe;
}

async function imageFromSvg(svg) {
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const image = new Image();
  image.decoding = 'async';
  image.src = source;
  await image.decode();
  return image;
}

async function renderCapturedWebEquation(item, pageCapture) {
  if (!pageCapture || !item.captureRect || !item.captureViewport) return null;
  const image = new Image();
  image.decoding = 'async';
  image.src = pageCapture;
  await image.decode();
  const rect = webEquationCaptureCrop(
    item,
    image.naturalWidth,
    image.naturalHeight
  );
  if (!rect) return null;

  const canvas = document.createElement('canvas');
  canvas.width = rect.width;
  canvas.height = rect.height;
  canvas.getContext('2d').drawImage(
    image,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height
  );
  return {
    dataUrl: canvas.toDataURL('image/png'),
    pixelRatio: rect.pixelRatio
  };
}

export async function renderWebEquationPng(item, { pixelRatio = 2 } = {}) {
  const math = sanitizedMathMl(item);
  const measuringHost = document.createElement('div');
  measuringHost.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'display:inline-block',
    'width:max-content',
    'max-width:none',
    'padding:18px 24px',
    'background:#fff',
    'color:#111',
    'font-size:48px',
    'line-height:1.35',
    'visibility:hidden'
  ].join(';');
  measuringHost.append(math);
  document.body.append(measuringHost);

  try {
    const bounds = measuringHost.getBoundingClientRect();
    const renderScale = Math.min(
      1,
      MAX_RENDER_WIDTH / Math.max(1, bounds.width),
      MAX_RENDER_HEIGHT / Math.max(1, bounds.height)
    );
    const width = Math.max(96, Math.ceil(bounds.width * renderScale));
    const height = Math.max(72, Math.ceil(bounds.height * renderScale));
    const imageHost = document.createElementNS(XHTML_NAMESPACE, 'div');
    imageHost.style.cssText = [
      `width:${width}px`,
      `height:${height}px`,
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'box-sizing:border-box',
      `padding:${18 * renderScale}px ${24 * renderScale}px`,
      'overflow:hidden',
      'background:#fff',
      'color:#111',
      `font-size:${48 * renderScale}px`,
      'line-height:1.35'
    ].join(';');
    imageHost.append(math.cloneNode(true));
    const markup = new XMLSerializer().serializeToString(imageHost);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
    const image = await imageFromSvg(svg);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * pixelRatio);
    canvas.height = Math.ceil(height * pixelRatio);
    const context = canvas.getContext('2d');
    context.scale(pixelRatio, pixelRatio);
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      pixelRatio
    };
  } finally {
    measuringHost.remove();
  }
}

export async function renderVisualSelectionFromWeb(
  payload,
  onStatus = () => {},
  { signal = null } = {}
) {
  signal?.throwIfAborted();
  onStatus(t('preparingWebSelection'), { value: 20 });
  const items = webSelectionItems(payload);
  if (!items.length) throw new Error(t('noReadableSelection'));

  const equations = items.filter(item => item.type === 'equation');
  const images = {};
  const imagePixelRatios = {};
  for (const [index, item] of equations.entries()) {
    signal?.throwIfAborted();
    onStatus(t('renderingWebEquations'), {
      value: 35 + Math.round((index / Math.max(1, equations.length)) * 55)
    });
    try {
      const rendered = (!item.latex && !item.mathml)
        ? await renderCapturedWebEquation(item, payload?.pageCapture)
          || await renderWebEquationPng(item)
        : await renderWebEquationPng(item);
      images[item.equationId] = rendered.dataUrl;
      imagePixelRatios[item.equationId] = rendered.pixelRatio;
    } catch (error) {
      console.warn('Unable to render a web equation as PNG', error);
    }
  }

  signal?.throwIfAborted();
  return {
    items,
    images,
    imagePixelRatios,
    pageCapture: payload?.pageCapture || null,
    pageNumber: null,
    sourceType: 'html',
    detectedCount: Object.keys(images).length
  };
}
