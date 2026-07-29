import { describe, expect, it } from 'vitest';
import {
  joinHyphenatedFragments,
  repairLineHyphenation
} from '../src/word-normalization.js';

describe('PDF word normalization', () => {
  it('joins a typographic line-break hyphen', () => {
    expect(joinHyphenatedFragments('equa-', 'tions.')).toBe('equations.');
    expect(repairLineHyphenation('equa-\ntions')).toBe('equations');
  });

  it('keeps common intentional compounds as one word', () => {
    expect(joinHyphenatedFragments('well-', 'known')).toBe('well-known');
    expect(repairLineHyphenation('second-\norder')).toBe('second-order');
  });

  it('does not join a hyphen without a line continuation', () => {
    expect(joinHyphenatedFragments('value-', '42')).toBeNull();
    expect(repairLineHyphenation('value-\n42')).toBe('value-\n42');
  });
});
