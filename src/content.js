(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const INSTALLATION_FLAG = '__rsvpReaderContentInstalled';
  if (globalThis[INSTALLATION_FLAG]) return;
  globalThis[INSTALLATION_FLAG] = true;

  const BLOCK_ELEMENTS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT',
    'FIGCAPTION', 'FIGURE', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE',
    'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL'
  ]);
  const SKIPPED_ELEMENTS = new Set([
    'BUTTON', 'CANVAS', 'FORM', 'INPUT', 'NOSCRIPT', 'SCRIPT', 'SELECT',
    'STYLE', 'TEXTAREA'
  ]);

  function compactText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function isHidden(element) {
    return element.getAttribute?.('aria-hidden') === 'true'
      || element.hidden === true;
  }

  function mathContainer(element) {
    if (element.nodeType !== Node.ELEMENT_NODE) return null;
    if (element.localName === 'math') return element;
    if (element.localName === 'mjx-container') return element;
    if (element.matches?.('.katex-display, .katex')) return element;
    if (element.matches?.('[data-latex], [data-tex]')) return element;
    const scriptType = element.getAttribute?.('type') || '';
    return /^math\/tex/i.test(scriptType) ? element : null;
  }

  function equationData(element) {
    const math = element.matches?.('math')
      ? element
      : element.querySelector?.('math');
    const annotation = element.querySelector?.(
      'annotation[encoding="application/x-tex"], annotation[encoding="application/x-latex"]'
    );
    const script = element.matches?.('script[type^="math/tex"]')
      ? element
      : element.querySelector?.('script[type^="math/tex"]');
    const latex = compactText(
      annotation?.textContent
      || element.getAttribute?.('data-latex')
      || element.getAttribute?.('data-tex')
      || script?.textContent
    );
    const accessibleText = compactText(
      element.getAttribute?.('aria-label')
      || math?.getAttribute?.('aria-label')
      || math?.textContent
      || element.textContent
    );
    const displayMode = Boolean(
      element.matches?.('.katex-display, mjx-container[display="true"]')
      || element.closest?.('.katex-display, mjx-container[display="true"]')
      || math?.getAttribute?.('display') === 'block'
      || /^math\/tex;\s*mode=display/i.test(script?.getAttribute?.('type') || '')
    );
    return {
      type: 'equation',
      value: latex || accessibleText,
      latex: latex || null,
      mathml: math?.outerHTML || null,
      accessibleText: accessibleText || null,
      displayMode
    };
  }

  function selectionSegments() {
    const selection = globalThis.getSelection?.();
    if (!selection?.rangeCount || selection.isCollapsed) return [];
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < selection.rangeCount; index++) {
      if (index) fragment.append(document.createElement('p'));
      fragment.append(selection.getRangeAt(index).cloneContents());
    }

    const segments = [];
    let textBuffer = '';

    function flushText(paragraphEnd = false) {
      const value = compactText(textBuffer);
      textBuffer = '';
      if (value) {
        segments.push({ type: 'text', value, paragraphEnd });
      } else if (paragraphEnd && segments.length) {
        segments.at(-1).paragraphEnd = true;
      }
    }

    function appendText(value) {
      if (!value) return;
      textBuffer += value;
    }

    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        appendText(node.nodeValue || '');
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE
        && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

      if (node.nodeType === Node.ELEMENT_NODE) {
        if (isHidden(node)) return;
        const equation = mathContainer(node);
        if (equation) {
          flushText(false);
          segments.push(equationData(equation));
          return;
        }
        if (SKIPPED_ELEMENTS.has(node.tagName)) return;
        if (node.tagName === 'BR') {
          flushText(true);
          return;
        }
      }

      for (const child of [...node.childNodes]) visit(child);
      if (node.nodeType === Node.ELEMENT_NODE && BLOCK_ELEMENTS.has(node.tagName)) {
        flushText(true);
      }
    }

    visit(fragment);
    flushText(true);
    return segments.filter(segment => segment.type !== 'equation' || segment.value);
  }

  function visibleText() {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll(
      'script,style,noscript,nav,header,footer,aside,form,button,svg'
    ).forEach(node => node.remove());
    return (clone.innerText || clone.textContent || '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const selection = globalThis.getSelection?.()?.toString().trim();
    if (message.type === 'GET_STRUCTURED_SELECTION') {
      sendResponse({
        title: document.title,
        source: location.href,
        text: selection || '',
        segments: selectionSegments()
      });
      return true;
    }
    sendResponse({
      title: document.title,
      source: location.href,
      text: message.type === 'GET_SELECTION' && selection
        ? selection
        : visibleText()
    });
    return true;
  });
})();
