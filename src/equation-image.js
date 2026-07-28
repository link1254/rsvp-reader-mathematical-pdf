function isDark(data, offset) {
  const r = data[offset], g = data[offset + 1], b = data[offset + 2];
  return r * .299 + g * .587 + b * .114 < 145;
}

function isSelectionBlue(data, offset) {
  const r = data[offset], g = data[offset + 1], b = data[offset + 2];
  return b > r + 18 && b > g + 5 && b > 115;
}

export function findEquationBand(imageData, options = {}) {
  const { data, width, height } = imageData;
  const step = Math.max(1, Math.floor(width / 900));
  const rows = [];
  for (let y = 0; y < height; y += 2) {
    let left = 0, center = 0, right = 0, blue = 0;
    for (let x = 0; x < width; x += step) {
      const offset = (y * width + x) * 4;
      if (isSelectionBlue(data, offset)) blue++;
      if (!isDark(data, offset)) continue;
      if (x < width * .18) left++;
      else if (x < width * .82) center++;
      else right++;
    }
    rows.push({ y, left, center, right, blue, active: center > Math.max(3, width / step * .004) });
  }

  const bands = [];
  let start = null;
  let lastActive = null;
  for (const row of rows) {
    if (row.active) {
      if (start === null) start = row.y;
      lastActive = row.y;
    } else if (start !== null && row.y - lastActive > 14) {
      bands.push({ start, end: lastActive }); start = null; lastActive = null;
    }
  }
  if (start !== null) bands.push({ start, end: lastActive });

  const candidates = bands.map(band => {
    const relevant = rows.filter(row => row.y >= band.start && row.y <= band.end);
    const sums = relevant.reduce((sum, row) => ({ left: sum.left + row.left, center: sum.center + row.center, right: sum.right + row.right, blue: sum.blue + row.blue }), { left: 0, center: 0, right: 0, blue: 0 });
    const h = band.end - band.start + 1;
    const centered = sums.center / Math.max(1, sums.left + sums.center);
    const middle = (band.start + band.end) / 2;
    const inPreferredRange = options.preferredRange && middle >= options.preferredRange[0] && middle <= options.preferredRange[1];
    const score = sums.center + sums.right * 7 - sums.left * 3 + Math.min(sums.blue, 5000) * 3 + centered * 100 + (inPreferredRange ? 20000 : 0);
    return { ...band, ...sums, h, score };
  }).filter(band => band.h >= 8 && band.h <= Math.min(180, height * .22) && band.center > 20 && band.right > 12 && band.left < band.center * .14);

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (!best) return null;

  let minX = width, maxX = 0;
  const y0 = Math.max(0, best.start - 18), y1 = Math.min(height - 1, best.end + 18);
  for (let y = y0; y <= y1; y += 2) for (let x = 0; x < width; x += step) {
    if (isDark(data, (y * width + x) * 4)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  }
  if (maxX <= minX) return null;
  const padX = Math.round(width * .025);
  return { x: Math.max(0, minX - padX), y: y0, width: Math.min(width, maxX + padX) - Math.max(0, minX - padX), height: y1 - y0 + 1 };
}

export async function cropEquationFromCapture(dataUrl) {
  if (!dataUrl) return null;
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const rect = findEquationBand(context.getImageData(0, 0, canvas.width, canvas.height));
  if (!rect) return null;
  const crop = document.createElement('canvas');
  crop.width = rect.width; crop.height = rect.height;
  crop.getContext('2d').drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return crop.toDataURL('image/png');
}

export function cropEquationFromCanvas(canvas, options = {}) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const rect = findEquationBand(context.getImageData(0, 0, canvas.width, canvas.height), options);
  if (!rect) return null;
  const crop = document.createElement('canvas'); crop.width = rect.width; crop.height = rect.height;
  crop.getContext('2d').drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return crop.toDataURL('image/png');
}

export function cropEquationAtY(canvas, baselineY, metrics = {}) {
  const above = Math.max(55, metrics.above || 82);
  const below = Math.max(20, metrics.below || 32);
  const y0 = Math.max(0, Math.round(baselineY - above));
  const y1 = Math.min(canvas.height - 1, Math.round(baselineY + below));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const image = context.getImageData(0, y0, canvas.width, y1 - y0 + 1);
  const activeRows = [];
  for (let y = 0; y < image.height; y++) {
    let dark = 0;
    for (let x = 0; x < image.width; x += 2) if (isDark(image.data, (y * image.width + x) * 4)) dark++;
    if (dark > 2) activeRows.push(y);
  }
  if (!activeRows.length) return null;
  const bands = [];
  let start = activeRows[0], last = activeRows[0];
  for (const y of activeRows.slice(1)) {
    if (y - last > 4) { bands.push({ start, end: last }); start = y; }
    last = y;
  }
  bands.push({ start, end: last });
  const localBaseline = baselineY - y0;
  const target = bands.sort((a, b) => {
    const distance = band => localBaseline < band.start ? band.start - localBaseline : localBaseline > band.end ? localBaseline - band.end : 0;
    return distance(a) - distance(b);
  })[0];
  const bandY0 = Math.max(0, target.start - 10), bandY1 = Math.min(image.height - 1, target.end + 10);
  let minX = canvas.width, maxX = 0, minY = image.height, maxY = 0;
  for (let y = bandY0; y <= bandY1; y++) for (let x = 0; x < image.width; x++) {
    if (!isDark(image.data, (y * image.width + x) * 4)) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (maxX <= minX || maxY <= minY) return null;
  const padX = Math.round(canvas.width * .025), padY = 6;
  const x = Math.max(0, minX - padX), y = Math.max(0, minY - padY);
  const width = Math.min(canvas.width, maxX + padX) - x;
  const height = Math.min(image.height, maxY + padY) - y;
  const crop = document.createElement('canvas'); crop.width = width; crop.height = height;
  crop.getContext('2d').drawImage(canvas, x, y0 + y, width, height, 0, 0, width, height);
  return crop.toDataURL('image/png');
}

export function cropEquationRect(canvas, rect) {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(canvas.width, Math.ceil(rect.x + rect.width));
  const y1 = Math.min(canvas.height, Math.ceil(rect.y + rect.height));
  if (x1 <= x0 || y1 <= y0) return null;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const image = context.getImageData(x0, y0, x1 - x0, y1 - y0);
  let scanY0 = 0, scanY1 = image.height - 1;

  // Le cadre issu de PDF.js peut effleurer la ligne de prose voisine. On
  // regroupe donc les lignes d'encre et on conserve uniquement le groupe qui
  // contient (ou approche le plus) la ligne de base du numero d'equation.
  // Cela elimine le titre/paragraphe voisin sans couper fractions et exposants.
  if (Number.isFinite(rect.baselineY)) {
    const activeRows = [];
    for (let y = 0; y < image.height; y++) {
      let dark = 0;
      for (let x = 0; x < image.width; x++) {
        if (isDark(image.data, (y * image.width + x) * 4)) dark++;
      }
      if (dark) activeRows.push(y);
    }
    if (activeRows.length) {
      const bands = [];
      let start = activeRows[0], last = activeRows[0];
      for (const y of activeRows.slice(1)) {
        if (y - last > 6) { bands.push({ start, end: last }); start = y; }
        last = y;
      }
      bands.push({ start, end: last });
      const baseline = rect.baselineY - y0;
      const distance = band => baseline < band.start
        ? band.start - baseline
        : baseline > band.end ? baseline - band.end : 0;
      const target = bands.sort((a, b) => distance(a) - distance(b))[0];
      scanY0 = Math.max(0, target.start - 7);
      scanY1 = Math.min(image.height - 1, target.end + 7);
    }
  }
  let minX = image.width, maxX = 0, minY = image.height, maxY = 0;
  for (let y = scanY0; y <= scanY1; y++) for (let x = 0; x < image.width; x++) {
    if (!isDark(image.data, (y * image.width + x) * 4)) continue;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (maxX <= minX || maxY <= minY) return null;
  const padding = 10;
  minX = Math.max(0, minX - padding); minY = Math.max(scanY0, minY - padding);
  maxX = Math.min(image.width - 1, maxX + padding); maxY = Math.min(scanY1, maxY + padding);
  const width = maxX - minX + 1, height = maxY - minY + 1;
  const crop = document.createElement('canvas'); crop.width = width; crop.height = height;
  crop.getContext('2d').drawImage(canvas, x0 + minX, y0 + minY, width, height, 0, 0, width, height);
  return crop.toDataURL('image/png');
}

export async function cropCaptureRect(dataUrl, rect) {
  const image = new Image(); image.src = dataUrl; await image.decode();
  const crop = document.createElement('canvas');
  crop.width = Math.max(1, Math.round(rect.width)); crop.height = Math.max(1, Math.round(rect.height));
  crop.getContext('2d').drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, crop.width, crop.height);
  return crop.toDataURL('image/png');
}
