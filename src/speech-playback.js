import { joinHyphenatedFragments } from './word-normalization.js';

export const AUTOMATIC_SPEECH_VOICE = 'auto';
export const AUTOMATIC_NATURAL_SPEECH_VOICE = 'auto-natural';
export const SPEECH_VOICE_MODE_VERSION = 1;
export const DEFAULT_SPEECH_RATE_WPM = 200;
export const MAX_SPEECH_CHUNK_CHARACTERS = 1000;

const FRENCH_MARKERS = new Set([
  'alors', 'après', 'aussi', 'avant', 'avec', 'avoir', 'au', 'aux', 'bien',
  'ce', 'ces', 'cet', 'cette', 'ceci', 'cela', 'chaque', 'chez', 'comme',
  'comment', 'dans', 'de', 'des', 'donc', 'du', 'elle', 'elles', 'en',
  'encore', 'entre', 'est', 'et', 'être', 'faire', 'fait', 'faut', 'il',
  'ils', 'je', 'la', 'le', 'les', 'leur', 'leurs', 'lui', 'mais', 'même',
  'mes', 'moins', 'mon', 'ne', 'non', 'notre', 'nous', 'où', 'oui', 'par',
  'pas', 'peut', 'plus', 'pour', 'pourquoi', 'quand', 'que', 'qui', 'sans',
  'sera', 'ses', 'sont', 'sous', 'sur', 'ta', 'tes', 'ton', 'tout', 'tous',
  'toute', 'très', 'tu', 'un', 'une', 'votre', 'vous', 'bonjour', 'merci'
]);
const ENGLISH_MARKERS = new Set([
  'a', 'after', 'all', 'also', 'an', 'and', 'any', 'are', 'as', 'be',
  'been', 'before', 'between', 'by', 'can', 'could', 'did', 'do', 'does',
  'each', 'for', 'from', 'had', 'has', 'have', 'he', 'her', 'here', 'his',
  'how', 'i', 'if', 'in', 'is', 'it', 'more', 'most', 'my', 'not', 'of',
  'on', 'other', 'our', 'she', 'should', 'some', 'than', 'that', 'the',
  'their', 'them', 'then', 'there', 'they', 'this', 'to', 'was', 'we',
  'were', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with',
  'without', 'would', 'you', 'your', 'yes'
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
  let endIndex = start - 1;
  let lastEntryValue = '';
  for (let index = start; index < items.length; index++) {
    const item = items[index];
    if (item?.type === 'equation') break;
    const value = String(item?.value || '').trim();
    if (!value) continue;
    const joined = entries.length
      ? joinHyphenatedFragments(lastEntryValue, value)
      : null;
    if (joined !== null) {
      const previousEntry = entries.at(-1);
      const joinedText = `${text.slice(0, previousEntry.start)}${joined}`;
      if (joinedText.length > maxCharacters) break;
      text = joinedText;
      previousEntry.end = text.length;
      lastEntryValue = joined;
      endIndex = index;
      if (item.paragraphEnd === true) break;
      continue;
    }
    const separator = text ? ' ' : '';
    if (entries.length && text.length + separator.length + value.length > maxCharacters) break;
    const characterStart = text.length + separator.length;
    text += `${separator}${value}`;
    entries.push({
      index,
      start: characterStart,
      end: characterStart + value.length
    });
    lastEntryValue = value;
    endIndex = index;
    if (item.paragraphEnd === true) break;
  }

  return {
    text,
    entries,
    startIndex: entries[0]?.index ?? start,
    endIndex
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
  const normalizedText = String(text || '').toLocaleLowerCase();
  const words = normalizedText.match(/\p{L}+/gu) || [];
  const accentedLetters = normalizedText.match(/[àâçéèêëîïôùûüÿœæ]/gu) || [];
  const frenchContractions = normalizedText.match(
    /(?:^|[\s(\[])\b(?:c|d|j|l|m|n|qu|s|t)[’'][\p{L}]/gu
  ) || [];
  let frenchScore = Math.min(6, accentedLetters.length * 2)
    + frenchContractions.length * 2;
  let englishScore = 0;
  for (const word of words) {
    if (FRENCH_MARKERS.has(word)) frenchScore++;
    if (ENGLISH_MARKERS.has(word)) englishScore++;
  }
  if (englishScore > frenchScore) return 'en-US';
  if (frenchScore > englishScore) return 'fr-FR';
  return normalizedLocale(fallbackLocale);
}

export function speechLocaleFallbackForSource({
  sourceType,
  sourceUrl,
  pageUrl,
  pageLanguage
} = {}) {
  if (sourceType === 'pdf') return 'en-US';

  try {
    const hostname = new URL(sourceUrl || pageUrl || '').hostname;
    if (hostname === 'chatgpt.com'
      || hostname.endsWith('.chatgpt.com')
      || hostname === 'claude.ai'
      || hostname.endsWith('.claude.ai')) {
      return 'fr-FR';
    }
  } catch {
    // Fall back to the page language or the preferred web default below.
  }

  const pagePrefix = localePrefix(pageLanguage);
  return pagePrefix === 'en' || pagePrefix === 'fr'
    ? normalizedLocale(pageLanguage)
    : 'fr-FR';
}

export function availableSpeechVoices(voices) {
  return (Array.isArray(voices) ? voices : [])
    .filter(voice => voice?.voiceName);
}

export function isMicrosoftAriaNaturalVoice(voice) {
  return /^Microsoft Aria Online \(Natural\)/i.test(String(voice?.voiceName || ''))
    && String(voice?.lang || '').toLocaleLowerCase() === 'en-us';
}

export function isMicrosoftDeniseNaturalVoice(voice) {
  return /^Microsoft Denise Online \(Natural\)/i.test(String(voice?.voiceName || ''))
    && String(voice?.lang || '').toLocaleLowerCase() === 'fr-fr';
}

export function isMicrosoftOnlineNaturalVoice(voice) {
  return /^Microsoft .+ Online \(Natural\)/i.test(String(voice?.voiceName || ''));
}

export function migrateSpeechVoicePreference(
  preferredVoiceName,
  previousVersion = 0
) {
  const voiceName = typeof preferredVoiceName === 'string'
    ? preferredVoiceName
    : AUTOMATIC_SPEECH_VOICE;
  const migrateAria = Number(previousVersion) < SPEECH_VOICE_MODE_VERSION
    && isMicrosoftAriaNaturalVoice({ voiceName, lang: 'en-US' });
  return {
    voiceName: migrateAria ? AUTOMATIC_NATURAL_SPEECH_VOICE : voiceName,
    version: SPEECH_VOICE_MODE_VERSION
  };
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
    if (preferredVoiceName === AUTOMATIC_NATURAL_SPEECH_VOICE) {
      const targetLocale = String(locale || '').toLocaleLowerCase();
      const targetPrefix = localePrefix(targetLocale);
      const naturalVoice = availableVoices
        .filter(voice => (
          isMicrosoftOnlineNaturalVoice(voice)
          && localePrefix(voice.lang) === targetPrefix
        ))
        .map((voice, order) => ({
          voice,
          order,
          score: Number(String(voice.lang || '').toLocaleLowerCase() === targetLocale) * 4
            + Number(targetPrefix === 'en' && isMicrosoftAriaNaturalVoice(voice)) * 12
            + Number(targetPrefix === 'fr' && isMicrosoftDeniseNaturalVoice(voice)) * 12
            + Number(voice.eventTypes?.includes('word') === true) * 6
        }))
        .sort((left, right) => right.score - left.score || left.order - right.order)[0]
        ?.voice;
      if (naturalVoice) return naturalVoice;
    } else {
      const selected = availableVoices.find(voice => voice.voiceName === preferredVoiceName);
      if (selected) return selected;
    }
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
