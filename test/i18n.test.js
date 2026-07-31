import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createTranslator,
  getUiLanguage,
  normalizeUiLanguagePreference,
  resolveUiLanguage,
  setUiLanguage,
  t,
  translationKeys
} from '../src/i18n.js';

afterEach(() => setUiLanguage('fr'));

describe('interface localization', () => {
  it('resolves automatic language from the browser locale', () => {
    expect(resolveUiLanguage('auto', 'en-GB')).toBe('en');
    expect(resolveUiLanguage('auto', 'fr-CH')).toBe('fr');
    expect(resolveUiLanguage('auto', 'de-CH')).toBe('fr');
    expect(normalizeUiLanguagePreference('de')).toBe('auto');
  });

  it('translates labels and interpolates values', () => {
    const english = createTranslator('en');
    expect(english('readSelection')).toBe('Read selection with RSVP Reader Beta');
    expect(english('wordPosition', { current: 4, total: 12 })).toBe('Word 4 of 12');

    setUiLanguage('en');
    expect(getUiLanguage()).toBe('en');
    expect(t('settings')).toBe('Settings');
  });

  it('keeps both dictionaries complete for every translated HTML label', () => {
    expect(translationKeys('en')).toEqual(translationKeys('fr'));
    const html = ['sidepanel.html', 'reader.html', 'popup.html']
      .map(file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'))
      .join('\n');
    const htmlKeys = [...html.matchAll(/data-i18n(?:-(?:title|placeholder|aria-label|alt))?="([^"]+)"/g)]
      .map(match => match[1]);
    const known = new Set(translationKeys('fr'));
    expect([...new Set(htmlKeys)].filter(key => !known.has(key))).toEqual([]);
  });
});
