import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyReaderTheme,
  DEFAULT_READER_THEME,
  normalizeReaderTheme,
  READER_THEMES
} from '../src/reader-themes.js';

const html = readFileSync(
  new URL('../src/sidepanel.html', import.meta.url),
  'utf8'
);
const source = readFileSync(
  new URL('../src/sidepanel.js', import.meta.url),
  'utf8'
);
const stylesheet = readFileSync(
  new URL('../src/sidepanel.css', import.meta.url),
  'utf8'
);

describe('reader themes', () => {
  it('provides the classic and minimal choices in settings', () => {
    expect(READER_THEMES).toEqual(['classic', 'minimal']);
    for (const value of READER_THEMES) {
      expect(html).toContain(`value="${value}"`);
    }
  });

  it('falls back to the classic theme for an unknown stored value', () => {
    expect(normalizeReaderTheme('unknown')).toBe(DEFAULT_READER_THEME);
  });

  it('applies and persists the minimal theme', () => {
    const root = { dataset: {} };

    expect(applyReaderTheme(root, 'minimal')).toBe('minimal');
    expect(root.dataset.readerTheme).toBe('minimal');
    expect(source).toContain('readerTheme: state.readerTheme');
    expect(source).toContain("$('#readerTheme').value = state.readerTheme");
    expect(stylesheet).toContain('[data-reader-theme="minimal"]');
  });
});
