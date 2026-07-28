const MATH_RE = /(?:\\(?:frac|sqrt|sum|int|lim|alpha|beta|gamma|theta|lambda|mu|sigma|omega)\b|[∑∫√∞≈≠≤≥±×÷∂∇]|[A-Za-z]\s*[=<>]\s*[^,.;:!?]+)/;

export function cleanText(text) {
  return text
    .normalize('NFC')
    .replace(/([a-zà-ÿ])-\s*\n\s*([a-zà-ÿ])/gi, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function segmentText(text) {
  const cleaned = cleanText(text);
  const paragraphs = cleaned.split(/\n+/).filter(Boolean);
  const sentences = [];
  for (const paragraph of paragraphs) {
    const parts = globalThis.Intl?.Segmenter
      ? [...new Intl.Segmenter('fr', { granularity: 'sentence' }).segment(paragraph)].map(x => x.segment)
      : paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
    for (const part of parts) {
      const rawTokens = part.trim().split(/\s+/).filter(Boolean);
      const tokens = rawTokens.map((value) => ({ value, isMath: MATH_RE.test(value) || (/\d/.test(value) && /[=+*/^_()\[\]{}]/.test(value)) }));
      if (tokens.length) sentences.push({ text: part.trim(), tokens });
    }
  }
  return sentences;
}

export function flattenSentences(sentences) {
  return sentences.flatMap((sentence, sentenceIndex) => sentence.tokens.map((token, tokenIndex) => ({ ...token, sentenceIndex, tokenIndex })));
}

export function orpIndex(word) {
  const letters = [...word];
  const length = letters.length;
  if (length <= 1) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  if (length <= 13) return 3;
  return 4;
}

export function delayFor(token, wpm) {
  const base = 60000 / Math.max(50, wpm);
  const word = token.value;
  let factor = 1;
  if (/[.!?][”’"']?$/.test(word)) factor += 1.4;
  else if (/[,;:][”’"']?$/.test(word)) factor += 0.65;
  if (word.length >= 12) factor += Math.min(0.8, (word.length - 11) * 0.08);
  if (token.isMath) factor += 1.25;
  return Math.round(base * factor);
}
