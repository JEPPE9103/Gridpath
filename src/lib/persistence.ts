const PREFIX = "noxheim.v1.";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function createPersistedStore<T>(key: string, fallback: T) {
  let value = fallback;
  let hydrated = false;
  const listeners = new Set<() => void>();

  function hydrate() {
    if (!hydrated) {
      value = readJson(key, fallback);
      hydrated = true;
    }
    return value;
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return hydrate();
    },
    getServerSnapshot() {
      return fallback;
    },
    set(next: T | ((current: T) => T)) {
      const current = hydrate();
      value = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      writeJson(key, value);
      listeners.forEach((listener) => listener());
    },
  };
}
