/**
 * Everything the app persists lives under this localStorage prefix:
 * `tsudoku.settings.v1` (settings.ts) and `tsudoku.history.v1` (history.ts).
 * A new key must use it too, or "Clear saved data" will miss it.
 */
const STORAGE_PREFIX = 'tsudoku.';

/**
 * Remove every key the app has written, and nothing else.
 *
 * Deliberately not `localStorage.clear()`: the origin can be shared with other
 * scripts (Vercel's preview toolbar writes here), and wiping their state is
 * not this button's business.
 *
 * Callers should reload afterwards. The settings and history hooks hold their
 * state in memory and save it on every change, so without a reload the next
 * interaction would write it all straight back.
 */
export function clearSavedData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    // Collected first: removing while indexing shifts the indices.
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Storage unavailable: there is nothing saved to clear.
  }
}
