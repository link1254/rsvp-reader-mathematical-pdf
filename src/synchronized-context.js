import { sentenceBounds } from './selection-engine.js';

export function synchronizedContextRange(items, index) {
  if (!items?.length) return { start: 0, end: -1 };
  return sentenceBounds(items, index);
}

export function synchronizedContextKey(
  items,
  start,
  end,
  getEquationImage = () => null
) {
  const content = items.slice(start, end + 1).map(item => {
    if (item.type !== 'equation') return `word:${item.value}`;
    return `equation:${item.equationId || item.value}:${getEquationImage(item) || ''}`;
  });
  return `${start}:${end}:${content.join('\u001f')}`;
}

function createToken(document, item, index, getEquationImage) {
  const token = document.createElement('button');
  token.type = 'button';
  token.tabIndex = -1;
  token.className = 'synchronized-token';
  token.dataset.contextIndex = String(index);

  if (item.type !== 'equation') {
    token.textContent = item.value;
    return token;
  }

  token.classList.add('equation');
  token.setAttribute('aria-label', item.value || 'Équation');
  const imageUrl = getEquationImage(item);
  if (imageUrl) {
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = '';
    token.append(image);
  } else {
    token.textContent = 'ƒ(x)';
  }
  return token;
}

export function createSynchronizedContext({
  container,
  getItems,
  getIndex,
  getEquationImage = () => null,
  onNavigate = () => {}
}) {
  let renderedKey = '';
  let pendingFrame = null;
  const view = container.ownerDocument.defaultView;
  const requestFrame = view?.requestAnimationFrame?.bind(view)
    || (callback => callback());
  const cancelFrame = view?.cancelAnimationFrame?.bind(view)
    || (() => {});

  function reset() {
    if (pendingFrame !== null) cancelFrame(pendingFrame);
    pendingFrame = null;
    renderedKey = '';
    container.replaceChildren();
    container.scrollTop = 0;
  }

  function rebuild(items, start, end, key) {
    const fragment = container.ownerDocument.createDocumentFragment();
    for (let index = start; index <= end; index++) {
      fragment.append(createToken(
        container.ownerDocument,
        items[index],
        index,
        getEquationImage
      ));
    }
    container.replaceChildren(fragment);
    container.scrollTop = 0;
    renderedKey = key;
  }

  function keepActiveTokenVisible(active) {
    if (!active) return;
    const padding = 10;
    const tokenTop = active.offsetTop;
    const tokenBottom = tokenTop + active.offsetHeight;
    const visibleTop = container.scrollTop + padding;
    const visibleBottom = container.scrollTop + container.clientHeight - padding;
    if (tokenTop >= visibleTop && tokenBottom <= visibleBottom) return;

    const rowTops = [...new Set(
      [...container.querySelectorAll('[data-context-index]')]
        .map(token => token.offsetTop)
    )].sort((first, second) => first - second);
    const activeRow = rowTops.indexOf(tokenTop);
    const availableHeight = container.clientHeight - padding * 2;
    let firstVisibleRow = Math.max(0, activeRow);
    while (firstVisibleRow > 0
      && tokenBottom - rowTops[firstVisibleRow - 1] <= availableHeight) {
      firstVisibleRow--;
    }

    container.scrollTo({
      top: Math.max(0, rowTops[firstVisibleRow] - rowTops[0]),
      behavior: 'auto'
    });
  }

  function update(enabled = true) {
    if (!enabled) {
      reset();
      return;
    }
    const items = getItems();
    if (!items.length) {
      reset();
      return;
    }

    const index = Math.max(0, Math.min(items.length - 1, getIndex()));
    const { start, end } = synchronizedContextRange(items, index);
    const key = synchronizedContextKey(items, start, end, getEquationImage);
    if (key !== renderedKey) rebuild(items, start, end, key);

    let active = null;
    for (const token of container.querySelectorAll('[data-context-index]')) {
      const isActive = Number(token.dataset.contextIndex) === index;
      token.classList.toggle('active', isActive);
      if (isActive) {
        token.setAttribute('aria-current', 'true');
        active = token;
      } else {
        token.removeAttribute('aria-current');
      }
    }

    if (pendingFrame !== null) cancelFrame(pendingFrame);
    pendingFrame = requestFrame(() => {
      pendingFrame = null;
      keepActiveTokenVisible(active);
    });
  }

  container.addEventListener('click', event => {
    const token = event.target.closest?.('[data-context-index]');
    if (!token || !container.contains(token)) return;
    onNavigate(Number(token.dataset.contextIndex));
  });

  return { reset, update };
}
