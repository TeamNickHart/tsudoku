import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Which puzzles the player has solved, persisted to localStorage.
 *
 * Used so "New puzzle" prefers boards the player has not finished yet. Kept
 * apart from settings: settings say what the player wants, this records what
 * they did, and the two will grow in different directions (per-technique
 * progress, streaks) without wanting to share a version number.
 *
 * Plain serialisable data with a version tag, like settings, so it can move
 * into `@tsudoku/game` when React Native needs it.
 */

const STORAGE_KEY = 'tsudoku.history.v1';

export interface SolvedRecord {
  /** The puzzle's 81-char givens string — its identity in the corpus. */
  readonly puzzle: string;
  /** ISO timestamp of the first solve. Not used yet; cheap to keep now. */
  readonly solvedAt: string;
}

export interface History {
  readonly version: 1;
  /** First solve of each puzzle, oldest first. */
  readonly solved: readonly SolvedRecord[];
}

const EMPTY_HISTORY: History = { version: 1, solved: [] };

function isSolvedRecord(value: unknown): value is SolvedRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['puzzle'] === 'string' &&
    record['puzzle'].length === 81 &&
    typeof record['solvedAt'] === 'string'
  );
}

/**
 * Read history, falling back to empty on anything unexpected.
 *
 * Entries are validated one by one and bad ones dropped, rather than
 * discarding the whole history over one malformed record — losing a player's
 * record of what they solved is worse than losing a setting.
 */
function load(): History {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return EMPTY_HISTORY;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_HISTORY;

    const record = parsed as Record<string, unknown>;
    if (record['version'] !== 1 || !Array.isArray(record['solved'])) return EMPTY_HISTORY;

    return { version: 1, solved: record['solved'].filter(isSolvedRecord) };
  } catch {
    return EMPTY_HISTORY;
  }
}

function save(history: History): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Storage unavailable or full. Play continues; the record just will not
    // survive a reload.
  }
}

export interface UseHistory {
  /** Puzzle strings the player has solved at least once. */
  readonly solved: ReadonlySet<string>;
  /** Record a solve. A puzzle already in the history is left as it was. */
  readonly recordSolved: (puzzle: string) => void;
}

export function useHistory(): UseHistory {
  // Lazy initialiser: read once on mount, never during module evaluation.
  const [history, setHistory] = useState<History>(load);

  useEffect(() => {
    save(history);
  }, [history]);

  const solved = useMemo(() => new Set(history.solved.map((r) => r.puzzle)), [history]);

  const recordSolved = useCallback((puzzle: string) => {
    setHistory((h) =>
      h.solved.some((r) => r.puzzle === puzzle)
        ? h
        : { ...h, solved: [...h.solved, { puzzle, solvedAt: new Date().toISOString() }] },
    );
  }, []);

  return { solved, recordSolved };
}
