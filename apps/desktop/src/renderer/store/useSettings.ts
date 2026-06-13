import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { DesktopSettings, FrontAgentBridge } from '../../ipc/contract.js';
import { createSettingsController, type SettingsState } from './settingsController.js';

/** React binding over {@link createSettingsController}; loads on mount. */
export function useSettings(bridge: FrontAgentBridge): {
  state: SettingsState;
  update: (key: keyof DesktopSettings, value: string) => void;
  save: () => Promise<void>;
  retryLoad: () => Promise<void>;
} {
  const controller = useMemo(() => createSettingsController(bridge), [bridge]);
  useEffect(() => {
    controller.load();
  }, [controller]);

  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );

  return { state, update: controller.update, save: controller.save, retryLoad: controller.load };
}
