import { afterEach, describe, expect, it, vi } from 'vitest';
import { installSmokeProbe, type SmokeProbeWindow } from './smokeProbe.js';

/** Fake window that lets a test fire `did-finish-load` and resolve the probe. */
function fakeWindow(executeJavaScript: () => Promise<unknown>) {
  let loadListener: (() => void) | undefined;
  const win: SmokeProbeWindow = {
    webContents: {
      on: (_event, listener) => {
        loadListener = listener;
      },
      executeJavaScript: vi.fn(executeJavaScript),
    },
  };
  return { win, finishLoad: () => loadListener?.() };
}

describe('installSmokeProbe', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exits 0 when the renderer loads and the bridge is wired', async () => {
    const exit = vi.fn();
    const { win, finishLoad } = fakeWindow(async () => true);
    installSmokeProbe(win, { exit });

    finishLoad();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
  });

  it('exits 1 when the bridge is absent in the packaged app', async () => {
    const exit = vi.fn();
    const { win, finishLoad } = fakeWindow(async () => false);
    installSmokeProbe(win, { exit });

    finishLoad();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
  });

  it('exits 1 when the bridge probe throws', async () => {
    const exit = vi.fn();
    const { win, finishLoad } = fakeWindow(async () => {
      throw new Error('renderer crashed');
    });
    installSmokeProbe(win, { exit });

    finishLoad();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
  });

  it('exits 1 when the renderer never finishes loading (timeout)', () => {
    vi.useFakeTimers();
    const exit = vi.fn();
    const { win } = fakeWindow(async () => true);
    installSmokeProbe(win, { exit, timeoutMs: 5000 });

    // did-finish-load never fires; the timeout must fail closed.
    expect(exit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
