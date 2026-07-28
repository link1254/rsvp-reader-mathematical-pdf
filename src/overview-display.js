export const DEFAULT_OVERVIEW_MATH_MODE = 'labels';

export const OVERVIEW_MATH_MODES = Object.freeze([
  'labels',
  'previews'
]);

export function normalizeOverviewMathMode(value) {
  return OVERVIEW_MATH_MODES.includes(value)
    ? value
    : DEFAULT_OVERVIEW_MATH_MODE;
}
