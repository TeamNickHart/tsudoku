import { useCallback, useEffect, useState } from 'react';
import { DIFFICULTY_BANDS } from './difficulty';

/**
 * Player settings, persisted to localStorage.
 *
 * Deliberately small and plain: a serialisable object with a version tag, so
 * it can be moved into `@tsudoku/game` when React Native needs it without
 * dragging any web idioms along. Nothing here makes a decision — the settings
 * say what the player wants, and the game layer acts on it.
 */

const STORAGE_KEY = 'tsudoku.settings.v1';

/**
 * Techniques the player has turned auto-solve on for.
 *
 * The intent is that these are *earned*: once you can reliably spot naked
 * singles yourself, having the app fill them stops being a cheat and starts
 * being a convenience, the way a chess player stops calculating trivial
 * recaptures. Nothing enforces that yet — this records the preference, and
 * the solving behaviour comes later.
 *
 * Kept as a list of technique names rather than a boolean per band so the
 * granularity matches how the skill is actually acquired: one technique at a
 * time, in whatever order the player happens to get them.
 */
export interface Settings {
  readonly version: 1;
  /** Which difficulty band new puzzles are drawn from. */
  readonly bandId: string;
  /** Technique names the player has enabled auto-solve for. */
  readonly autoSolve: readonly string[];
  /** Fill notes from the engine's candidates as the board changes. */
  readonly autoNotes: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  bandId: DIFFICULTY_BANDS[0]!.id,
  autoSolve: [],
  autoNotes: false,
};

/**
 * Read settings, falling back to defaults on anything unexpected.
 *
 * localStorage can throw (private mode, blocked site data) and can hold
 * whatever an older build wrote, so every field is validated rather than
 * trusted. A settings object that half-parses is worse than one that resets.
 */
function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_SETTINGS;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS;

    const record = parsed as Record<string, unknown>;
    if (record['version'] !== 1) return DEFAULT_SETTINGS;

    const bandId =
      typeof record['bandId'] === 'string' &&
      DIFFICULTY_BANDS.some((b) => b.id === record['bandId'])
        ? record['bandId']
        : DEFAULT_SETTINGS.bandId;

    const autoSolve = Array.isArray(record['autoSolve'])
      ? record['autoSolve'].filter((t): t is string => typeof t === 'string')
      : [];

    return {
      version: 1,
      bandId,
      autoSolve,
      autoNotes: record['autoNotes'] === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function save(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable or full. The session still works; the preference
    // just will not survive a reload, which is not worth interrupting play for.
  }
}

export interface UseSettings {
  readonly settings: Settings;
  readonly setBand: (bandId: string) => void;
  readonly toggleAutoSolve: (technique: string) => void;
  readonly setAutoNotes: (enabled: boolean) => void;
}

export function useSettings(): UseSettings {
  // Lazy initialiser: localStorage is read once on mount rather than on every
  // render, and never during module evaluation (which would break SSR and any
  // environment without a DOM).
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    save(settings);
  }, [settings]);

  const setBand = useCallback((bandId: string) => {
    setSettings((s) => ({ ...s, bandId }));
  }, []);

  const toggleAutoSolve = useCallback((technique: string) => {
    setSettings((s) => ({
      ...s,
      autoSolve: s.autoSolve.includes(technique)
        ? s.autoSolve.filter((t) => t !== technique)
        : [...s.autoSolve, technique],
    }));
  }, []);

  const setAutoNotes = useCallback((enabled: boolean) => {
    setSettings((s) => ({ ...s, autoNotes: enabled }));
  }, []);

  return { settings, setBand, toggleAutoSolve, setAutoNotes };
}
