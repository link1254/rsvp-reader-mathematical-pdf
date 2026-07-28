import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(
  readFileSync(new URL('../manifest.json', import.meta.url), 'utf8')
);

describe('extension icons', () => {
  it('declares localized extension metadata', () => {
    expect(manifest.default_locale).toBe('fr');
    expect(manifest.name).toBe('__MSG_appName__');
    expect(manifest.description).toBe('__MSG_appDescription__');
    for (const locale of ['fr', 'en']) {
      const messages = JSON.parse(
        readFileSync(new URL(`../public/_locales/${locale}/messages.json`, import.meta.url), 'utf8')
      );
      expect(messages.appName.message).toBe('RSVP Reader Beta - Mathematical PDF');
      expect(messages.appDescription.message).toBeTruthy();
      expect(messages.actionTitle.message).toBeTruthy();
    }
  });

  it('identifies the test build as beta', () => {
    expect(manifest.version).toBe('0.16.0');
    expect(manifest.version_name).toBe('0.16.0-beta.1');
  });

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
