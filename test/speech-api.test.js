import { describe, expect, it, vi } from 'vitest';
import {
  CHROME_TTS_ENGINE,
  createSpeechPlaybackApi,
  WEB_SPEECH_ENGINE
} from '../src/speech-api.js';

class FakeUtterance {
  constructor(text) {
    this.text = text;
  }
}

function speechApis() {
  const aria = {
    name: 'Microsoft Aria Online (Natural) - English (United States)',
    lang: 'en-US',
    localService: false
  };
  const webSpeech = {
    addEventListener: vi.fn(),
    cancel: vi.fn(),
    getVoices: vi.fn(() => [aria]),
    speak: vi.fn()
  };
  const chromeTts = {
    getVoices: vi.fn(async () => [
      {
        voiceName: 'Microsoft Aria Online (Natural) - English (United States)',
        lang: 'en-US',
        remote: true
      },
      {
        voiceName: 'Microsoft David Desktop',
        lang: 'en-US',
        remote: false,
        eventTypes: ['word']
      }
    ]),
    onVoicesChanged: { addListener: vi.fn() },
    speak: vi.fn(),
    stop: vi.fn()
  };
  return { aria, chromeTts, webSpeech };
}

describe('hybrid speech API', () => {
  it('exposes Edge Natural voices and deduplicates chrome.tts equivalents', async () => {
    const { chromeTts, webSpeech } = speechApis();
    const api = createSpeechPlaybackApi({
      chromeTts,
      speechSynthesis: webSpeech,
      SpeechSynthesisUtterance: FakeUtterance
    });

    const voices = await api.getVoices();

    expect(voices).toHaveLength(2);
    expect(voices[0]).toMatchObject({
      voiceName: 'Microsoft Aria Online (Natural) - English (United States)',
      lang: 'en-US',
      remote: true,
      engine: WEB_SPEECH_ENGINE
    });
    expect(voices[1]).toMatchObject({
      voiceName: 'Microsoft David Desktop',
      engine: CHROME_TTS_ENGINE
    });
  });

  it('maps Web Speech word boundaries to the shared playback events', async () => {
    const { aria, chromeTts, webSpeech } = speechApis();
    const api = createSpeechPlaybackApi({
      chromeTts,
      speechSynthesis: webSpeech,
      SpeechSynthesisUtterance: FakeUtterance
    });
    const events = [];
    await api.getVoices();

    await api.speak('The equation', {
      voiceName: aria.name,
      lang: 'en-US',
      rate: 1.5,
      onEvent: event => events.push(event)
    });

    const utterance = webSpeech.speak.mock.calls[0][0];
    expect(utterance).toMatchObject({
      text: 'The equation',
      lang: 'en-US',
      rate: 1.5,
      voice: aria
    });
    utterance.onstart({ charIndex: 0 });
    utterance.onboundary({ name: 'word', charIndex: 4 });
    utterance.onend({ charIndex: 12 });
    expect(events).toEqual([
      { type: 'start', charIndex: 0 },
      { type: 'word', charIndex: 4 },
      { type: 'end', charIndex: 12 }
    ]);
    expect(chromeTts.speak).not.toHaveBeenCalled();
  });

  it('keeps chrome.tts voices as a local fallback and stops both engines', async () => {
    const { chromeTts, webSpeech } = speechApis();
    const api = createSpeechPlaybackApi({
      chromeTts,
      speechSynthesis: webSpeech,
      SpeechSynthesisUtterance: FakeUtterance
    });
    await api.getVoices();

    await api.speak('Local voice', {
      voiceName: 'Microsoft David Desktop',
      lang: 'en-US'
    });
    api.stop();

    expect(chromeTts.speak).toHaveBeenCalledOnce();
    expect(chromeTts.stop).toHaveBeenCalledOnce();
    expect(webSpeech.cancel).toHaveBeenCalledOnce();
  });
});
