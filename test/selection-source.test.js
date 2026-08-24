import { describe, expect, it } from 'vitest';
import {
  SELECTION_SOURCES,
  resolvePdfUrl,
  selectionSource
} from '../src/selection-source.js';

describe('automatic selection source detection', () => {
  it('keeps direct and browser-viewer PDF URLs on the PDF path', () => {
    expect(selectionSource({
      tabUrl: 'file:///C:/Documents/physics.pdf'
    })).toBe(SELECTION_SOURCES.PDF);
    expect(resolvePdfUrl({
      pageUrl: 'extension://viewer/index.html?file=https%3A%2F%2Fexample.com%2Fnotes.pdf'
    })).toBe('https://example.com/notes.pdf');
  });

  it('uses the HTML path for ChatGPT, Claude, and ordinary pages', () => {
    for (const tabUrl of [
      'https://chatgpt.com/c/example',
      'https://claude.ai/chat/example',
      'https://example.com/article'
    ]) {
      expect(selectionSource({ tabUrl })).toBe(SELECTION_SOURCES.HTML);
    }
  });
});
