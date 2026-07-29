import { describe, expect, it } from 'vitest';
import {
  readerSentenceContextEntries,
  readerSideContextEntries,
  readerSideContextText
} from '../src/reader-context.js';

const items = [
  { value: 'where', type: 'word' },
  { value: 'used', type: 'word' },
  { value: 'Mathematical notation', type: 'equation' },
  { value: 'at', type: 'word' },
  { value: 'the', type: 'word' },
  { value: 'boundary.', type: 'word' }
];

describe('reader viewport context', () => {
  it('skips equations and continues until it has enough following words', () => {
    expect(readerSideContextText(items, 1, 3, 'next')).toBe('at the boundary.');
  });

  it('skips equations in the previous context while preserving word order', () => {
    expect(readerSideContextText(items, 5, 3, 'previous')).toBe('used at the');
    expect(readerSideContextEntries(items, 0, 0, 'next')).toEqual([]);
  });

  it('removes equation placeholders from the sentence shown in the viewport', () => {
    expect(readerSentenceContextEntries(items, 0, 5)).toEqual([
      { item: items[0], index: 0 },
      { item: items[1], index: 1 },
      { item: items[3], index: 3 },
      { item: items[4], index: 4 },
      { item: items[5], index: 5 }
    ]);
  });
});
