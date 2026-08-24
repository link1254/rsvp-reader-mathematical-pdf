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

function sourceMathMl(item) {
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
  if (item.mathml) return item.mathml;
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
      const rendered = await renderWebEquationPng(item);
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
    pageCapture: null,
    pageNumber: null,
    sourceType: 'html',
    detectedCount: Object.keys(images).length
  };
}
