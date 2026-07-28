import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  synchronizedContextKey,
  synchronizedContextRange
} from '../src/synchronized-context.js';

const html = readFileSync(
  new URL('../src/sidepanel.html', import.meta.url),
  'utf8'
);
const sidepanelSource = readFileSync(
  new URL('../src/sidepanel.js', import.meta.url),
  'utf8'
);
const contextSource = readFileSync(
  new URL('../src/synchronized-context.js', import.meta.url),
  'utf8'
);
const stylesheet = readFileSync(
  new URL('../src/sidepanel.css', import.meta.url),
  'utf8'
);

describe('synchronized beta context', () => {
  const items = [
    { type: 'word', value: 'First' },
    { type: 'word', value: 'sentence.' },
    { type: 'word', value: 'Second' },
    { type: 'equation', value: 'Equation', equationId: 'eq-1' },
    { type: 'word', value: 'continues', paragraphEnd: true },
    { type: 'word', value: 'Third.' }
  ];

  it('uses sentence and paragraph boundaries for the stable context window', () => {
    expect(synchronizedContextRange(items, 3)).toEqual({ start: 2, end: 4 });
    expect(synchronizedContextRange(items, 5)).toEqual({ start: 5, end: 5 });
  });

  it('rebuilds a sentence only when its content or equation image changes', () => {
    const withoutImage = synchronizedContextKey(items, 2, 4);
    const withImage = synchronizedContextKey(
      items,
      2,
      4,
      item => item.equationId === 'eq-1' ? 'data:image/png;base64,abc' : null
    );

    expect(withImage).not.toBe(withoutImage);
    expect(synchronizedContextKey(items, 2, 4)).toBe(withoutImage);
  });

  it('keeps beta disabled by default and preserves the stable layout setting', () => {
    expect(html).toContain('id="betaFeatures" type="checkbox" role="switch"');
    expect(sidepanelSource).toContain('betaFeatures: false');
    expect(sidepanelSource).toContain('betaFeatures: state.betaFeatures');
    expect(sidepanelSource).toContain('state.horizontalContext && !state.betaFeatures');
    expect(sidepanelSource).toContain("classList.toggle('context-synchronized', state.betaFeatures)");
    expect(sidepanelSource).toContain("classList.toggle('context-beta-active', state.betaFeatures)");
  });

  it('keeps the sentence DOM stable and updates only the active token', () => {
    expect(contextSource).toContain('if (key !== renderedKey) rebuild');
    expect(contextSource).toContain("token.classList.toggle('active', isActive)");
    expect(contextSource).toContain("token.setAttribute('aria-current', 'true')");
    expect(contextSource).toContain('keepActiveTokenVisible(active)');
  });

  it('supports clickable words and faithful equation thumbnails', () => {
    expect(contextSource).toContain("container.addEventListener('click'");
    expect(contextSource).toContain('onNavigate(Number(token.dataset.contextIndex))');
    expect(contextSource).toContain("const image = document.createElement('img')");
    expect(stylesheet).toContain('.synchronized-token.equation img');
  });

  it('visually separates the beta mode from the stable reader', () => {
    expect(html).toContain('id="betaBadge"');
    expect(stylesheet).toContain('.viewport.context-synchronized');
    expect(stylesheet).toContain('.synchronized-token.active');
    expect(stylesheet).toContain('.reader.context-beta-active .equation-card');
    expect(stylesheet).toContain('.sentence-context{display:none}');
  });
});
