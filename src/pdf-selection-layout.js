import { parseEquationLabel } from './selection-engine.js';
import { joinHyphenatedFragments } from './word-normalization.js';

function comparableCharacters(value, itemIndex = null) {
  const entries = [];
  for (let offset = 0; offset < value.length;) {
    const symbol = String.fromCodePoint(value.codePointAt(offset));
    const end = offset + symbol.length;
    const comparable = symbol.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]/gu) || [];
    comparable.forEach(char => entries.push({
      char,
      itemIndex,
      charStart: offset,
      charEnd: end
    }));
    offset = end;
  }
  return entries;
}

function exactSelectionMatch(items, selectionText) {
  const selectionEntries = comparableCharacters(selectionText);
  const needle = selectionEntries.map(entry => entry.char).join('');
  if (needle.length < 2) return null;
  const pageEntries = items.flatMap((item, itemIndex) => comparableCharacters(item.str || '', itemIndex));
  const haystack = pageEntries.map(entry => entry.char).join('');
  const matches = [];
  for (let from = 0; from <= haystack.length - needle.length;) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) break;
    matches.push(index);
    from = index + 1;
  }
  if (matches.length !== 1) return null;
  const first = pageEntries[matches[0]];
  const last = pageEntries[matches[0] + needle.length - 1];
  const prefix = selectionText.slice(0, selectionEntries[0].charStart);
  const suffix = selectionText.slice(selectionEntries.at(-1).charEnd);
  const firstValue = items[first.itemIndex].str || '';
  const lastValue = items[last.itemIndex].str || '';
  const includePrefix = prefix && firstValue.slice(Math.max(0, first.charStart - prefix.length), first.charStart) === prefix;
  const includeSuffix = suffix && lastValue.slice(last.charEnd, last.charEnd + suffix.length) === suffix;
  return {
    start: first.itemIndex,
    end: last.itemIndex,
    startChar: includePrefix ? first.charStart - prefix.length : first.charStart,
    endChar: includeSuffix ? last.charEnd + suffix.length : last.charEnd,
    exact: true
  };
}

function wordEntries(value, itemIndex = null) {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  return [...normalized.matchAll(/[\p{L}\p{N}]+/gu)].map(match => ({
    value: match[0],
    itemIndex,
    charStart: match.index,
    charEnd: match.index + match[0].length
  }));
}

function sequenceIndexes(haystack, needle, from = 0) {
  const indexes = [];
  outer: for (let index = from; index <= haystack.length - needle.length; index++) {
    for (let offset = 0; offset < needle.length; offset++) {
      if (haystack[index + offset].value !== needle[offset]) continue outer;
    }
    indexes.push(index);
  }
  return indexes;
}

function longestCommonSubsequence(first, second) {
  const key = entry => entry.value ?? entry.char;
  const rows = Array.from(
    { length: first.length + 1 },
    () => new Uint16Array(second.length + 1)
  );
  for (let firstIndex = 1; firstIndex <= first.length; firstIndex++) {
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex++) {
      rows[firstIndex][secondIndex] = key(first[firstIndex - 1]) === key(second[secondIndex - 1])
        ? rows[firstIndex - 1][secondIndex - 1] + 1
        : Math.max(rows[firstIndex - 1][secondIndex], rows[firstIndex][secondIndex - 1]);
    }
  }

  const pairs = [];
  let firstIndex = first.length;
  let secondIndex = second.length;
  while (firstIndex > 0 && secondIndex > 0) {
    if (key(first[firstIndex - 1]) === key(second[secondIndex - 1])
      && rows[firstIndex][secondIndex] === rows[firstIndex - 1][secondIndex - 1] + 1) {
      pairs.push([firstIndex - 1, secondIndex - 1]);
      firstIndex--;
      secondIndex--;
    } else if (rows[firstIndex - 1][secondIndex] >= rows[firstIndex][secondIndex - 1]) {
      firstIndex--;
    } else {
      secondIndex--;
    }
  }
  return pairs.reverse();
}

function characterAlignedSelectionMatch(items, selectionText) {
  const selected = comparableCharacters(selectionText);
  if (selected.length < 80) return null;
  const pageCharacters = items
    .flatMap((item, itemIndex) => comparableCharacters(item.str || '', itemIndex));
  const pageText = pageCharacters.map(entry => entry.char).join('');
  const maximumAnchorOffset = Math.min(160, Math.floor(selected.length * .14));
  const anchorSizes = [48, 36, 28];
  let anchors = [];

  for (let selectedStart = 0; selectedStart <= maximumAnchorOffset; selectedStart += 8) {
    for (const anchorSize of anchorSizes) {
      if (selectedStart + anchorSize > selected.length) continue;
      const needle = selected
        .slice(selectedStart, selectedStart + anchorSize)
        .map(entry => entry.char)
        .join('');
      const occurrences = [];
      for (let from = 0; from <= pageText.length - needle.length;) {
        const occurrence = pageText.indexOf(needle, from);
        if (occurrence < 0) break;
        occurrences.push(occurrence);
        from = occurrence + 1;
      }
      if (occurrences.length) {
        anchors = occurrences.map(pageStart => ({
          anchorSize,
          pageStart,
          selectedStart
        }));
        break;
      }
    }
    if (anchors.length) break;
  }
  if (!anchors.length) return null;

  const candidates = [];
  for (const anchor of anchors) {
    const {
      anchorSize,
      pageStart,
      selectedStart
    } = anchor;
    const prefixPageStart = Math.max(
      0,
      pageStart - Math.ceil(selectedStart * 2.5) - 80
    );
    const prefixPairs = longestCommonSubsequence(
      selected.slice(0, selectedStart),
      pageCharacters.slice(prefixPageStart, pageStart)
    ).map(([selectedIndex, pageIndex]) => [
      selectedIndex,
      prefixPageStart + pageIndex
    ]);
    const selectedTail = selected.slice(selectedStart + anchorSize);
    const maximumPageEnd = Math.min(
      pageCharacters.length,
      pageStart + anchorSize + Math.ceil(selectedTail.length * 2.5) + 120
    );
    const tailPairs = longestCommonSubsequence(
      selectedTail,
      pageCharacters.slice(pageStart + anchorSize, maximumPageEnd)
    ).map(([selectedIndex, pageIndex]) => [
      selectedStart + anchorSize + selectedIndex,
      pageStart + anchorSize + pageIndex
    ]);
    const pairs = [
      ...prefixPairs,
      ...Array.from({ length: anchorSize }, (_, index) => [
        selectedStart + index,
        pageStart + index
      ]),
      ...tailPairs
    ];
    const firstPair = pairs[0];
    const lastPair = pairs.at(-1);
    const coverage = pairs.length / selected.length;
    const endCoverage = (lastPair[0] + 1) / selected.length;
    const spanLength = lastPair[1] - firstPair[1] + 1;
    const lengthSimilarity = Math.min(selected.length, spanLength)
      / Math.max(selected.length, spanLength);
    const minimumCoverage = selected.length >= 400 ? .64 : .72;
    if (coverage < minimumCoverage || endCoverage < .84 || lengthSimilarity < .42) continue;
    candidates.push({
      start: firstPair[1],
      lastIndex: lastPair[1],
      selectedStart: firstPair[0],
      selectedEnd: lastPair[0],
      coverage,
      score: coverage * .82
        + lengthSimilarity * .13
        + (anchorSize / 48) * .05
    });
  }

  const ranked = candidates.sort((first, second) => second.score - first.score);
  if (!ranked.length) return null;
  if (ranked[1] && ranked[0].score - ranked[1].score < .08) {
    const overlap = Math.max(
      0,
      Math.min(ranked[0].lastIndex, ranked[1].lastIndex)
        - Math.max(ranked[0].start, ranked[1].start)
        + 1
    );
    const shorterLength = Math.min(
      ranked[0].lastIndex - ranked[0].start + 1,
      ranked[1].lastIndex - ranked[1].start + 1
    );
    if (overlap / shorterLength < .8) return null;
  }
  const best = ranked[0];
  const first = pageCharacters[best.start];
  const last = pageCharacters[best.lastIndex];
  return {
    start: first.itemIndex,
    end: last.itemIndex,
    startChar: first.charStart,
    endChar: last.charEnd,
    exact: false,
    score: best.score,
    coverage: best.coverage,
    characterAligned: true,
    selectedStartChar: selected[best.selectedStart].charStart,
    selectedEndChar: selected[best.selectedEnd].charEnd
  };
}

function alignedSelectionMatch(items, selectionText) {
  const selected = wordEntries(selectionText).filter(entry => entry.value.length >= 2);
  if (selected.length < 12) return null;
  const pageWords = items
    .flatMap((item, itemIndex) => wordEntries(item.str || '', itemIndex))
    .filter(entry => entry.value.length >= 2);
  const maximumAnchorOffset = Math.min(
    12,
    Math.floor(selected.length * .12),
    selected.length - 3
  );
  const candidates = new Map();

  for (let anchorSize = 5; anchorSize >= 3; anchorSize--) {
    for (let selectedStart = 0; selectedStart <= maximumAnchorOffset; selectedStart++) {
      if (selectedStart + anchorSize > selected.length) continue;
      const anchor = selected
        .slice(selectedStart, selectedStart + anchorSize)
        .map(entry => entry.value);
      const starts = sequenceIndexes(pageWords, anchor);
      for (const pageStart of starts) {
        const selectedTail = selected.slice(selectedStart + anchorSize);
        const maximumPageEnd = Math.min(
          pageWords.length,
          pageStart + Math.ceil(selected.length * 2.5) + 30
        );
        const pageTail = pageWords.slice(pageStart + anchorSize, maximumPageEnd);
        const tailPairs = longestCommonSubsequence(selectedTail, pageTail);
        const pairs = [
          ...anchor.map((_, index) => [selectedStart + index, pageStart + index]),
          ...tailPairs.map(([selectedIndex, pageIndex]) => [
            selectedStart + anchorSize + selectedIndex,
            pageStart + anchorSize + pageIndex
          ])
        ];
        const lastPair = pairs.at(-1);
        const coverage = pairs.length / selected.length;
        const endCoverage = (lastPair[0] + 1) / selected.length;
        const spanLength = lastPair[1] - pageStart + 1;
        const comparedSelectionLength = selected.length - selectedStart;
        const lengthSimilarity = Math.min(comparedSelectionLength, spanLength)
          / Math.max(comparedSelectionLength, spanLength);
        const minimumCoverage = selected.length >= 40 ? .62 : .7;
        if (coverage < minimumCoverage || endCoverage < .82 || lengthSimilarity < .45) continue;

        const score = coverage * .8
          + lengthSimilarity * .15
          + (anchorSize / 5) * .05;
        const key = `${pageStart}:${lastPair[1]}`;
        const previous = candidates.get(key);
        if (!previous || score > previous.score) {
          candidates.set(key, {
            start: pageStart,
            lastIndex: lastPair[1],
            score,
            coverage,
            anchorSize,
            selectedStart,
            selectedEnd: lastPair[0]
          });
        }
      }
    }
  }

  const ranked = [...candidates.values()]
    .sort((first, second) => second.score - first.score
      || second.coverage - first.coverage
      || second.anchorSize - first.anchorSize);
  if (!ranked.length) return null;
  if (ranked[1] && ranked[0].score - ranked[1].score < .08) {
    const overlap = Math.max(
      0,
      Math.min(ranked[0].lastIndex, ranked[1].lastIndex)
        - Math.max(ranked[0].start, ranked[1].start)
        + 1
    );
    const shorterLength = Math.min(
      ranked[0].lastIndex - ranked[0].start + 1,
      ranked[1].lastIndex - ranked[1].start + 1
    );
    if (overlap / shorterLength < .8) return null;
  }
  const best = ranked[0];
  const first = pageWords[best.start];
  const last = pageWords[best.lastIndex];
  return {
    start: first.itemIndex,
    end: last.itemIndex,
    startChar: first.charStart,
    endChar: last.charEnd,
    exact: false,
    score: best.score,
    coverage: best.coverage,
    aligned: true,
    selectedStartChar: selected[best.selectedStart].charStart,
    selectedEndChar: selected[best.selectedEnd].charEnd
  };
}

function anchoredSelectionMatch(items, selectionText) {
  const selected = wordEntries(selectionText).filter(entry => entry.value.length >= 2);
  if (selected.length < 4) return null;
  const pageWords = items
    .flatMap((item, itemIndex) => wordEntries(item.str || '', itemIndex))
    .filter(entry => entry.value.length >= 2);
  const candidates = new Map();
  for (let size = Math.min(5, Math.floor(selected.length / 2)); size >= 2; size--) {
    const firstNeedle = selected.slice(0, size).map(entry => entry.value);
    const lastNeedle = selected.slice(-size).map(entry => entry.value);
    const starts = sequenceIndexes(pageWords, firstNeedle);
    for (const start of starts) {
      const ends = sequenceIndexes(pageWords, lastNeedle, start + size);
      for (const end of ends) {
        const lastIndex = end + size - 1;
        const key = `${start}:${lastIndex}`;
        const span = pageWords.slice(start, lastIndex + 1);
        const ngramSize = selected.length >= 8 ? 3 : 2;
        const total = selected.length - ngramSize + 1;
        let matched = 0;
        let from = 0;
        for (let index = 0; index < total; index++) {
          const matches = sequenceIndexes(
            span,
            selected.slice(index, index + ngramSize).map(entry => entry.value),
            from
          );
          if (!matches.length) continue;
          matched++;
          from = matches[0] + 1;
        }
        const coverage = total > 0 ? matched / total : 0;
        const lengthSimilarity = Math.min(selected.length, span.length)
          / Math.max(selected.length, span.length);
        const score = coverage * .85 + lengthSimilarity * .15;
        const previous = candidates.get(key);
        if (!previous || score > previous.score) {
          candidates.set(key, {
            start,
            lastIndex,
            score,
            coverage,
            anchorSize: size,
            selectedStart: 0,
            selectedEnd: selected.length - 1
          });
        }
      }
    }
  }
  const ranked = [...candidates.values()]
    .filter(candidate => candidate.coverage >= .45 && candidate.score >= .55)
    .sort((first, second) => second.score - first.score
      || second.anchorSize - first.anchorSize);
  if (!ranked.length) return null;
  if (ranked[1] && ranked[0].score - ranked[1].score < .08) return null;
  const best = ranked[0];
  const first = pageWords[best.start];
  const last = pageWords[best.lastIndex];
  return {
    start: first.itemIndex,
    end: last.itemIndex,
    startChar: first.charStart,
    endChar: last.charEnd,
    exact: false,
    score: best.score,
    coverage: best.coverage,
    selectedStartChar: selected[best.selectedStart].charStart,
    selectedEndChar: selected[best.selectedEnd].charEnd
  };
}

function recoverSelectionBoundaries(items, selectionText, match) {
  if (!match) return null;
  const {
    selectedStartChar,
    selectedEndChar,
    ...selection
  } = match;
  if (!Number.isFinite(selectedStartChar) && !Number.isFinite(selectedEndChar)) {
    return selection;
  }

  const pageEntries = items.flatMap(
    (item, itemIndex) => comparableCharacters(item.str || '', itemIndex)
  );
  const beginsSelection = entry => entry.itemIndex > selection.start
    || (entry.itemIndex === selection.start && entry.charStart >= selection.startChar);
  const endsSelection = entry => entry.itemIndex > selection.end
    || (entry.itemIndex === selection.end && entry.charStart >= selection.endChar);

  if (selectedStartChar > 0) {
    const prefix = comparableCharacters(selectionText.slice(0, selectedStartChar));
    const boundary = pageEntries.findIndex(beginsSelection);
    const candidateStart = boundary - prefix.length;
    if (prefix.length >= 2 && candidateStart >= 0) {
      const expected = prefix.map(entry => entry.char).join('');
      const adjacent = pageEntries
        .slice(candidateStart, boundary)
        .map(entry => entry.char)
        .join('');
      if (adjacent === expected) {
        const first = pageEntries[candidateStart];
        selection.start = first.itemIndex;
        selection.startChar = first.charStart;
      }
    }
  }

  if (selectedEndChar < selectionText.length) {
    const suffix = comparableCharacters(selectionText.slice(selectedEndChar));
    const boundary = pageEntries.findIndex(endsSelection);
    if (suffix.length >= 2 && boundary >= 0) {
      const expected = suffix.map(entry => entry.char).join('');
      const adjacent = pageEntries
        .slice(boundary, boundary + suffix.length)
        .map(entry => entry.char)
        .join('');
      if (adjacent === expected) {
        const last = pageEntries[boundary + suffix.length - 1];
        selection.end = last.itemIndex;
        selection.endChar = last.charEnd;
      }
    }
  }

  return selection;
}

export function locateSelectionItems(items, selectionText) {
  const exact = exactSelectionMatch(items, selectionText);
  if (exact) return { ...exact, score: 1, coverage: 1 };
  const match = anchoredSelectionMatch(items, selectionText)
    || alignedSelectionMatch(items, selectionText)
    || characterAlignedSelectionMatch(items, selectionText);
  return recoverSelectionBoundaries(items, selectionText, match);
}

export function chooseSelectionCandidate(candidates, pageNumberHint = null) {
  if (!candidates.length) return null;
  const hinted = candidates.find(candidate => candidate.pageNumber === pageNumberHint);
  if (hinted && (hinted.selection.exact
    || (hinted.selection.score >= .58 && hinted.selection.coverage >= .45))) {
    return hinted;
  }
  const exact = candidates.filter(candidate => candidate.selection.exact);
  if (exact.length) {
    if (exact.length !== 1) return null;
    const competing = candidates
      .filter(candidate => !candidate.selection.exact)
      .sort((first, second) => second.selection.score - first.selection.score)[0];
    return competing?.selection.score > .9 ? null : exact[0];
  }
  const ranked = [...candidates].sort((first, second) => {
    return second.selection.score - first.selection.score;
  });
  const best = ranked[0];
  if (best.selection.score < .58 || best.selection.coverage < .45) return null;
  if (ranked[1]) {
    if (best.selection.score - ranked[1].selection.score < .1) return null;
  }
  return best;
}

function textItemRect(item, viewport) {
  const [firstX, baseline] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
  const [secondX] = viewport.convertToViewportPoint(
    item.transform[4] + (item.width || 0),
    item.transform[5]
  );
  const height = Math.max(4, Math.abs((item.height || 0) * viewport.scale));
  return {
    x: Math.min(firstX, secondX),
    y: baseline - height * 1.2,
    width: Math.max(0, Math.abs(secondX - firstX)),
    height: height * 1.5,
    baseline
  };
}

function verticalOverlap(first, second) {
  const top = Math.max(first.y, second.y);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  return Math.max(0, bottom - top);
}

function intersectionArea(first, second) {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function selectionIncludesItem(selection, itemIndex, valueLength) {
  if (!selection) return true;
  if (itemIndex < selection.start || itemIndex > selection.end) return false;
  if (itemIndex === selection.start && selection.startChar >= valueLength) return false;
  if (itemIndex === selection.end && selection.endChar <= 0) return false;
  return true;
}

function scriptPairRect(base, exponent, viewport) {
  const baseRect = textItemRect(base, viewport);
  const exponentRect = textItemRect(exponent, viewport);
  const baseHeight = baseRect.height / 1.5;
  const exponentHeight = exponentRect.height / 1.5;
  const x = Math.min(baseRect.x, exponentRect.x);
  const right = Math.max(
    baseRect.x + baseRect.width,
    exponentRect.x + exponentRect.width
  );
  const y = Math.min(
    baseRect.baseline - baseHeight * 1.05,
    exponentRect.baseline - exponentHeight * 1.05
  );
  const bottom = Math.max(
    baseRect.baseline + baseHeight * .08,
    exponentRect.baseline + exponentHeight * .24
  );
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
    baseline: baseRect.baseline
  };
}

export function supplementScriptMathRegions(
  items,
  viewport,
  regions,
  selection = null
) {
  const supplemented = [...regions];
  for (let index = 0; index < items.length - 1; index++) {
    const base = items[index];
    const exponent = items[index + 1];
    const baseValue = String(base?.str || '').trim();
    const exponentValue = String(exponent?.str || '').trim();
    if (
      !/^[A-Z]$/u.test(baseValue)
      || !/^[a-z]$/u.test(exponentValue)
      || !selectionIncludesItem(selection, index, baseValue.length)
      || !selectionIncludesItem(selection, index + 1, exponentValue.length)
      || !base.fontName
      || !exponent.fontName
      || base.fontName === exponent.fontName
    ) continue;

    const baseHeight = Math.abs(Number(base.height) || 0);
    const exponentHeight = Math.abs(Number(exponent.height) || 0);
    const heightRatio = exponentHeight / Math.max(1, baseHeight);
    const rise = Number(exponent.transform?.[5]) - Number(base.transform?.[5]);
    const baseRight = Number(base.transform?.[4]) + Number(base.width || 0);
    const horizontalGap = Number(exponent.transform?.[4]) - baseRight;
    if (
      baseHeight <= 0
      || !Number.isFinite(rise)
      || !Number.isFinite(horizontalGap)
      || heightRatio < .58
      || heightRatio > .78
      || rise < baseHeight * .22
      || rise > baseHeight * .58
      || horizontalGap < -baseHeight * .08
      || horizontalGap > baseHeight * .16
    ) continue;

    const baseRect = textItemRect(base, viewport);
    const exponentRect = textItemRect(exponent, viewport);
    const rect = scriptPairRect(base, exponent, viewport);
    const componentCoverage = (region, component) => (
      intersectionArea(component, region)
        / Math.max(1, component.width * component.height)
    );
    const overlappingRegions = supplemented.filter(region => (
      region.kind === 'inline'
      && (
        componentCoverage(region, baseRect) >= .35
        || componentCoverage(region, exponentRect) >= .35
      )
    ));
    if (overlappingRegions.some(region => (
      componentCoverage(region, baseRect) >= .35
      && componentCoverage(region, exponentRect) >= .35
    ))) continue;
    const confidence = Math.max(
      .81,
      ...overlappingRegions.map(region => Number(region.confidence) || 0)
    );
    for (const region of overlappingRegions) {
      supplemented.splice(supplemented.indexOf(region), 1);
    }

    supplemented.push({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      kind: 'inline',
      confidence,
      source: 'script-layout',
      inferredText: `${baseValue}${exponentValue}`,
      sourceItemIndexes: [index, index + 1]
    });
  }
  return supplemented;
}

function dominantTextFont(items) {
  const weights = new Map();
  for (const item of items) {
    const letters = (item.str?.match(/\p{L}/gu) || []).length;
    if (letters < 4 || !item.fontName) continue;
    weights.set(item.fontName, (weights.get(item.fontName) || 0) + letters);
  }
  return [...weights].sort((first, second) => second[1] - first[1])[0]?.[0] || null;
}

export function confirmWeakMathRegions(
  items,
  viewport,
  regions,
  automaticConfidence = .8
) {
  const visibleItems = items.filter(item => item.str?.trim() && item.height > 0);
  const dominantFont = dominantTextFont(visibleItems);
  const bodyHeights = visibleItems
    .filter(item => (item.str.match(/\p{L}/gu) || []).length >= 4)
    .map(item => Math.abs(item.height * viewport.scale))
    .sort((first, second) => first - second);
  const bodyHeight = bodyHeights[Math.floor(bodyHeights.length / 2)] || 10 * viewport.scale;
  const layout = visibleItems.map(item => ({ item, rect: textItemRect(item, viewport) }));
  const explicitMath = /[\u02c6\u0300-\u036f\u0370-\u03ff\u210f\u2202\u2207\u2211\u2212\u221a\u221e\u222b\u2248\u2260\u2261\u2264\u2265\u00b1\u00d7\u2192\u21d2=+*/^_<>[\]{}]/u;

  const accepted = regions.filter(region => {
    if (region.confidence >= automaticConfidence) return true;
    const overlaps = layout.filter(({ rect }) => {
      const area = intersectionArea(rect, region);
      const smaller = Math.min(rect.width * rect.height, region.width * region.height);
      return smaller > 0 && area / smaller >= .12;
    });
    if (!overlaps.length) return false;
    if (overlaps.some(({ item }) => explicitMath.test(item.str))) return true;

    const compact = overlaps.filter(({ item, rect }) => {
      const value = item.str.replace(/\s/g, '');
      return value.length > 0
        && value.length <= 3
        && rect.width <= Math.max(region.width * 1.6, bodyHeight * 2.5);
    });
    if (!compact.length) return false;
    const nonProseFont = compact.some(({ item }) => dominantFont && item.fontName !== dominantFont);
    const shiftedGlyph = compact.some(({ rect }) => rect.height / 1.5 < bodyHeight * .85);
    const fragmented = compact.length >= 2
      && new Set(compact.map(({ item }) => item.fontName)).size >= 2;
    return nonProseFont && (shiftedGlyph || fragmented || compact.length === 1);
  });
  return accepted.filter(region => {
    const enclosedHigherConfidenceRegions = accepted.filter(other => {
      if (other === region
        || other.kind !== region.kind
        || other.confidence <= region.confidence) return false;
      const centerX = other.x + other.width / 2;
      const centerY = other.y + other.height / 2;
      return centerX >= region.x
        && centerX <= region.x + region.width
        && centerY >= region.y
        && centerY <= region.y + region.height;
    });
    return enclosedHigherConfidenceRegions.length < 2;
  });
}

function regionForCharacter(regions, rect, x) {
  return regions
    .filter(region => {
      const horizontalMargin = Math.min(4, Math.max(1, region.height * .15));
      const baselineInsideRegionLine = rect.baseline >= region.y - region.height * .35
        && rect.baseline <= region.y + region.height * 1.35;
      return x >= region.x - horizontalMargin
        && x <= region.x + region.width + horizontalMargin
        && baselineInsideRegionLine
        && verticalOverlap(rect, region) >= Math.min(rect.height, region.height) * .1;
    })
    .sort((first, second) => {
      if (first.kind !== second.kind) return first.kind === 'display' ? -1 : 1;
      return second.confidence - first.confidence;
    })[0] || null;
}

function appendText(segments, value, itemIndex, { lineBreak = false } = {}) {
  if (!value) return;
  const last = segments.at(-1);
  if (last?.type === 'text' && !last.paragraphEnd) {
    const startsNewItem = last.itemIndex !== itemIndex;
    const joined = startsNewItem && lineBreak
      ? joinHyphenatedFragments(last.value, value)
      : null;
    if (joined !== null) {
      last.value = joined;
      last.itemIndex = itemIndex;
      return;
    }
    if (startsNewItem
      && !/\s$/.test(last.value)
      && !/^\s/.test(value)
      && !/^[,.;:!?)}\]]/.test(value)
      && !/(?:\(|\{|\[)$/.test(last.value)) {
      last.value += ' ';
    }
    last.value += value;
    last.itemIndex = itemIndex;
    return;
  }
  segments.push({ type: 'text', value, startItemIndex: itemIndex, itemIndex });
}

function bodyTextHeight(items, selection) {
  const heights = items
    .slice(selection.start, selection.end + 1)
    .filter(item => (item.str?.match(/\p{L}/gu) || []).length >= 4)
    .map(item => Math.abs(item.height || 0))
    .filter(height => height > 0)
    .sort((first, second) => first - second);
  return heights[Math.floor(heights.length / 2)] || 10;
}

function hasParagraphGap(previous, current, lineHeight) {
  if (!previous || !current) return false;
  const verticalGap = previous.transform[5] - current.transform[5];
  const lineRestart = previous.hasEOL
    || current.transform[4] < previous.transform[4] - lineHeight;
  return lineRestart && verticalGap > lineHeight * 1.55;
}

function combinedTextItemRect(items, viewport) {
  const rects = items.map(item => textItemRect(item, viewport));
  const x = Math.min(...rects.map(rect => rect.x));
  const y = Math.min(...rects.map(rect => rect.y));
  const right = Math.max(...rects.map(rect => rect.x + rect.width));
  const bottom = Math.max(...rects.map(rect => rect.y + rect.height));
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
    baseline: rects.reduce((sum, rect) => sum + rect.baseline, 0) / rects.length
  };
}

function equationLabelCandidates(items, viewport, selection) {
  const candidates = [];
  for (let start = selection.start; start <= selection.end; start++) {
    for (let length = 1; length <= Math.min(5, selection.end - start + 1); length++) {
      const labelItems = items.slice(start, start + length);
      if (labelItems.some(item => !item?.str)) continue;
      const rect = combinedTextItemRect(labelItems, viewport);
      const baselines = labelItems.map(item => textItemRect(item, viewport).baseline);
      if (Math.max(...baselines) - Math.min(...baselines) > Math.max(5, rect.height * .45)) {
        continue;
      }
      const value = labelItems.map(item => item.str.trim()).join('');
      const wrappedLabel = parseEquationLabel(value);
      const label = wrappedLabel || (length === 1
        ? parseEquationLabel(value, { allowBare: true })
        : null);
      if (!label) continue;
      candidates.push({
        label,
        wrapped: Boolean(wrappedLabel),
        start,
        end: start + length - 1,
        rect
      });
    }
  }

  const wrapped = candidates.filter(candidate => candidate.wrapped);
  return candidates.filter(candidate => candidate.wrapped
    || !wrapped.some(other => candidate.start >= other.start && candidate.end <= other.end));
}

function associateEquationLabels(items, viewport, regions, selection) {
  const candidates = equationLabelCandidates(items, viewport, selection);
  const pairs = [];
  for (const candidate of candidates) {
    const centerX = candidate.rect.x + candidate.rect.width / 2;
    const centerY = candidate.rect.y + candidate.rect.height / 2;
    for (const region of regions) {
      if (region.kind !== 'display') continue;
      const regionCenterX = region.x + region.width / 2;
      const regionCenterY = region.y + region.height / 2;
      const verticalDistance = Math.abs(centerY - regionCenterY);
      if (centerX <= regionCenterX + region.width * .2
        || candidate.rect.x < region.x + region.width * .6
        || (!candidate.wrapped
          && candidate.rect.x < region.x + region.width + Math.max(4, region.height * .15))
        || verticalDistance > Math.max(candidate.rect.height, region.height) * .7) {
        continue;
      }
      const horizontalGap = Math.max(0, candidate.rect.x - region.x - region.width);
      pairs.push({
        candidate,
        region,
        score: verticalDistance * 10 + horizontalGap
      });
    }
  }

  const labelsByRegion = new Map();
  const labelItems = new Set();
  const assignedCandidates = new Set();
  for (const pair of pairs.sort((first, second) => first.score - second.score)) {
    if (labelsByRegion.has(pair.region) || assignedCandidates.has(pair.candidate)) continue;
    labelsByRegion.set(pair.region, pair.candidate.label);
    assignedCandidates.add(pair.candidate);
    for (let index = pair.candidate.start; index <= pair.candidate.end; index++) {
      labelItems.add(index);
    }
  }
  return { labelsByRegion, labelItems };
}

export function buildSelectionSegments(items, viewport, regions, selection) {
  if (!selection) return [];
  const segments = [];
  const emittedRegions = new Set();
  const { labelsByRegion, labelItems } = associateEquationLabels(
    items,
    viewport,
    regions,
    selection
  );
  const lineHeight = bodyTextHeight(items, selection);
  let previousItem = null;
  for (let itemIndex = selection.start; itemIndex <= selection.end; itemIndex++) {
    const item = items[itemIndex];
    const value = item?.str || '';
    if (!value) continue;
    if (hasParagraphGap(previousItem, item, lineHeight)) {
      const previousSegment = segments.at(-1);
      if (previousSegment?.type === 'text') previousSegment.paragraphEnd = true;
    }
    if (labelItems.has(itemIndex)) {
      previousItem = item;
      continue;
    }
    const start = itemIndex === selection.start ? selection.startChar : 0;
    const end = itemIndex === selection.end ? selection.endChar : value.length;
    const rect = textItemRect(item, viewport);
    for (let offset = start; offset < end;) {
      const symbol = String.fromCodePoint(value.codePointAt(offset));
      const centerRatio = value.length ? (offset + symbol.length / 2) / value.length : .5;
      const x = item.dir === 'rtl'
        ? rect.x + rect.width * (1 - centerRatio)
        : rect.x + rect.width * centerRatio;
      const region = regionForCharacter(regions, rect, x);
      if (region) {
        if (!emittedRegions.has(region)) {
          const mathSegment = {
            type: 'math',
            region,
            regionIndex: regions.indexOf(region)
          };
          const equationLabel = labelsByRegion.get(region);
          if (equationLabel) mathSegment.equationLabel = equationLabel;
          segments.push(mathSegment);
          emittedRegions.add(region);
        }
      } else {
        appendText(segments, symbol, itemIndex, {
          lineBreak: previousItem?.hasEOL === true
        });
      }
      offset += symbol.length;
    }
    previousItem = item;
  }
  return segments
    .map(segment => segment.type === 'text'
      ? {
          type: 'text',
          value: segment.value.replace(/\s+/g, ' ').trim(),
          paragraphEnd: segment.paragraphEnd === true
        }
      : segment)
    .filter(segment => segment.type !== 'text' || segment.value);
}
