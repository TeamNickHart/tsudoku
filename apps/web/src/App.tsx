import { useCallback, useEffect, useState } from 'react';
import { SIZE } from '@tsudoku/core';
import { Board } from '@/components/Board';
import { NumberPad } from '@/components/NumberPad';
import { Button } from '@/components/ui/button';
import { useGame } from '@/lib/useGame';
import type { InputMode } from '@/lib/useGame';
import { PUZZLES } from '@/data/corpus';
import { cn } from '@/lib/utils';

const MODE_LABELS: Record<InputMode, string> = {
  value: 'Value',
  'note-included': 'Note',
  'note-excluded': 'Strike',
};

export function App(): JSX.Element {
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const puzzle = PUZZLES[puzzleIndex]!;

  const game = useGame(puzzle.puzzle);
  const { state, cells, counts, errors, solved, remaining, mode, setMode, hint } = game;

  const selectCellAt = useCallback(
    (index: number, additive: boolean) => {
      game.dispatch({ type: 'select', cell: index, additive });
    },
    [game],
  );

  const enterDigit = useCallback(
    (digit: number) => {
      game.dispatch({ type: 'digit', digit, mode });
    },
    [game, mode],
  );

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
      if (e.key === 'Escape') game.dispatch({ type: 'clearSelection' });

      const focus = state.selected.length > 0 ? state.selected[state.selected.length - 1]! : 40;
      const move = (delta: number): void => {
        e.preventDefault();
        const next = Math.max(0, Math.min(80, focus + delta));
        game.dispatch({ type: 'select', cell: next, additive: false });
      };
      if (e.key === 'ArrowUp') move(-SIZE);
      if (e.key === 'ArrowDown') move(SIZE);
      if (e.key === 'ArrowLeft') move(-1);
      if (e.key === 'ArrowRight') move(1);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, enterDigit, erase, setMode, state.selected]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">TSudoku</h1>
        <p className="text-sm text-muted-foreground tabular-nums">
          SE {puzzle.rating.toFixed(1)} · {puzzle.technique}
        </p>
      </header>

      <Board cells={cells} selected={state.selected} onSelect={selectCellAt} />

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
        disabled={state.selected.length === 0}
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
          className="ml-auto"
          onClick={() => {
            const next = (puzzleIndex + 1) % PUZZLES.length;
            setPuzzleIndex(next);
            game.newGame(PUZZLES[next]!.puzzle);
          }}
        >
          Next puzzle
        </Button>
      </div>

      {hint && (
        <div className="rounded-lg border border-board-primary/40 bg-board-primary/5 p-3 text-sm">
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
        Click a cell, then type a digit. <kbd>V</kbd> value · <kbd>N</kbd> note · <kbd>X</kbd>{' '}
        strike · shift-click to multi-select · <kbd>⌘Z</kbd> undo
      </p>
    </div>
  );
}
