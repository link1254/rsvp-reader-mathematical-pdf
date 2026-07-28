import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sidepanelHtml = readFileSync(
  new URL('../src/sidepanel.html', import.meta.url),
  'utf8'
);

describe('sidepanel layout', () => {
  it.each(['sidepanel.css', 'horizontal.css', 'fixes.css'])(
    'loads the required %s stylesheet',
    stylesheet => {
      expect(sidepanelHtml).toContain(`href="${stylesheet}"`);
    }
  );
});
