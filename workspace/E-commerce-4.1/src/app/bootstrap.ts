type Unsubscribe = () => void;
type UnauthorizedCallback = () => void | Promise<void>;

const unauthorizedSubscribers = new Set<UnauthorizedCallback>();

export const onUnauthorized = (cb: UnauthorizedCallback): Unsubscribe => {
  unauthorizedSubscribers.add(cb);
  return () => unauthorizedSubscribers.delete(cb);
};

export const emitUnauthorized = async (): Promise<void> => {
  const callbacks = Array.from(unauthorizedSubscribers);
  await Promise.all(
    callbacks.map(async (cb) => {
      try {
        await cb();
      } catch {
        // swallow to avoid blocking other subscribers
      }
    })
  );
};

export const bootstrapApp = async (): Promise<void> => {
  const tasks: Array<Promise<unknown>> = [];

  const authStoreModule = await import('../stores/authStore').catch(() => null);
  const cartStoreModule = await import('../stores/cartStore').catch(() => null);
  const preferencesStoreModule = await import('../stores/preferencesStore').catch(() => null);
  const httpClientModule = await import('../lib/httpClient').catch(() => null);

  const authStore = authStoreModule as
    | null
    | {
        hydrateFromStorage?: () => Promise<void> | void;
        clearAuth?: () => void;
      };

  const cartStore = cartStoreModule as null | { hydrateFromStorage?: () => Promise<void> | void };

  const preferencesStore = preferencesStoreModule as null | {
    hydrateFromStorage?: () => Promise<void> | void;
  };

  const httpClient = httpClientModule as null | {
    setUnauthorizedHandler?: (handler: (status: number) => void | Promise<void>) => void;
  };

  if (authStore?.hydrateFromStorage) tasks.push(Promise.resolve(authStore.hydrateFromStorage()));
  if (cartStore?.hydrateFromStorage) tasks.push(Promise.resolve(cartStore.hydrateFromStorage()));
  if (preferencesStore?.hydrateFromStorage)
    tasks.push(Promise.resolve(preferencesStore.hydrateFromStorage()));

  await Promise.all(tasks);

  httpClient?.setUnauthorizedHandler?.(async (status: number) => {
    if (status !== 401) return;

    try {
      authStore?.clearAuth?.();
    } catch {
      // ignore
    }

    await emitUnauthorized();
  });
};