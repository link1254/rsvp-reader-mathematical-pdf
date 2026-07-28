import { describe, expect, it } from 'vitest';
import { cleanText, segmentText, flattenSentences, orpIndex, delayFor } from '../src/text-engine.js';

describe('scientific text engine', () => {
  it('repairs PDF line hyphenation', () => expect(cleanText('reconnais-\nsance')).toBe('reconnaissance'));
  it('segments sentences and tokens', () => {
    const sentences = segmentText('Le chat avance. Puis il dort !');
    expect(sentences).toHaveLength(2);
    expect(flattenSentences(sentences).map(t => t.value)).toContain('avance.');
  });
  it('detects common mathematical tokens', () => {
    const tokens = flattenSentences(segmentText('On pose x=2 puis ∑ i.'));
    expect(tokens.filter(t => t.isMath).map(t => t.value)).toEqual(expect.arrayContaining(['x=2', '∑']));
  });
  it('places ORP toward the left of a word', () => { expect(orpIndex('a')).toBe(0); expect(orpIndex('lecture')).toBe(2); });
  it('adds time at punctuation and equations', () => {
    expect(delayFor({ value: 'fin.', isMath: false }, 300)).toBeGreaterThan(delayFor({ value: 'mot', isMath: false }, 300));
    expect(delayFor({ value: 'x=2', isMath: true }, 300)).toBeGreaterThan(200);
  });
});
