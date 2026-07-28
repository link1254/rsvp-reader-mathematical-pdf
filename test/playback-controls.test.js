import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../src/sidepanel.js', import.meta.url),
  'utf8'
);

describe('reader playback controls', () => {
  it('opens every newly loaded selection in pause', () => {
    expect(source).not.toContain('setTimeout(play');
    expect(source).toMatch(/render\(\);\s+pause\(\);\s+}/);
  });

  it('routes the play button and space bar through the same action', () => {
    expect(source).toContain("$('#play').onclick = togglePlayback");
    expect(source).toMatch(/event\.code === 'Space'[\s\S]+togglePlayback\(\)/);
    expect(source).toContain("action === 'continue-equation'");
  });

  it('restarts sentences from the button or the up arrow', () => {
    expect(source).toContain("$('#replaySentence').onclick = replaySentence");
    expect(source).toMatch(/event\.code === 'ArrowUp'[\s\S]+replaySentence\(\)/);
    expect(source).toContain('replaySentenceIndex(state.items, state.index)');
  });
});
