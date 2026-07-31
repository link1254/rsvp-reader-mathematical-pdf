import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../src/sidepanel.js', import.meta.url),
  'utf8'
);
const stylesheet = readFileSync(
  new URL('../src/sidepanel.css', import.meta.url),
  'utf8'
);
const sizingSource = readFileSync(
  new URL('../src/word-sizing.js', import.meta.url),
  'utf8'
);

describe('ORP fixation guide', () => {
  it('renders the word around a dedicated focus letter', () => {
    expect(source).toContain('class="orp-left"');
    expect(source).toContain('class="focus-letter"');
    expect(source).toContain('class="orp-right"');
  });

  it('centres the focus letter with symmetric word columns', () => {
    expect(stylesheet).toContain('grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)');
    expect(stylesheet).toContain('.orp-left{justify-self:end}');
    expect(stylesheet).toContain('.orp-right{justify-self:start}');
    expect(source).toContain('Math.max(node.getBoundingClientRect().width, node.scrollWidth)');
    expect(source).toContain('left: (partWidths[0] || 0) + focusHalf');
    expect(source).toContain('right: (partWidths[2] || 0) + focusHalf');
    expect(source).toContain('stablePassageWordFontSize(current, preferredSize)');
    expect(sizingSource).toContain('Math.floor(preferred * ratio)');
  });

  it('attaches two readable guide marks directly to the focus letter', () => {
    expect(stylesheet).toContain('--focus:#ff7d87');
    expect(stylesheet).toContain('.focus-letter::before,.focus-letter::after');
    expect(stylesheet).toContain('width:2px');
    expect(stylesheet).toContain('.focus-letter::before{bottom:calc(100% + 9px)}');
    expect(stylesheet).toContain('.focus-letter::after{top:calc(100% + 9px)}');
  });
});
