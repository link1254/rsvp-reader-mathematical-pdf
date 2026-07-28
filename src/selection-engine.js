const MATH_OPERATOR = /^(?:=|≡|≈|≠|≤|≥|<|>|±|∝|→|↦)$/;
const MATH_ATOM = /^(?:(?:[A-Za-zΑ-ω]{1,3}|[A-Za-zΑ-ω]+[₀-₉ₐ-ₜ⁰¹²³⁴⁵⁶⁷⁸⁹\d]+)|[+−-]?(?:\d+(?:[.,]\d+)?|∞)(?:[²³⁰¹⁴⁵⁶⁷⁸⁹])?|[∑∫∏√∞∂∇□][^\s]*)[.,;:]?$/;
const TEX_COMMAND = /\\(?:frac|sqrt|sum|int|prod|lim|begin|end|alpha|beta|gamma|theta|lambda|sigma|omega)\b/;
const MATH_CHARS = /[=≡+−–*/^_<>≈≠≤≥±×÷∝→↦∑∫∏√∞∂∇{}[\]()]|[⁰¹²³⁴⁵⁶⁷⁸⁹]|[₀₁₂₃₄₅₆₇₈₉]/g;
const MATH_CHAR = /[=≡+−–*/^_<>≈≠≤≥±×÷∝→↦∑∫∏√∞∂∇□{}[\]()]|[⁰¹²³⁴⁵⁶⁷⁸⁹]|[₀₁₂₃₄₅₆₇₈₉]/;
const GLYPH_MATH = /^[0-9A-Za-zΑ-ωℏħψφχρμνλσπτδεγ∂∇□=≡+−–*/^_<>≈≠≤≥±×÷∝→↦⇒∑∫∏√∞{}[\](),.;:⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]+$/;
const EQUATION_LABEL_CORE = String.raw`(?:\d+(?:[.:-]\d+)*(?:[a-z])?|(?:[A-Z]|[IVXLCDM]{2,})(?:[.:-]?\d+)+(?:[a-z])?)`;
const PARENTHESIZED_EQUATION_LABEL = new RegExp(`^\\(\\s*(${EQUATION_LABEL_CORE})\\s*\\)$`, 'i');
const BRACKETED_EQUATION_LABEL = new RegExp(`^\\[\\s*(${EQUATION_LABEL_CORE})\\s*\\]$`, 'i');
const BARE_EQUATION_LABEL = new RegExp(`^${EQUATION_LABEL_CORE}$`, 'i');
const STRONG_MATH_SIGNAL = /[=≡+−–*/^_<>≈≠≤≥±×÷∝→↦∑∫∏√∞∂∇□\u0370-\u03ffℏħ]/u;
export const ADAPTIVE_PACING_MODES = Object.freeze([
  'off',
  'light',
  'normal',
  'strong',
  'extreme'
]);
export const DEFAULT_ADAPTIVE_PACING = 'normal';

const PACING_PROFILES = Object.freeze({
  off: {
    lengthStepMs: 0,
    lengthMaximumMs: 0,
    numberBonus: 0,
    acronymBonus: 0,
    clauseBonus: 0,
    parenthesisPause: 0,
    sentencePause: 0,
    paragraphPause: 0,
    maximumFactor: 1
  },
  light: {
    lengthStepMs: 14,
    lengthMaximumMs: 210,
    numberBonus: .08,
    acronymBonus: .08,
    clauseBonus: .3,
    parenthesisPause: 90,
    sentencePause: 200,
    paragraphPause: 400,
    maximumFactor: 2.2
  },
  normal: {
    lengthStepMs: 25,
    lengthMaximumMs: 375,
    numberBonus: .15,
    acronymBonus: .15,
    clauseBonus: .5,
    parenthesisPause: 150,
    sentencePause: 300,
    paragraphPause: 600,
    maximumFactor: 2.8
  },
  strong: {
    lengthStepMs: 40,
    lengthMaximumMs: 600,
    numberBonus: .25,
    acronymBonus: .2,
    clauseBonus: .7,
    parenthesisPause: 220,
    sentencePause: 400,
    paragraphPause: 800,
    maximumFactor: 3.4
  },
  extreme: {
    lengthStepMs: 60,
    lengthMaximumMs: 900,
    numberBonus: .4,
    acronymBonus: .3,
    clauseBonus: 1,
    parenthesisPause: 320,
    sentencePause: 600,
    paragraphPause: 1200,
    maximumFactor: 4.5
  }
});

function isMathGlyphToken(word) {
  if (!GLYPH_MATH.test(word)) return false;
  return word.length <= 3 || /\d/.test(word) || MATH_CHAR.test(word);
}

export function parseEquationLabel(value, { allowBare = false } = {}) {
  const text = String(value || '')
    .normalize('NFC')
    .trim()
    .replace(/^（/, '(')
    .replace(/）[.,;:]?$/, ')')
    .replace(/([)\]])[.,;:]$/, '$1');
  let match = text.match(PARENTHESIZED_EQUATION_LABEL);
  if (match) return `(${match[1]})`;
  match = text.match(BRACKETED_EQUATION_LABEL);
  if (match) return `[${match[1]}]`;
  match = allowBare ? text.match(BARE_EQUATION_LABEL) : null;
  return match?.[0] || null;
}

export function isEquationLike(value) {
  const text = value.trim();
  if (!text || text.length > 160) return false;
  if (MATH_OPERATOR.test(text) || parseEquationLabel(text)) return false;
  if (TEX_COMMAND.test(text)) return true;
  if (/[\u0370-\u03ffℏħ∂∇∑∫∏√∞]/u.test(text)) return true;
  const words = text.split(/\s+/).filter(Boolean);
  const mathChars = (text.match(MATH_CHARS) || []).length;
  const proseWords = words.filter(word => /^[A-Za-zÀ-ÿ]{3,}$/.test(word)).length;
  const hasRelation = /[=≈≠≤≥<>∝]/.test(text);
  return (hasRelation && mathChars >= 1 && proseWords <= 3) || mathChars >= 3 && proseWords <= 2;
}

function splitInlineMath(line) {
  const words = line.split(/\s+/).filter(Boolean);
  const output = [];
  for (let i = 0; i < words.length;) {
    const probe = words.slice(i, i + 8);
    const glyphCount = probe.filter(isMathGlyphToken).length;
    const operatorCount = probe.filter(word => (word.match(MATH_CHARS) || []).length || MATH_OPERATOR.test(word)).length;
    const missingLeftHandSide = MATH_OPERATOR.test(words[i]) && isMathGlyphToken(words[i + 1] || '') && MATH_CHAR.test(words[i + 1]);
    if ((glyphCount >= 3 && operatorCount >= 1 || missingLeftHandSide) && !/^[,.;:]$/.test(words[i])) {
      const formula = [];
      let j = i;
      for (; j < words.length; j++) {
        const word = words[j];
        const isGlyph = isMathGlyphToken(word);
        const isMathWord = /^(?:sin|cos|tan|log|ln|lim|exp|max|min)$/i.test(word);
        if (!isGlyph && !isMathWord) break;
        formula.push(word);
      }
      if (formula.length >= (missingLeftHandSide ? 2 : 3)) {
        output.push({ value: formula.join(' '), type: 'equation' });
        i = j;
        continue;
      }
    }
    // Formes extraites par les PDF : E = mc², x ≤ 3, p → ∞.
    if (i + 2 < words.length && MATH_ATOM.test(words[i]) && MATH_OPERATOR.test(words[i + 1]) && MATH_ATOM.test(words[i + 2])) {
      output.push({ value: `${words[i]} ${words[i + 1]} ${words[i + 2]}`.replace(/[.,;:]$/, ''), type: 'equation' });
      const punctuation = words[i + 2].match(/[.,;:]$/)?.[0];
      if (punctuation) output.push({ value: punctuation, type: 'word' });
      i += 3;
      continue;
    }
    const value = words[i];
    output.push({ value, type: isEquationLike(value) ? 'equation' : 'word' });
    i++;
  }
  return output;
}

function isDenseMathToken(word) {
  if (!word) return false;
  if (parseEquationLabel(word)) return false;
  if (/^[()[\]{}.,;:]$/.test(word)) return true;
  if (MATH_CHAR.test(word)) return true;
  if (/[Α-ωℏħψφχρμνλσπτδεγ]/.test(word)) return true;
  const compact = word.replace(/[.,;:]$/, '');
  const letterRuns = compact.match(/[A-Za-z]+/g) || [];
  if (GLYPH_MATH.test(compact) && /\d/.test(compact) && letterRuns.every(run => run.length <= 3)) return true;
  return /^(?:[A-Za-z]\d*[.,;:]?|[+−-]?\d+(?:[.,]\d+)?[.,;:]?)$/.test(word);
}

function equationLabelAt(words, start) {
  for (let length = Math.min(5, words.length - start); length >= 1; length--) {
    const label = parseEquationLabel(words.slice(start, start + length).join(''));
    if (label) return { label, length };
  }
  return null;
}

function splitNumberedEquations(line) {
  const words = line.split(/\s+/).filter(Boolean);
  const ranges = [];
  for (let labelIndex = 0; labelIndex < words.length; labelIndex++) {
    const labelMatch = equationLabelAt(words, labelIndex);
    if (!labelMatch) continue;
    let start = labelIndex - 1;
    while (start >= 0 && isDenseMathToken(words[start])) start--;
    start++;
    if (words[start] === ':') start++;
    const value = words.slice(start, labelIndex).join(' ');
    if (labelIndex - start >= 4 || isEquationLike(value)) {
      ranges.push({
        start,
        end: labelIndex + labelMatch.length - 1,
        value,
        equationLabel: labelMatch.label
      });
    }
  }
  if (!ranges.length) return splitInlineMath(line);

  const output = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    if (range.start > cursor) output.push(...splitInlineMath(words.slice(cursor, range.start).join(' ')));
    output.push({
      value: range.value,
      type: 'equation',
      equationLabel: range.equationLabel
    });
    cursor = range.end + 1;
  }
  if (cursor < words.length) output.push(...splitInlineMath(words.slice(cursor).join(' ')));
  return output;
}

export function tokenizeSelection(text) {
  const normalized = text.normalize('NFC')
    .replace(/\u0003/g, '□')
    .replace(/([a-zà-ÿ])-\s*\n\s*([a-zà-ÿ])/gi, '$1$2')
    .trim();
  if (!normalized) return [];
  // Edge place souvent le numéro d'équation sur une ligne séparée. On analyse
  // donc toute la sélection comme un flux continu avant le regroupement.
  return splitNumberedEquations(normalized.replace(/\n+/g, ' '));
}

export function tokenizeDetectedProse(text) {
  return tokenizeSelection(text).flatMap(item => {
    if (item.type !== 'equation' || STRONG_MATH_SIGNAL.test(item.value)) return [item];
    return item.value.split(/\s+/).filter(Boolean).map(value => ({ value, type: 'word' }));
  });
}

export function normalizeAdaptivePacing(value) {
  return ADAPTIVE_PACING_MODES.includes(value) ? value : DEFAULT_ADAPTIVE_PACING;
}

function readableCharacterCount(value) {
  return (String(value || '').match(/[\p{L}\p{N}]/gu) || []).length;
}

function isAcronym(value) {
  const letters = String(value || '').match(/\p{L}/gu) || [];
  return letters.length >= 2
    && letters.every(letter => letter === letter.toLocaleUpperCase()
      && letter !== letter.toLocaleLowerCase());
}

function parenthesisBoundaryCount(value) {
  return Number(/[（(]/u.test(value)) + Number(/[）)]/u.test(value));
}

function endsSentence(item) {
  return item?.paragraphEnd === true
    || /[.!?…]+[”’"'»)\]]*$/u.test(String(item?.value || ''));
}

export function sentenceBounds(items, index) {
  if (!items?.length) return { start: 0, end: 0 };
  const safeIndex = Math.max(0, Math.min(items.length - 1, Number(index) || 0));
  let start = safeIndex;
  let end = safeIndex;
  while (start > 0 && !endsSentence(items[start - 1])) start--;
  while (end < items.length - 1 && !endsSentence(items[end])) end++;
  return { start, end };
}

export function replaySentenceIndex(items, index) {
  if (!items?.length) return 0;
  const { start } = sentenceBounds(items, index);
  if (index > start || start === 0) return start;
  return sentenceBounds(items, start - 1).start;
}

export function readingDelay(item, wpm, pacingMode = DEFAULT_ADAPTIVE_PACING) {
  const base = 60000 / Math.max(60, wpm);
  if (item.type === 'equation') return Math.max(1200, base * 5);
  const profile = PACING_PROFILES[normalizeAdaptivePacing(pacingMode)];
  const value = String(item.value || '');
  const lengthDelay = Math.min(
    profile.lengthMaximumMs,
    Math.max(0, readableCharacterCount(value) - 7) * profile.lengthStepMs
  );
  let bonus = 0;
  if (/\p{N}/u.test(value)) bonus += profile.numberBonus;
  if (isAcronym(value)) bonus += profile.acronymBonus;
  const sentenceEnd = /[.!?…]+[”’"'»)\]]*$/u.test(value);
  if (!sentenceEnd && /[,;:]+[”’"'»)\]]*$/u.test(value)) {
    bonus += profile.clauseBonus;
  }
  const adaptiveDelay = base * Math.min(profile.maximumFactor, 1 + bonus)
    + lengthDelay;
  const structuralPause = (sentenceEnd ? profile.sentencePause : 0)
    + (item.paragraphEnd ? profile.paragraphPause : 0)
    + parenthesisBoundaryCount(value) * profile.parenthesisPause;
  return Math.round(adaptiveDelay + structuralPause);
}

export function playbackAction({
  items,
  index,
  playing,
  equationMode
}) {
  if (!items?.length) return 'none';
  if (items[index]?.type === 'equation' && equationMode === 'manual') {
    return index >= items.length - 1 ? 'finish-equation' : 'continue-equation';
  }
  if (playing) return 'pause';
  return 'play';
}
