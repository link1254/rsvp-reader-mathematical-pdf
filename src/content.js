const api = globalThis.browser ?? globalThis.chrome;

function visibleText() {
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,button,svg').forEach((node) => node.remove());
  return (clone.innerText || clone.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const selection = getSelection()?.toString().trim();
  sendResponse({
    title: document.title,
    source: location.href,
    text: message.type === 'GET_SELECTION' && selection ? selection : visibleText()
  });
  return true;
});
