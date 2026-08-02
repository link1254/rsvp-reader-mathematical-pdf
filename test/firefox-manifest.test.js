import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(
  readFileSync(new URL('../manifest.firefox.json', import.meta.url), 'utf8')
);

describe('Firefox extension manifest', () => {
  it('keeps the Firefox test build visibly marked as Beta', () => {
    expect(manifest.version).toBe('1.1.0');
    expect(manifest.version_name).toBe('1.1.0-beta.1 Firefox');
    expect(manifest.name).toBe('__MSG_appName__');
  });

  it('uses Firefox background and sidebar declarations', () => {
    expect(manifest.background).toEqual({
      scripts: ['src/background.js'],
      type: 'module'
    });
    expect(manifest.sidebar_action.default_panel).toBe('src/sidepanel.html');
    expect(manifest).not.toHaveProperty('side_panel');
  });

  it('does not request Chromium-only APIs', () => {
    expect(manifest.permissions).not.toContain('sidePanel');
    expect(manifest.permissions).not.toContain('tts');
    expect(manifest).not.toHaveProperty('minimum_chrome_version');
  });

  it('declares the Firefox signing identity and no data collection', () => {
    expect(manifest.browser_specific_settings.gecko).toMatchObject({
      id: 'rsvp-reader-beta@link1254.github.io',
      strict_min_version: '121.0',
      data_collection_permissions: { required: ['none'] }
    });
  });
});
