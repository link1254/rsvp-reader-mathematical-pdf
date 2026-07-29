const INTENTIONAL_HYPHEN_PREFIXES = new Set([
  'all',
  'cross',
  'data',
  'double',
  'energy',
  'field',
  'first',
  'full',
  'gauge',
  'half',
  'high',
  'long',
  'low',
  'mass',
  'mean',
  'model',
  'momentum',
  'one',
  'open',
  'order',
  'real',
  'second',
  'self',
  'short',
  'space',
  'state',
  'third',
  'time',
  'two',
  'user',
  'well'
]);

function shouldPreserveHyphen(fragment, hyphen) {
  return hyphen === '-'
    && INTENTIONAL_HYPHEN_PREFIXES.has(fragment.toLocaleLowerCase());
}

export function joinHyphenatedFragments(left, right) {
  const before = String(left || '');
  const after = String(right || '');
  const match = before.match(/([\p{L}\p{M}]+)([-\u00ad\u2010])$/u);
  if (!match || !/^\p{Ll}/u.test(after)) return null;

  const [, fragment, hyphen] = match;
  const preservedHyphen = shouldPreserveHyphen(fragment, hyphen) ? '-' : '';
  return `${before.slice(0, -hyphen.length)}${preservedHyphen}${after}`;
}

export function repairLineHyphenation(value) {
  return String(value || '').replace(
    /([\p{L}\p{M}]+[-\u00ad\u2010])\s*\n\s*(\p{Ll}[\p{L}\p{M}]*)/gu,
    (match, left, right) => joinHyphenatedFragments(left, right) || match
  );
}
