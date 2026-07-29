export const AUTOMATIC_SPEECH_VOICE = 'auto';
export const DEFAULT_SPEECH_RATE_WPM = 200;
export const MAX_SPEECH_CHUNK_CHARACTERS = 1000;

const FRENCH_MARKERS = new Set([
  'au', 'aux', 'avec', 'ce', 'ces', 'dans', 'de', 'des', 'du', 'en', 'est',
  'et', 'la', 'le', 'les', 'nous', 'par', 'pour', 'que', 'qui', 'sur', 'une'
]);
const ENGLISH_MARKERS = new Set([
  'a', 'and', 'are', 'as', 'by', 'for', 'from', 'in', 'is', 'of', 'on',
  'that', 'the', 'this', 'to', 'we', 'which', 'with'
]);

function localePrefix(value) {
  return String(value || '').toLocaleLowerCase().split('-')[0];
}

function normalizedLocale(value) {
  return localePrefix(value) === 'en' ? 'en-US' : 'fr-FR';
}

export function speechRateFromWpm(value) {
  const wpm = Number(value);
  if (!Number.isFinite(wpm) || wpm <= 0) return 1;
  return Math.round(Math.min(4, Math.max(.4, wpm / DEFAULT_SPEECH_RATE_WPM)) * 100) / 100;
}

export function buildSpeechChunk(
  items,
  startIndex,
  maxCharacters = MAX_SPEECH_CHUNK_CHARACTERS
) {
  if (!Array.isArray(items) || !items.length) {
    return { text: '', entries: [], startIndex: 0, endIndex: -1 };
  }

  const start = Math.max(0, Math.min(items.length - 1, Number(startIndex) || 0));
  const entries = [];
  let text = '';
  for (let index = start; index < items.length; index++) {
    const item = items[index];
    if (item?.type === 'equation') break;
    const value = String(item?.value || '').trim();
    if (!value) continue;
    const separator = text ? ' ' : '';
    if (entries.length && text.length + separator.length + value.length > maxCharacters) break;
    const characterStart = text.length + separator.length;
    text += `${separator}${value}`;
    entries.push({
      index,
      start: characterStart,
      end: characterStart + value.length
    });
    if (item.paragraphEnd === true) break;
  }

  return {
    text,
    entries,
    startIndex: entries[0]?.index ?? start,
    endIndex: entries.at(-1)?.index ?? start - 1
  };
}

export function speechItemIndexAtBoundary(entries, characterIndex) {
  if (!entries?.length) return null;
  const position = Math.max(0, Number(characterIndex) || 0);
  let match = entries[0].index;
  for (const entry of entries) {
    if (entry.start > position) break;
    match = entry.index;
  }
  return match;
}

export function detectSpeechLocale(text, fallbackLocale = 'fr') {
  const words = String(text || '').toLocaleLowerCase().match(/\p{L}+/gu) || [];
  let frenchScore = /[àâçéèêëîïôùûüÿœ]/u.test(String(text || '').toLocaleLowerCase()) ? 2 : 0;
  let englishScore = 0;
  for (const word of words) {
    if (FRENCH_MARKERS.has(word)) frenchScore++;
    if (ENGLISH_MARKERS.has(word)) englishScore++;
  }
  if (englishScore > frenchScore) return 'en-US';
  if (frenchScore > englishScore) return 'fr-FR';
  return normalizedLocale(fallbackLocale);
}

export function availableSpeechVoices(voices) {
  return (Array.isArray(voices) ? voices : [])
    .filter(voice => voice?.voiceName);
}

export function localSpeechVoices(voices) {
  return availableSpeechVoices(voices)
    .filter(voice => voice.remote !== true);
}

export function selectSpeechVoice(
  voices,
  preferredVoiceName = AUTOMATIC_SPEECH_VOICE,
  locale = 'fr-FR'
) {
  const availableVoices = availableSpeechVoices(voices);
  if (preferredVoiceName && preferredVoiceName !== AUTOMATIC_SPEECH_VOICE) {
    const selected = availableVoices.find(voice => voice.voiceName === preferredVoiceName);
    if (selected) return selected;
  }

  const localVoices = localSpeechVoices(availableVoices);
  const targetLocale = String(locale || '').toLocaleLowerCase();
  const targetPrefix = localePrefix(targetLocale);
  return localVoices
    .map((voice, order) => {
      const voiceLocale = String(voice.lang || '').toLocaleLowerCase();
      const exactLanguage = voiceLocale === targetLocale;
      const matchingLanguage = localePrefix(voiceLocale) === targetPrefix;
      const wordEvents = voice.eventTypes?.includes('word') === true;
      return {
        voice,
        order,
        score: Number(exactLanguage) * 4
          + Number(matchingLanguage) * 8
          + Number(wordEvents) * 6
      };
    })
    .sort((left, right) => right.score - left.score || left.order - right.order)[0]
    ?.voice || null;
}
