import { describe, expect, it } from 'vitest';
import {
  AUTOMATIC_SPEECH_VOICE,
  buildSpeechChunk,
  detectSpeechLocale,
  localSpeechVoices,
  selectSpeechVoice,
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

  it('detects French and English passages independently from the interface', () => {
    expect(detectSpeechLocale('The system is defined by the equation.', 'fr')).toBe('en-US');
    expect(detectSpeechLocale('Le système est défini par cette équation.', 'en')).toBe('fr-FR');
    expect(detectSpeechLocale('Hamiltonian', 'en')).toBe('en-US');
  });

  it('keeps speech local and prefers a matching voice with word events', () => {
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
    expect(selectSpeechVoice(voices, AUTOMATIC_SPEECH_VOICE, 'en-US')?.voiceName)
      .toBe('Local English Events');
    expect(selectSpeechVoice(voices, 'Local French', 'en-US')?.voiceName)
      .toBe('Local French');
  });
});
