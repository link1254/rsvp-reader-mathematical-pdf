export const DEFAULT_READER_THEME = 'classic';

export const READER_THEMES = Object.freeze([
  'classic',
  'minimal',
  'eliot'
]);

export function normalizeReaderTheme(value) {
  return READER_THEMES.includes(value) ? value : DEFAULT_READER_THEME;
}

export function applyReaderTheme(root, value) {
  const normalized = normalizeReaderTheme(value);
  root.dataset.readerTheme = normalized;
  return normalized;
}
