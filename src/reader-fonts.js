export const DEFAULT_READER_FONT = 'system';

export const READER_FONT_STACKS = Object.freeze({
  system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  atkinson: '"Atkinson Hyperlegible", ui-sans-serif, system-ui, sans-serif',
  opendyslexic: '"OpenDyslexic", ui-sans-serif, system-ui, sans-serif',
  lexend: '"Lexend Variable", ui-sans-serif, system-ui, sans-serif',
  latex: '"KaTeX_Main", "Times New Roman", serif'
});

export function normalizeReaderFont(value) {
  return Object.hasOwn(READER_FONT_STACKS, value) ? value : DEFAULT_READER_FONT;
}

export function readerFontStack(value) {
  return READER_FONT_STACKS[normalizeReaderFont(value)];
}

export function applyReaderFont(root, value) {
  const normalized = normalizeReaderFont(value);
  root.style.setProperty('--reader-font', readerFontStack(normalized));
  return normalized;
}
