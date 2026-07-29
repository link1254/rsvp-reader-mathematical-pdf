import * as ort from 'onnxruntime-web/wasm';
import { t } from './i18n.js';

const api = globalThis.browser ?? globalThis.chrome;
const MODEL_PATH = 'models/pix2text-mfd-1.5.onnx';
const WASM_MODULE_PATH = 'models/ort-wasm-simd-threaded.mjs';
const WASM_PATH = 'models/ort-wasm-simd-threaded.wasm';
const MODEL_WIDTH = 768;
const MODEL_STRIDE = 32;
const DEFAULT_CONFIDENCE = .8;
const NMS_THRESHOLD = .45;

let sessionPromise = null;
let inferenceTail = Promise.resolve();

function extensionUrl(path) {
  return api?.runtime?.getURL ? api.runtime.getURL(path) : path;
}

function intersectionOverUnion(first, second) {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = first.width * first.height + second.width * second.height - intersection;
  return union > 0 ? intersection / union : 0;
}

export function nonMaxSuppression(regions, threshold = NMS_THRESHOLD) {
  const candidates = [...regions].sort((a, b) => b.confidence - a.confidence);
  const kept = [];
  while (candidates.length) {
    const best = candidates.shift();
    kept.push(best);
    for (let index = candidates.length - 1; index >= 0; index--) {
      if (candidates[index].kind === best.kind
        && intersectionOverUnion(best, candidates[index]) > threshold) {
        candidates.splice(index, 1);
      }
    }
  }
  return kept;
}

export function modelGeometry(width, height, targetWidth = MODEL_WIDTH) {
  const scale = targetWidth / width;
  const resizedHeight = Math.round(height * scale);
  const targetHeight = Math.ceil(resizedHeight / MODEL_STRIDE) * MODEL_STRIDE;
  return { scale, targetWidth, targetHeight, resizedHeight };
}

export function decodeMathRegions(output, geometry, confidenceThreshold = DEFAULT_CONFIDENCE) {
  const [, channels, count] = output.dims;
  if (channels !== 6) {
    throw new Error(t('unexpectedModelOutput', { dimensions: output.dims.join('x') }));
  }
  const regions = [];
  const data = output.data;
  for (let index = 0; index < count; index++) {
    const embeddedScore = data[4 * count + index];
    const displayScore = data[5 * count + index];
    const classId = displayScore > embeddedScore ? 1 : 0;
    const confidence = Math.max(embeddedScore, displayScore);
    if (confidence < confidenceThreshold) continue;
    const centerX = data[index];
    const centerY = data[count + index];
    const width = data[2 * count + index];
    const height = data[3 * count + index];
    regions.push({
      x: (centerX - width / 2) / geometry.scale,
      y: (centerY - height / 2) / geometry.scale,
      width: width / geometry.scale,
      height: height / geometry.scale,
      kind: classId === 1 ? 'display' : 'inline',
      confidence
    });
  }
  return nonMaxSuppression(regions);
}

function canvasTensor(canvas) {
  const geometry = modelGeometry(canvas.width, canvas.height);
  const inputCanvas = document.createElement('canvas');
  inputCanvas.width = geometry.targetWidth;
  inputCanvas.height = geometry.targetHeight;
  const context = inputCanvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = 'rgb(114, 114, 114)';
  context.fillRect(0, 0, inputCanvas.width, inputCanvas.height);
  context.drawImage(canvas, 0, 0, geometry.targetWidth, geometry.resizedHeight);
  const rgba = context.getImageData(0, 0, inputCanvas.width, inputCanvas.height).data;
  const plane = inputCanvas.width * inputCanvas.height;
  const values = new Float32Array(plane * 3);
  for (let index = 0; index < plane; index++) {
    const offset = index * 4;
    values[index] = rgba[offset] / 255;
    values[plane + index] = rgba[offset + 1] / 255;
    values[plane * 2 + index] = rgba[offset + 2] / 255;
  }
  return {
    geometry,
    tensor: new ort.Tensor('float32', values, [1, 3, inputCanvas.height, inputCanvas.width])
  };
}

async function loadSession() {
  if (!sessionPromise) {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = {
      mjs: extensionUrl(WASM_MODULE_PATH),
      wasm: extensionUrl(WASM_PATH)
    };
    sessionPromise = fetch(extensionUrl(MODEL_PATH))
      .then(response => {
        if (!response.ok) throw new Error(t('modelUnavailable', { status: response.status }));
        return response.arrayBuffer();
      })
      .then(model => ort.InferenceSession.create(model, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      }))
      .catch(error => {
        sessionPromise = null;
        throw error;
      });
  }
  return sessionPromise;
}

export async function detectMathRegions(canvas, options = {}) {
  const { confidence = DEFAULT_CONFIDENCE, signal = null, onProgress = () => {} } = options;
  onProgress('preparing');
  const input = canvasTensor(canvas);
  const run = async () => {
    let outputs = null;
    try {
      signal?.throwIfAborted();
      onProgress('model');
      const session = await loadSession();
      signal?.throwIfAborted();
      onProgress('inference');
      outputs = await session.run({ images: input.tensor });
      signal?.throwIfAborted();
      onProgress('postprocess');
      return decodeMathRegions(outputs.output0, input.geometry, confidence)
        .map(region => ({
          ...region,
          x: Math.max(0, region.x),
          y: Math.max(0, region.y),
          width: Math.min(canvas.width, region.x + region.width) - Math.max(0, region.x),
          height: Math.min(canvas.height, region.y + region.height) - Math.max(0, region.y)
        }))
        .filter(region => region.width > 2 && region.height > 2);
    } finally {
      input.tensor.dispose?.();
      Object.values(outputs || {}).forEach(tensor => tensor.dispose?.());
    }
  };
  onProgress('queued');
  const inference = inferenceTail.then(run, run);
  inferenceTail = inference.then(() => undefined, () => undefined);
  return inference;
}

function verticalDistance(region, y) {
  if (y < region.y) return region.y - y;
  if (y > region.y + region.height) return y - region.y - region.height;
  return 0;
}

export function selectRegionForLabel(regions, labelY) {
  const candidates = regions
    .filter(region => region.kind === 'display')
    .map(region => ({
      region,
      distance: verticalDistance(region, labelY),
      score: verticalDistance(region, labelY)
    }))
    .filter(candidate => candidate.distance <= Math.max(24, candidate.region.height))
    .sort((a, b) => a.score - b.score || b.region.confidence - a.region.confidence);
  if (!candidates.length) return null;
  if (candidates[1] && Math.abs(candidates[1].score - candidates[0].score) < 2) return null;
  return candidates[0].region;
}

function intersectionArea(first, second) {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

export function selectRegionForRect(regions, rect) {
  const candidates = regions.map(region => {
    const overlap = intersectionArea(region, rect);
    const smallerArea = Math.min(region.width * region.height, rect.width * rect.height);
    return { region, overlap: smallerArea > 0 ? overlap / smallerArea : 0 };
  }).filter(candidate => candidate.overlap >= .08)
    .sort((a, b) => b.overlap - a.overlap || b.region.confidence - a.region.confidence);
  if (!candidates.length) return null;
  if (candidates[1] && candidates[1].overlap >= candidates[0].overlap * .9) return null;
  return candidates[0].region;
}

export function mathRegionCropBounds(
  canvas,
  region,
  padding = 8,
  coordinateScale = 1
) {
  const scale = Number.isFinite(coordinateScale) && coordinateScale > 0
    ? coordinateScale
    : 1;
  const x = Math.max(0, Math.floor((region.x - padding) * scale));
  const y = Math.max(0, Math.floor((region.y - padding) * scale));
  const right = Math.min(
    canvas.width,
    Math.ceil((region.x + region.width + padding) * scale)
  );
  const bottom = Math.min(
    canvas.height,
    Math.ceil((region.y + region.height + padding) * scale)
  );
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

export function cropMathRegion(canvas, region, padding = 8, coordinateScale = 1) {
  const bounds = mathRegionCropBounds(canvas, region, padding, coordinateScale);
  if (!bounds) return null;
  const crop = document.createElement('canvas');
  crop.width = bounds.width;
  crop.height = bounds.height;
  crop.getContext('2d').drawImage(
    canvas,
    bounds.x,
    bounds.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );
  return crop.toDataURL('image/png');
}
