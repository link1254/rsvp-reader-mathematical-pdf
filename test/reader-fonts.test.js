import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_READER_FONT,
  normalizeReaderFont,
  readerFontStack,
  READER_FONT_STACKS
} from '../src/reader-fonts.js';

const html = readFileSync(
  new URL('../src/sidepanel.html', import.meta.url),
  'utf8'
);
const source = readFileSync(
  new URL('../src/sidepanel.js', import.meta.url),
  'utf8'
);

describe('reader fonts', () => {
  it('provides the system, accessibility, and LaTeX-style choices', () => {
    expect(Object.keys(READER_FONT_STACKS)).toEqual([
      'system',
      'atkinson',
      'opendyslexic',
      'lexend',
      'latex'
    ]);
    for (const value of Object.keys(READER_FONT_STACKS)) {
      expect(html).toContain(`value="${value}"`);
    }
  });

  it('falls back to the system stack for an unknown stored value', () => {
    expect(normalizeReaderFont('unknown')).toBe(DEFAULT_READER_FONT);
    expect(readerFontStack('unknown')).toBe(READER_FONT_STACKS.system);
  });

  it('persists the selected reader font', () => {
    expect(source).toContain('readerFont: state.readerFont');
    expect(source).toContain("$('#readerFont').value = state.readerFont");
  });
});
