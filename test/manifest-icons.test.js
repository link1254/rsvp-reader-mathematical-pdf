import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(
  readFileSync(new URL('../manifest.json', import.meta.url), 'utf8')
);

describe('extension icons', () => {
  it('declares the project logo for the extension and toolbar action', () => {
    expect(manifest.icons).toEqual({
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png'
    });
    expect(manifest.action.default_icon).toEqual(manifest.icons);
  });

  it.each([16, 32, 48, 128])('provides a square %d px PNG', size => {
    const image = readFileSync(
      new URL(`../public/icons/icon-${size}.png`, import.meta.url)
    );
    expect(image.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(image.readUInt32BE(16)).toBe(size);
    expect(image.readUInt32BE(20)).toBe(size);
  });
});
