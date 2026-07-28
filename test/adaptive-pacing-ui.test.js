import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ADAPTIVE_PACING_MODES } from '../src/selection-engine.js';

const html = readFileSync(
  new URL('../src/sidepanel.html', import.meta.url),
  'utf8'
);
const source = readFileSync(
  new URL('../src/sidepanel.js', import.meta.url),
  'utf8'
);

describe('adaptive pacing settings', () => {
  it('provides and persists every pacing mode', () => {
    for (const mode of ADAPTIVE_PACING_MODES) {
      expect(html).toContain(`name="adaptivePacing" value="${mode}"`);
    }
    expect(html).toMatch(/value="normal" checked/);
    expect(source).toContain('adaptivePacing: state.adaptivePacing');
    expect(source).toContain('normalizeAdaptivePacing(state.adaptivePacing)');
    expect(source).toContain('readingDelay(item, state.wpm, state.adaptivePacing)');
  });
});
