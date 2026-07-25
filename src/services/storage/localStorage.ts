/**
 * Reads a JSON-serialized value from localStorage.
 * Returns `fallback` if the key doesn't exist or parsing fails.
 */
export function getFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Writes a JSON-serialized value to localStorage.
 * Silently ignores errors (e.g. quota exceeded).
 */
export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded or unavailable — silently ignore.
  }
}

/**
 * Removes a key from localStorage.
 */
export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Silently ignore.
  }
}
