import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';

export type PreferencesState = {
  theme: ThemePreference;
  reducedMotion?: boolean;
  locale?: string;
};

export type PreferencesActions = {
  setTheme: (theme: ThemePreference) => void;
  setReducedMotion: (reducedMotion?: boolean) => void;
  setLocale: (locale?: string) => void;
  hydrateFromStorage: () => void;
  persistToStorage: () => void;
};

type PreferencesStore = PreferencesState & PreferencesActions;

const STORAGE_KEY = 'app:prefs';

type PersistedPreferences = {
  theme?: ThemePreference;
  reducedMotion?: boolean;
  locale?: string;
};

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

const safeParseJSON = <T,>(value: string | null): T | undefined => {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
};

const prefersDark = (): boolean => {
  if (!isBrowser() || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const getInitialTheme = (): ThemePreference => {
  if (!isBrowser()) return 'system';
  const stored = safeParseJSON<PersistedPreferences>(window.localStorage.getItem(STORAGE_KEY));
  if (stored?.theme === 'light' || stored?.theme === 'dark' || stored?.theme === 'system') {
    return stored.theme;
  }
  return 'system';
};

const resolveTheme = (theme: ThemePreference): 'light' | 'dark' => {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light';
  return theme;
};

const applyThemeToDocument = (theme: ThemePreference): void => {
  if (!isBrowser()) return;
  const resolved = resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
};

const readPersisted = (): PersistedPreferences | undefined => {
  if (!isBrowser()) return undefined;
  return safeParseJSON<PersistedPreferences>(window.localStorage.getItem(STORAGE_KEY));
};

const writePersisted = (prefs: PersistedPreferences): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
};

export const usePreferencesStore = create<PreferencesStore>((set, get) => ({
  theme: getInitialTheme(),
  reducedMotion: undefined,
  locale: undefined,

  setTheme: (theme) => {
    set({ theme });
    applyThemeToDocument(theme);
    get().persistToStorage();
  },

  setReducedMotion: (reducedMotion) => {
    set({ reducedMotion });
    get().persistToStorage();
  },

  setLocale: (locale) => {
    set({ locale });
    get().persistToStorage();
  },

  hydrateFromStorage: () => {
    const persisted = readPersisted();
    if (!persisted) {
      applyThemeToDocument(get().theme);
      return;
    }

    const nextTheme: ThemePreference =
      persisted.theme === 'light' || persisted.theme === 'dark' || persisted.theme === 'system'
        ? persisted.theme
        : 'system';

    set({
      theme: nextTheme,
      reducedMotion: typeof persisted.reducedMotion === 'boolean' ? persisted.reducedMotion : undefined,
      locale: typeof persisted.locale === 'string' ? persisted.locale : undefined,
    });

    applyThemeToDocument(nextTheme);
  },

  persistToStorage: () => {
    const { theme, reducedMotion, locale } = get();
    const payload: PersistedPreferences = {};

    payload.theme = theme;
    if (typeof reducedMotion === 'boolean') payload.reducedMotion = reducedMotion;
    if (typeof locale === 'string' && locale.length > 0) payload.locale = locale;

    writePersisted(payload);
  },
}));

if (isBrowser()) {
  applyThemeToDocument(usePreferencesStore.getState().theme);

  if (typeof window.matchMedia === 'function') {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const { theme } = usePreferencesStore.getState();
      if (theme === 'system') applyThemeToDocument('system');
    };

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
    } else if (typeof (mql as MediaQueryList).addListener === 'function') {
      (mql as MediaQueryList).addListener(onChange);
    }
  }
}