import { describe, expect, it, vi } from 'vitest';
import {
  openReaderFallback,
  removeAllContextMenus,
  usesPromiseExtensionApi
} from '../src/browser-compat.js';

describe('cross-browser extension APIs', () => {
  it('recognizes Firefox promise-based APIs', () => {
    expect(usesPromiseExtensionApi({ browser: {} })).toBe(true);
    expect(usesPromiseExtensionApi({ chrome: {} })).toBe(false);
  });

  it('removes Firefox context menus through a promise', async () => {
    const api = { contextMenus: { removeAll: vi.fn().mockResolvedValue() } };
    await removeAllContextMenus(api, true);
    expect(api.contextMenus.removeAll).toHaveBeenCalledOnce();
  });

  it('keeps the Chromium callback path', async () => {
    const api = {
      runtime: {},
      contextMenus: { removeAll: vi.fn(callback => callback()) }
    };
    await removeAllContextMenus(api, false);
    expect(api.contextMenus.removeAll).toHaveBeenCalledOnce();
  });

  it('opens a Firefox sidebar when Chromium sidePanel is unavailable', async () => {
    const api = {
      sidebarAction: {
        setPanel: vi.fn().mockResolvedValue(),
        open: vi.fn().mockResolvedValue()
      }
    };
    await expect(openReaderFallback(api, {
      tabId: 3,
      windowId: 7,
      panelPath: 'src/sidepanel.html'
    })).resolves.toBe('sidebar');
    expect(api.sidebarAction.setPanel).toHaveBeenCalledWith({
      windowId: 7,
      panel: 'src/sidepanel.html'
    });
  });

  it('keeps Chromium sidePanel as the preferred fallback', async () => {
    const api = {
      sidePanel: {
        setOptions: vi.fn().mockResolvedValue(),
        open: vi.fn().mockResolvedValue()
      },
      sidebarAction: {
        setPanel: vi.fn(),
        open: vi.fn()
      }
    };
    await expect(openReaderFallback(api, {
      tabId: 3,
      windowId: 7,
      panelPath: 'src/sidepanel.html'
    })).resolves.toBe('side-panel');
    expect(api.sidebarAction.open).not.toHaveBeenCalled();
  });
});
