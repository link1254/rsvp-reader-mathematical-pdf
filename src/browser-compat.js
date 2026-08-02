export function usesPromiseExtensionApi(scope = globalThis) {
  return Boolean(scope.browser);
}

export async function removeAllContextMenus(api, promiseApi = usesPromiseExtensionApi()) {
  if (promiseApi) {
    await api.contextMenus.removeAll();
    return;
  }

  await new Promise((resolve, reject) => {
    api.contextMenus.removeAll(() => {
      const error = api.runtime?.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

export async function openReaderFallback(api, { tabId, windowId, panelPath }) {
  if (api.sidePanel?.setOptions && api.sidePanel?.open) {
    await api.sidePanel.setOptions({ tabId, path: panelPath, enabled: true });
    await api.sidePanel.open({ tabId });
    return 'side-panel';
  }

  if (api.sidebarAction?.setPanel && api.sidebarAction?.open) {
    await api.sidebarAction.setPanel({ windowId, panel: panelPath });
    await api.sidebarAction.open();
    return 'sidebar';
  }

  throw new Error('No compatible reader panel API is available.');
}
