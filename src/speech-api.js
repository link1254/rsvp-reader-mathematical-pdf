export const CHROME_TTS_ENGINE = 'chrome-tts';
export const WEB_SPEECH_ENGINE = 'web-speech';

function normalizedVoiceName(voice) {
  return String(voice?.voiceName || voice?.name || '').trim();
}

function normalizedVoiceKey(voice) {
  return `${normalizedVoiceName(voice).toLocaleLowerCase()}\u0000${String(voice?.lang || '').toLocaleLowerCase()}`;
}

function webVoiceDetails(voice) {
  return {
    voiceName: normalizedVoiceName(voice),
    lang: voice.lang || '',
    remote: voice.localService === false,
    eventTypes: ['start', 'word', 'end', 'error'],
    engine: WEB_SPEECH_ENGINE,
    nativeVoice: voice
  };
}

function chromeVoiceDetails(voice) {
  return {
    ...voice,
    voiceName: normalizedVoiceName(voice),
    engine: CHROME_TTS_ENGINE
  };
}

function uniqueVoices(voices) {
  const seen = new Set();
  return voices.filter(voice => {
    const key = normalizedVoiceKey(voice);
    if (!voice.voiceName || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createSpeechPlaybackApi({
  chromeTts = null,
  speechSynthesis = null,
  SpeechSynthesisUtterance = null
} = {}) {
  const voiceRegistry = new Map();
  let activeUtterance = null;

  const webSpeechAvailable = Boolean(
    speechSynthesis?.getVoices
    && speechSynthesis?.speak
    && speechSynthesis?.cancel
    && SpeechSynthesisUtterance
  );

  async function getVoices() {
    const webVoices = webSpeechAvailable
      ? speechSynthesis.getVoices().map(webVoiceDetails)
      : [];
    let chromeVoices = [];
    try {
      chromeVoices = (await chromeTts?.getVoices?.() || []).map(chromeVoiceDetails);
    } catch (error) {
      console.warn(error);
    }

    // Edge's Web Speech voices come first because this is where its Natural
    // online voices are exposed. Equivalent chrome.tts entries are deduplicated.
    const voices = uniqueVoices([...webVoices, ...chromeVoices]);
    voiceRegistry.clear();
    for (const voice of voices) {
      if (!voiceRegistry.has(voice.voiceName)) {
        voiceRegistry.set(voice.voiceName, voice);
      }
    }
    return voices;
  }

  function speakWithWebSpeech(text, options, voice) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang || voice.lang || '';
    utterance.rate = options.rate || 1;
    utterance.voice = voice.nativeVoice;
    utterance.onstart = event => options.onEvent?.({
      type: 'start',
      charIndex: event.charIndex || 0
    });
    utterance.onboundary = event => {
      if (event.name && event.name !== 'word') return;
      options.onEvent?.({
        type: 'word',
        charIndex: event.charIndex || 0
      });
    };
    utterance.onend = event => {
      activeUtterance = null;
      options.onEvent?.({
        type: 'end',
        charIndex: event.charIndex || text.length
      });
    };
    utterance.onerror = event => {
      activeUtterance = null;
      options.onEvent?.({
        type: 'error',
        charIndex: event.charIndex || 0,
        errorMessage: event.error || 'Speech synthesis failed'
      });
    };

    activeUtterance = utterance;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }

  function speak(text, options = {}) {
    const voice = voiceRegistry.get(options.voiceName);
    if (voice?.engine === WEB_SPEECH_ENGINE && webSpeechAvailable) {
      speakWithWebSpeech(text, options, voice);
      return Promise.resolve();
    }
    if (chromeTts?.speak) {
      return Promise.resolve(chromeTts.speak(text, options));
    }
    if (webSpeechAvailable) {
      const fallbackVoice = [...voiceRegistry.values()]
        .find(candidate => candidate.engine === WEB_SPEECH_ENGINE);
      if (fallbackVoice) {
        speakWithWebSpeech(text, options, fallbackVoice);
        return Promise.resolve();
      }
    }
    return Promise.reject(new Error('No speech synthesis engine is available'));
  }

  function stop() {
    activeUtterance = null;
    speechSynthesis?.cancel?.();
    chromeTts?.stop?.();
  }

  const onVoicesChanged = {
    addListener(listener) {
      speechSynthesis?.addEventListener?.('voiceschanged', listener);
      chromeTts?.onVoicesChanged?.addListener?.(listener);
    }
  };

  return {
    getVoices,
    onVoicesChanged,
    speak,
    stop
  };
}
