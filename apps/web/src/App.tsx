import { useCallback, useEffect, useState } from 'react';
import { SIZE } from '@tsudoku/core';
import { isDigitPlacedInPeer } from '@tsudoku/game';
import { Board } from '@/components/Board';
import { NumberPad } from '@/components/NumberPad';
import { Button } from '@/components/ui/button';
import { useGame } from '@/lib/useGame';
import type { InputMode } from '@/lib/useGame';
import { SettingsPanel } from '@/components/SettingsPanel';
import { bandForPuzzle, randomPuzzleInBand } from '@/lib/difficulty';
import { useSettings } from '@/lib/settings';
import { cn } from '@/lib/utils';

const MODE_LABELS: Record<InputMode, string> = {
  value: 'Value',
  'note-included': 'Note',
  'note-excluded': 'Strike',
};

export function App(): JSX.Element {
  const { settings, setBand, toggleAutoSolve, setAutoNotes } = useSettings();
  const [showSettings, setShowSettings] = useState(false);

  // The first puzzle is drawn once, on mount. A lazy initialiser rather than a
  // plain call so a re-render never silently swaps the board out from under a
  // game in progress.
  const [puzzle, setPuzzle] = useState(() => randomPuzzleInBand(settings.bandId));

  const game = useGame(puzzle.puzzle);
  const { state, cells, counts, errors, solved, remaining, mode, setMode, hint } = game;

  // In value mode the target is the single selected cell. When it already
  // holds a value there is nothing a digit press can do, so the pad says so
  // rather than silently swallowing the press.
  const valueTarget =
    mode === 'value' && state.selected.length > 0
      ? state.selected[state.selected.length - 1]
      : undefined;
  const targetLocked = valueTarget !== undefined && cells[valueTarget]?.lock !== 'editable';

  // In note and strike modes, a digit already placed in a selected cell's row,
  // column or box cannot be a candidate there. Shown as unavailable so the
  // press does not look like it worked — the game layer refuses it either way.
  //
  // With several cells selected a digit is only blocked when it is impossible
  // in *all* of them; otherwise the press still does useful work on the rest.
  const unavailableDigits =
    mode === 'value' || state.selected.length === 0
      ? []
      : Array.from({ length: SIZE }, (_, i) => i + 1).filter((digit) =>
          state.selected.every((cell) => isDigitPlacedInPeer(state, cell, digit)),
        );

  const band = bandForPuzzle(puzzle);

  const newPuzzle = useCallback(() => {
    const next = randomPuzzleInBand(settings.bandId, puzzle.puzzle);
    setPuzzle(next);
    setFocusDigit(null);
    game.newGame(next.puzzle);
  }, [settings.bandId, puzzle.puzzle, game]);

  const activateCell = useCallback(
    (index: number, additive: boolean) => {
      game.dispatch({ type: 'select', cell: index, additive, mode });
    },
    [game, mode],
  );

  /**
   * The digit the player is currently thinking about.
   *
   * Pressing a digit does two things: it enters that digit into any selected
   * cells (as before), and it focuses the digit so the board can show where it
   * is still possible. Pressing the same digit again clears the focus, which
   * is how you get back to an unhighlighted board without selecting something
   * else.
   *
   * Entry and focus are deliberately the same gesture. A separate "highlight"
   * mode would be one more thing to learn, and the digit you are entering is
   * almost always the digit you want to see.
   */
  const [focusDigit, setFocusDigit] = useState<number | null>(null);

  const enterDigit = useCallback(
    (digit: number) => {
      // With a selection, the press is entry, and the digit being entered is
      // the one worth seeing — so it is set, never toggled. Toggling broke the
      // core loop: focus 3, select cells, strike 3, and the highlight vanished
      // at the exact moment the player wanted it back. With nothing selected
      // the press is purely "show me this digit", and pressing it again is
      // how that view is dismissed.
      const entering = state.selected.length > 0;
      setFocusDigit((current) => (entering || current !== digit ? digit : null));
      game.dispatch({ type: 'digit', digit, mode, autoNotes: settings.autoNotes });
    },
    [game, mode, settings.autoNotes, state.selected.length],
  );

  /**
   * A drag declares a multi-selection.
   *
   * Note and strike stay as they are. Value mode switches to note mode: a run
   * of cells only makes sense when you are about to annotate them, so there is
   * no reason to make the player press "Note" first. Either way the drag
   * starts a fresh selection — it never extends the old one.
   */
  const handleDragStart = useCallback(() => {
    if (mode === 'value') setMode('note-included');
  }, [mode, setMode]);

  const paintSelection = useCallback(
    (cells: readonly number[]) => {
      game.dispatch({ type: 'setSelection', cells });
    },
    [game],
  );

  /**
   * A tap on a cell.
   *
   * A filled cell is a question about its digit, not a target: it focuses that
   * digit, exactly like pressing it on the pad, and clears the selection so
   * the board shows where the digit can still go. Focus is set, not toggled —
   * tapping one 5 after another while scanning should never switch the view
   * off.
   *
   * An empty cell toggles in or out of the selection in note and strike modes.
   * In value mode it becomes the single selected cell and the digit focus is
   * cleared.
   */
  const tapCell = useCallback(
    (cell: number) => {
      const value = cells[cell]?.value ?? null;
      if (value !== null) {
        setFocusDigit(value);
        game.dispatch({ type: 'clearSelection' });
        return;
      }
      // Selecting a cell to fill in value mode starts a fresh look at the
      // board: the old digit's highlights would only compete with the
      // selected cell's peers.
      if (mode === 'value') setFocusDigit(null);
      game.dispatch({ type: 'select', cell, additive: true, mode });
    },
    [cells, game, mode],
  );

  /**
   * Back to a clean slate: no selection, no focused digit, no hint, value mode.
   *
   * Entering notes and strikes never clears the selection on its own — the
   * player builds a selection and may work several digits across it. Clearing
   * is always an explicit act: tapping off the board (or Escape).
   */
  const { dispatch, dismissHint } = game;
  const resetView = useCallback(() => {
    dispatch({ type: 'clearSelection' });
    setFocusDigit(null);
    setMode('value');
    dismissHint();
  }, [dispatch, setMode, dismissHint]);

  // A tap anywhere that is not the board or a control resets the view.
  // Controls are matched structurally rather than listed, so a new button
  // cannot forget to opt out; panels with non-button content opt out with
  // data-keep-selection.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent): void => {
      if (!(e.target instanceof Element)) return;
      const keep = e.target.closest(
        'button, a, input, select, textarea, label, [role="grid"], [data-keep-selection]',
      );
      if (keep === null) resetView();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [resetView]);

  const erase = useCallback(() => {
    game.dispatch({ type: 'erase' });
  }, [game]);

  // Keyboard: digits enter in the current mode, arrows move, N/X/V switch mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          game.dispatch({ type: 'undo' });
          return;
        }
        if (e.key === 'z' || e.key === 'y') {
          e.preventDefault();
          game.dispatch({ type: 'redo' });
          return;
        }
        return;
      }

      if (e.key >= '1' && e.key <= String(SIZE)) {
        enterDigit(Number(e.key));
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        erase();
        return;
      }
      if (e.key === 'v') setMode('value');
      if (e.key === 'n') setMode('note-included');
      if (e.key === 'x') setMode('note-excluded');
      if (e.key === 'Escape') resetView();

      const focus = state.selected.length > 0 ? state.selected[state.selected.length - 1]! : 40;
      const move = (delta: number): void => {
        e.preventDefault();
        const next = Math.max(0, Math.min(80, focus + delta));
        game.dispatch({ type: 'select', cell: next, additive: false, mode });
      };
      if (e.key === 'ArrowUp') move(-SIZE);
      if (e.key === 'ArrowDown') move(SIZE);
      if (e.key === 'ArrowLeft') move(-1);
      if (e.key === 'ArrowRight') move(1);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, enterDigit, erase, setMode, state.selected, mode, resetView]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">TSudoku</h1>
        <p className="text-right text-sm text-muted-foreground">
          <span className="tabular-nums">
            SE {puzzle.rating.toFixed(1)} · {puzzle.technique}
          </span>
          {band !== null && <span className="block text-xs">{band.label}</span>}
        </p>
      </header>

      <Board
        cells={cells}
        selected={state.selected}
        onTap={tapCell}
        onDragStart={handleDragStart}
        onPaint={paintSelection}
        onActivate={activateCell}
        focusDigit={focusDigit}
      />

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground tabular-nums">
          {remaining} left
          {errors.length > 0 && (
            <span className="ml-2 text-board-error">{errors.length} wrong</span>
          )}
        </span>
        {solved && <span className="font-medium text-board-primary">Solved</span>}
      </div>

      <div className="flex gap-2" role="group" aria-label="Input mode">
        {(Object.keys(MODE_LABELS) as InputMode[]).map((m) => (
          <Button
            key={m}
            variant={mode === m ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode(m)}
            className={cn('flex-1')}
            aria-pressed={mode === m}
          >
            {MODE_LABELS[m]}
          </Button>
        ))}
      </div>

      <NumberPad
        counts={counts}
        onDigit={enterDigit}
        onErase={erase}
        focusDigit={focusDigit}
        // Only erase needs a selection. Digits stay live so a digit can be
        // focused to scan the board without selecting a cell first — which is
        // exactly when you want to look.
        eraseDisabled={state.selected.length === 0 || targetLocked}
        entryBlocked={targetLocked}
        unavailableDigits={unavailableDigits}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => game.dispatch({ type: 'undo' })}
          disabled={!game.canUndo}
        >
          Undo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => game.dispatch({ type: 'redo' })}
          disabled={!game.canRedo}
        >
          Redo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => game.dispatch({ type: 'fillNotes' })}
          title="Fill notes with the engine's candidates (selection, or whole board)"
        >
          Auto-notes
        </Button>
        <Button variant="outline" size="sm" onClick={game.requestHint}>
          Hint
        </Button>
        <Button variant="ghost" size="sm" onClick={() => game.dispatch({ type: 'reset' })}>
          Reset
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings((open) => !open)}
          aria-expanded={showSettings}
        >
          Settings
        </Button>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={newPuzzle}>
          New puzzle
        </Button>
      </div>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSetBand={(bandId) => {
            setBand(bandId);
            // Switching band should show a puzzle from it straight away —
            // otherwise the setting looks like it did nothing until the next
            // "New puzzle" press.
            const next = randomPuzzleInBand(bandId, puzzle.puzzle);
            setPuzzle(next);
            game.newGame(next.puzzle);
          }}
          onToggleAutoSolve={toggleAutoSolve}
          onSetAutoNotes={setAutoNotes}
          onClose={() => setShowSettings(false)}
        />
      )}

      {hint && (
        <div
          data-keep-selection
          className="rounded-lg border border-board-primary/40 bg-board-primary/5 p-3 text-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{hint.technique}</p>
              <p className="mt-1 text-muted-foreground">{hint.explanation}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={game.dismissHint}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <p className="mt-auto text-xs text-muted-foreground">
        Tap a cell to enter a value; tap a filled cell to see where its digit can go. Drag across
        cells to select a run for notes — tap a cell to add or remove it. Tap off the board to clear
        everything. <kbd>V</kbd> value · <kbd>N</kbd> note · <kbd>X</kbd> strike · <kbd>Esc</kbd>{' '}
        clear · <kbd>⌘Z</kbd> undo
      </p>
    </div>
  );
}
