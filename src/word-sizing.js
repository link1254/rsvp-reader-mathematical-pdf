export function fitStableWordFontSize({
  preferredSize,
  minimumSize = 18,
  availableLeft,
  availableRight,
  wordExtents = []
}) {
  const preferred = Number(preferredSize);
  if (!Number.isFinite(preferred) || preferred <= 0) return null;

  const maximumLeft = Math.max(
    0,
    ...wordExtents.map(extent => Number(extent?.left) || 0)
  );
  const maximumRight = Math.max(
    0,
    ...wordExtents.map(extent => Number(extent?.right) || 0)
  );
  if (!maximumLeft && !maximumRight) return Math.round(preferred);

  const leftRatio = maximumLeft > 0
    ? Math.max(0, Number(availableLeft) || 0) / maximumLeft
    : 1;
  const rightRatio = maximumRight > 0
    ? Math.max(0, Number(availableRight) || 0) / maximumRight
    : 1;
  const ratio = Math.min(1, leftRatio, rightRatio);
  const minimum = Math.min(
    preferred,
    Math.max(1, Number(minimumSize) || 1)
  );
  return Math.min(
    Math.round(preferred),
    Math.max(Math.round(minimum), Math.floor(preferred * ratio))
  );
}
