import { describe, expect, it, vi } from 'vitest';
import type { FrontAgentBridge } from '../ipc/contract.js';
import { isElectronRuntime, MissingPreloadBridgeError, selectBridge } from './selectBridge.js';

const ELECTRON_UA =
  'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 FrontAgent/2.1.1 Chrome/130 Electron/42.4.0 Safari/537.36';
const BROWSER_UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36';

const realBridge = {} as FrontAgentBridge;

describe('isElectronRuntime', () => {
  it('detects an Electron user-agent', () => {
    expect(isElectronRuntime(ELECTRON_UA)).toBe(true);
  });
  it('rejects a plain browser user-agent', () => {
    expect(isElectronRuntime(BROWSER_UA)).toBe(false);
  });
});

describe('selectBridge', () => {
  it('uses the preload bridge when present (Electron)', () => {
    const createMock = vi.fn();
    expect(selectBridge({ frontagent: realBridge, userAgent: ELECTRON_UA, createMock })).toBe(
      realBridge,
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it('throws in Electron when the preload bridge is missing (no silent mock)', () => {
    const createMock = vi.fn();
    expect(() =>
      selectBridge({ frontagent: undefined, userAgent: ELECTRON_UA, createMock }),
    ).toThrow(MissingPreloadBridgeError);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('falls back to the mock only in a plain browser', () => {
    const mock = {} as FrontAgentBridge;
    const createMock = vi.fn(() => mock);
    expect(selectBridge({ frontagent: undefined, userAgent: BROWSER_UA, createMock })).toBe(mock);
    expect(createMock).toHaveBeenCalledOnce();
  });
});
