import { describe, expect, it } from 'vitest';
import { fitStableWordFontSize } from '../src/word-sizing.js';

describe('stable passage word sizing', () => {
  it('keeps the preferred size when every word fits', () => {
    expect(fitStableWordFontSize({
      preferredSize: 72,
      availableLeft: 180,
      availableRight: 180,
      wordExtents: [
        { left: 90, right: 120 },
        { left: 150, right: 130 }
      ]
    })).toBe(72);
  });

  it('chooses one largest common size from the most constrained word', () => {
    expect(fitStableWordFontSize({
      preferredSize: 80,
      availableLeft: 150,
      availableRight: 150,
      wordExtents: [
        { left: 200, right: 100 },
        { left: 100, right: 160 }
      ]
    })).toBe(60);
  });

  it('preserves a readable minimum in a very narrow window', () => {
    expect(fitStableWordFontSize({
      preferredSize: 64,
      minimumSize: 18,
      availableLeft: 20,
      availableRight: 20,
      wordExtents: [{ left: 240, right: 240 }]
    })).toBe(18);
  });

  it('does not enlarge a user size below the responsive minimum', () => {
    expect(fitStableWordFontSize({
      preferredSize: 14,
      minimumSize: 18,
      availableLeft: 200,
      availableRight: 200,
      wordExtents: [{ left: 20, right: 20 }]
    })).toBe(14);
  });
});
