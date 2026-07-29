function isProseItem(item) {
  return item && item.type !== 'equation';
}

export function readerSideContextEntries(
  items,
  index,
  count,
  direction
) {
  const limit = Math.max(0, Math.floor(Number(count) || 0));
  if (!limit) return [];

  const step = direction === 'previous' ? -1 : 1;
  const entries = [];
  for (
    let cursor = index + step;
    cursor >= 0 && cursor < items.length && entries.length < limit;
    cursor += step
  ) {
    const item = items[cursor];
    if (isProseItem(item)) entries.push({ item, index: cursor });
  }
  return step < 0 ? entries.reverse() : entries;
}

export function readerSideContextText(items, index, count, direction) {
  return readerSideContextEntries(items, index, count, direction)
    .map(({ item }) => item.value)
    .join(' ');
}

export function readerSentenceContextEntries(items, start, end) {
  return items
    .slice(Math.max(0, start), Math.min(items.length, end + 1))
    .map((item, offset) => ({ item, index: Math.max(0, start) + offset }))
    .filter(({ item }) => isProseItem(item));
}
