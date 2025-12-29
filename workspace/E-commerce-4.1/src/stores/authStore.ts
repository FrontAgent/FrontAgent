import { create } from 'zustand';

export type AuthStatus = 'anonymous' | 'authenticated' | 'loading';

export type AuthUser = {
  id?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
};

export type AuthState = {
  accessToken: string | null;
  refreshToken?: string | null;
  user: AuthUser | null;
  status: AuthStatus;
};

export type AuthActions = {
  setTokens: (accessToken: string | null, refreshToken?: string | null) => void;
  clearAuth: () => void;
  setUser: (user: AuthUser | null) => void;
  hydrateFromStorage: () => void;
  persistToStorage: () => void;
};

export type AuthStore = AuthState & AuthActions;

const STORAGE_KEY = 'app:auth';

type PersistedAuth = {
  accessToken: string | null;
  refreshToken?: string | null;
  user: AuthUser | null;
};

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeReadStorage = (): PersistedAuth | null => {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const obj = parsed as Record<string, unknown>;
    const accessToken = typeof obj.accessToken === 'string' ? obj.accessToken : obj.accessToken === null ? null : null;
    const refreshToken = typeof obj.refreshToken === 'string' ? obj.refreshToken : obj.refreshToken === null ? null : undefined;

    let user: AuthUser | null = null;
    if (typeof obj.user === 'object' && obj.user !== null) user = obj.user as AuthUser;
    else if (obj.user === null) user = null;

    return { accessToken, refreshToken, user };
  } catch {
    return null;
  }
};

const safeWriteStorage = (data: PersistedAuth): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
};

const safeClearStorage = (): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  status: 'anonymous',

  setTokens: (accessToken, refreshToken) => {
    set((state) => {
      const nextAccessToken = accessToken ?? null;
      const nextRefreshToken = refreshToken !== undefined ? refreshToken : state.refreshToken ?? null;
      const nextStatus: AuthStatus = nextAccessToken ? 'authenticated' : 'anonymous';

      return {
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
        status: nextStatus,
      };
    });
    get().persistToStorage();
  },

  clearAuth: () => {
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      status: 'anonymous',
    });
    safeClearStorage();
  },

  setUser: (user) => {
    set({ user });
    get().persistToStorage();
  },

  hydrateFromStorage: () => {
    set({ status: 'loading' });

    const persisted = safeReadStorage();
    if (!persisted) {
      set({ status: 'anonymous', accessToken: null, refreshToken: null, user: null });
      return;
    }

    const nextAccessToken = persisted.accessToken ?? null;
    const nextRefreshToken = persisted.refreshToken ?? null;
    const nextUser = persisted.user ?? null;

    set({
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      user: nextUser,
      status: nextAccessToken ? 'authenticated' : 'anonymous',
    });
  },

  persistToStorage: () => {
    const { accessToken, refreshToken, user } = get();
    safeWriteStorage({
      accessToken: accessToken ?? null,
      refreshToken: refreshToken ?? null,
      user: user ?? null,
    });
  },
}));

export const getAccessToken = (): string | null => {
  return useAuthStore.getState().accessToken ?? null;
};

export const subscribeAuthTokenDebug = (
  listener?: (next: string | null, prev: string | null) => void
): (() => void) => {
  let prev = useAuthStore.getState().accessToken ?? null;

  const unsubscribe = useAuthStore.subscribe((state) => {
    const next = state.accessToken ?? null;
    if (next === prev) return;

    const p = prev;
    prev = next;

    if (listener) listener(next, p);
    else {
      try {
        // eslint-disable-next-line no-console
        console.debug('[authStore] accessToken changed', { prev: p, next });
      } catch {
        // ignore
      }
    }
  });

  return unsubscribe;
};