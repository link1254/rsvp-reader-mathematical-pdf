import { describe, expect, it } from 'vitest';
import {
  AUTOMATIC_NATURAL_SPEECH_VOICE,
  AUTOMATIC_SPEECH_VOICE,
  availableSpeechVoices,
  buildSpeechChunk,
  detectSpeechLocale,
  isMicrosoftAriaNaturalVoice,
  isMicrosoftDeniseNaturalVoice,
  localSpeechVoices,
  migrateSpeechVoicePreference,
  selectSpeechVoice,
  speechLocaleFallbackForSource,
  speechItemIndexAtBoundary,
  speechRateFromWpm
} from '../src/speech-playback.js';

describe('synchronized speech playback', () => {
  it('calibrates the speech engine from the RSVP speed', () => {
    expect(speechRateFromWpm(80)).toBe(.4);
    expect(speechRateFromWpm(200)).toBe(1);
    expect(speechRateFromWpm(300)).toBe(1.5);
    expect(speechRateFromWpm(800)).toBe(4);
    expect(speechRateFromWpm('invalid')).toBe(1);
  });

  it('builds a continuous speech chunk and stops before an equation', () => {
    const chunk = buildSpeechChunk([
      { value: 'The', type: 'word' },
      { value: 'system', type: 'word' },
      { value: 'Equation', type: 'equation' },
      { value: 'continues', type: 'word' }
    ], 0);

    expect(chunk.text).toBe('The system');
    expect(chunk.entries).toEqual([
      { index: 0, start: 0, end: 3 },
      { index: 1, start: 4, end: 10 }
    ]);
    expect(chunk.endIndex).toBe(1);
  });

  it('maps audio character boundaries back to RSVP items', () => {
    const { entries } = buildSpeechChunk([
      { value: 'alpha', type: 'word' },
      { value: 'beta', type: 'word' },
      { value: 'gamma', type: 'word' }
    ], 0);

    expect(speechItemIndexAtBoundary(entries, 0)).toBe(0);
    expect(speechItemIndexAtBoundary(entries, 6)).toBe(1);
    expect(speechItemIndexAtBoundary(entries, 11)).toBe(2);
  });

  it('speaks a residual PDF line hyphenation as one complete word', () => {
    const chunk = buildSpeechChunk([
      { value: 'Lagrange', type: 'word' },
      { value: 'equa-', type: 'word' },
      { value: 'tions.', type: 'word' },
      { value: 'continue', type: 'word' }
    ], 0);

    expect(chunk.text).toBe('Lagrange equations. continue');
    expect(chunk.entries).toEqual([
      { index: 0, start: 0, end: 8 },
      { index: 1, start: 9, end: 19 },
      { index: 3, start: 20, end: 28 }
    ]);
    expect(chunk.endIndex).toBe(3);
  });

  it('detects French and English passages independently from the interface', () => {
    expect(detectSpeechLocale('The system is defined by the equation.', 'fr')).toBe('en-US');
    expect(detectSpeechLocale('Le système est défini par cette équation.', 'en')).toBe('fr-FR');
    expect(detectSpeechLocale('Hamiltonian', 'en')).toBe('en-US');
    expect(detectSpeechLocale('Je comprends.', 'en')).toBe('fr-FR');
    expect(detectSpeechLocale("D'accord.", 'en')).toBe('fr-FR');
    expect(detectSpeechLocale('I understand.', 'fr')).toBe('en-US');
  });

  it('uses French as the ambiguous ChatGPT and Claude fallback', () => {
    expect(speechLocaleFallbackForSource({
      sourceType: 'html',
      sourceUrl: 'https://chatgpt.com/c/example',
      pageLanguage: 'en-US'
    })).toBe('fr-FR');
    expect(speechLocaleFallbackForSource({
      sourceType: 'html',
      sourceUrl: 'https://claude.ai/chat/example',
      pageLanguage: 'en-US'
    })).toBe('fr-FR');
    expect(speechLocaleFallbackForSource({
      sourceType: 'html',
      sourceUrl: 'https://example.com/article',
      pageLanguage: 'en-US'
    })).toBe('en-US');
    expect(speechLocaleFallbackForSource({
      sourceType: 'pdf',
      pageLanguage: 'fr-FR'
    })).toBe('en-US');
  });

  it('migrates a previously selected Aria voice to automatic language mode once', () => {
    const aria = 'Microsoft Aria Online (Natural) - English (United States)';
    expect(migrateSpeechVoicePreference(aria, 0)).toEqual({
      voiceName: AUTOMATIC_NATURAL_SPEECH_VOICE,
      version: 1
    });
    expect(migrateSpeechVoicePreference(aria, 1)).toEqual({
      voiceName: aria,
      version: 1
    });
  });

  it('keeps automatic speech local but allows an explicitly selected online voice', () => {
    const voices = [
      { voiceName: 'Remote English', lang: 'en-US', remote: true, eventTypes: ['word'] },
      { voiceName: 'Local French', lang: 'fr-FR', remote: false, eventTypes: ['word'] },
      { voiceName: 'Local English', lang: 'en-US', remote: false, eventTypes: [] },
      { voiceName: 'Local English Events', lang: 'en-GB', remote: false, eventTypes: ['word'] }
    ];

    expect(localSpeechVoices(voices).map(voice => voice.voiceName)).toEqual([
      'Local French',
      'Local English',
      'Local English Events'
    ]);
    expect(availableSpeechVoices(voices)).toHaveLength(4);
    expect(selectSpeechVoice(voices, AUTOMATIC_SPEECH_VOICE, 'en-US')?.voiceName)
      .toBe('Local English Events');
    expect(selectSpeechVoice(voices, 'Local French', 'en-US')?.voiceName)
      .toBe('Local French');
    expect(selectSpeechVoice(voices, 'Remote English', 'en-US')?.voiceName)
      .toBe('Remote English');
  });

  it('selects Aria for English and Denise for French in automatic natural mode', () => {
    const voices = [
      { voiceName: 'Microsoft Henri Online (Natural) - French (France)', lang: 'fr-FR', remote: true, eventTypes: ['word'] },
      { voiceName: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US', remote: true, eventTypes: ['word'] },
      { voiceName: 'Microsoft Denise Online (Natural) - French (France)', lang: 'fr-FR', remote: true, eventTypes: ['word'] },
      { voiceName: 'Local French', lang: 'fr-FR', remote: false, eventTypes: ['word'] }
    ];

    expect(selectSpeechVoice(voices, AUTOMATIC_NATURAL_SPEECH_VOICE, 'en-US')?.voiceName)
      .toContain('Aria Online (Natural)');
    expect(selectSpeechVoice(voices, AUTOMATIC_NATURAL_SPEECH_VOICE, 'fr-FR')?.voiceName)
      .toContain('Denise Online (Natural)');
  });

  it('falls back to another matching natural voice and then a local voice', () => {
    const naturalFallback = [
      { voiceName: 'Microsoft Henri Online (Natural) - French (France)', lang: 'fr-FR', remote: true, eventTypes: ['word'] },
      { voiceName: 'Local French', lang: 'fr-FR', remote: false, eventTypes: ['word'] }
    ];
    const localFallback = [
      { voiceName: 'Local French', lang: 'fr-FR', remote: false, eventTypes: ['word'] }
    ];

    expect(selectSpeechVoice(naturalFallback, AUTOMATIC_NATURAL_SPEECH_VOICE, 'fr-FR')?.voiceName)
      .toContain('Henri Online (Natural)');
    expect(selectSpeechVoice(localFallback, AUTOMATIC_NATURAL_SPEECH_VOICE, 'fr-FR')?.voiceName)
      .toBe('Local French');
  });

  it('recognizes the exact Microsoft Aria Natural English voice', () => {
    expect(isMicrosoftAriaNaturalVoice({
      voiceName: 'Microsoft Aria Online (Natural) - English (United States)',
      lang: 'en-US'
    })).toBe(true);
    expect(isMicrosoftAriaNaturalVoice({
      voiceName: 'Microsoft Aria Online (Natural) - French (France)',
      lang: 'fr-FR'
    })).toBe(false);
    expect(isMicrosoftDeniseNaturalVoice({
      voiceName: 'Microsoft Denise Online (Natural) - French (France)',
      lang: 'fr-FR'
    })).toBe(true);
  });
});
