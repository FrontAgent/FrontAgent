/**
 * Framework-free settings store. Wraps the bridge's `getSettings`/`saveSettings`
 * with an explicit status so the SettingsPanel degrades instead of breaking when
 * the (now real, failable — see #333) IPC rejects: a failed load surfaces a
 * retryable `load-error`, a failed save a retryable `save-error`, rather than a
 * stuck "加载中…" or a silently swallowed rejection.
 *
 * Kept out of React (like `consoleStore`) so the transitions are unit-tested
 * against a fake bridge with no DOM; the React layer consumes it via
 * `useSyncExternalStore`.
 */
import type { DesktopSettings, FrontAgentBridge } from '../../ipc/contract.js';

export type SettingsStatus = 'loading' | 'ready' | 'load-error' | 'saving' | 'save-error';

export interface SettingsState {
  status: SettingsStatus;
  /** Present once loaded; preserved across save/save-error so a retry keeps edits. */
  settings: DesktopSettings | null;
  /** True after a successful save until the next edit. */
  saved: boolean;
  /** Message for `load-error` / `save-error`; null otherwise. */
  error: string | null;
}

export const initialSettingsState: SettingsState = {
  status: 'loading',
  settings: null,
  saved: false,
  error: null,
};

export interface SettingsController {
  getState(): SettingsState;
  subscribe(listener: () => void): () => void;
  /** Load (or retry loading) settings from the bridge. */
  load(): Promise<void>;
  /** Edit a field; clears any prior saved/error flag. */
  update(key: keyof DesktopSettings, value: string): void;
  /** Persist the current settings; surfaces a retryable `save-error` on failure. */
  save(): Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createSettingsController(bridge: FrontAgentBridge): SettingsController {
  let state = initialSettingsState;
  const listeners = new Set<() => void>();

  const set = (next: SettingsState) => {
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async load() {
      set({ status: 'loading', settings: state.settings, saved: false, error: null });
      try {
        const settings = await bridge.getSettings();
        set({ status: 'ready', settings, saved: false, error: null });
      } catch (error) {
        set({ status: 'load-error', settings: null, saved: false, error: errorMessage(error) });
      }
    },

    update(key, value) {
      if (!state.settings) return;
      set({
        status: 'ready',
        settings: { ...state.settings, [key]: value },
        saved: false,
        error: null,
      });
    },

    async save() {
      if (!state.settings) return;
      const settings = state.settings;
      set({ status: 'saving', settings, saved: false, error: null });
      try {
        await bridge.saveSettings(settings);
        set({ status: 'ready', settings, saved: true, error: null });
      } catch (error) {
        set({ status: 'save-error', settings, saved: false, error: errorMessage(error) });
      }
    },
  };
}
