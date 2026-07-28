export const DEFAULT_READER_SIZE = Object.freeze({
  width: 1000,
  height: 620
});

const MIN_READER_SIZE = Object.freeze({
  width: 360,
  height: 300
});

const WINDOW_MARGIN = 40;
const BASE_READER_VIEWPORT_HEIGHT = 255;
const MAX_READER_CONTENT_SCALE = 1.6;
const MIN_EQUATION_CONTENT_SCALE = .6;
const MAX_EQUATION_CONTENT_SCALE = 2.4;
const EQUATION_SNAPSHOT_HORIZONTAL_PADDING = 10;
export const DEFAULT_EQUATION_IMAGE_SIZE = 100;

function validDimension(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function clampDimension(value, minimum, maximum) {
  const usableMinimum = Math.min(minimum, maximum);
  return Math.min(maximum, Math.max(usableMinimum, value));
}

export function readerWindowLayout(parent = {}, savedSize = {}) {
  const availableWidth = validDimension(parent.width, 1200);
  const availableHeight = validDimension(parent.height, 800);
  const maxWidth = Math.max(1, availableWidth - WINDOW_MARGIN);
  const maxHeight = Math.max(1, availableHeight - WINDOW_MARGIN);
  const requestedWidth = validDimension(savedSize.width, DEFAULT_READER_SIZE.width);
  const requestedHeight = validDimension(savedSize.height, DEFAULT_READER_SIZE.height);
  const width = clampDimension(requestedWidth, MIN_READER_SIZE.width, maxWidth);
  const height = clampDimension(requestedHeight, MIN_READER_SIZE.height, maxHeight);
  const parentLeft = Number.isFinite(parent.left) ? parent.left : 0;
  const parentTop = Number.isFinite(parent.top) ? parent.top : 0;

  return {
    width,
    height,
    left: Math.round(parentLeft + (availableWidth - width) / 2),
    top: Math.round(parentTop + (availableHeight - height) / 2)
  };
}

export function readerWindowSize(windowInfo) {
  if (!Number.isFinite(windowInfo?.width) || !Number.isFinite(windowInfo?.height)) {
    return null;
  }

  return {
    width: Math.round(windowInfo.width),
    height: Math.round(windowInfo.height)
  };
}

export function readerContentScale(viewportHeight, horizontal = true) {
  if (!horizontal || !Number.isFinite(viewportHeight)) return 1;
  const additionalHeight = Math.max(0, viewportHeight - BASE_READER_VIEWPORT_HEIGHT);
  const scale = Math.min(MAX_READER_CONTENT_SCALE, 1 + additionalHeight / 500);
  return Math.round(scale * 100) / 100;
}

export function normalizeEquationImageSize(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_EQUATION_IMAGE_SIZE;
  return Math.min(180, Math.max(60, Math.round(numericValue / 10) * 10));
}

export function equationContentScale(
  readerScale,
  imageSize = DEFAULT_EQUATION_IMAGE_SIZE
) {
  const responsiveScale = Number.isFinite(readerScale)
    ? Math.max(1, readerScale)
    : 1;
  const scale = responsiveScale * normalizeEquationImageSize(imageSize) / 100;
  return Math.round(Math.min(
    MAX_EQUATION_CONTENT_SCALE,
    Math.max(MIN_EQUATION_CONTENT_SCALE, scale)
  ) * 100) / 100;
}

export function equationSnapshotWidth(naturalWidth, contentScale = 1) {
  if (!Number.isFinite(naturalWidth) || naturalWidth <= 0) return null;
  const scale = Number.isFinite(contentScale)
    ? Math.min(
        MAX_EQUATION_CONTENT_SCALE,
        Math.max(MIN_EQUATION_CONTENT_SCALE, contentScale)
      )
    : 1;
  return Math.round(
    (naturalWidth + EQUATION_SNAPSHOT_HORIZONTAL_PADDING) * scale
  );
}
