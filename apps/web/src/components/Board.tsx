import { SIZE, boxOf, colOf, rowOf } from '@tsudoku/core';
import type { CellView } from '@tsudoku/game';
import { Cell } from './Cell';

interface BoardProps {
  readonly cells: readonly CellView[];
  readonly selected: readonly number[];
  readonly onSelect: (index: number, additive: boolean) => void;
}

/**
 * The 9x9 board.
 *
 * Peer and same-digit shading are computed here rather than in the game model:
 * they are navigation aids, not game state, and a different UI might highlight
 * differently or not at all.
 */
export function Board({ cells, selected, onSelect }: BoardProps): JSX.Element {
  const focus = selected.length === 1 ? selected[0] : undefined;
  const focusCell = focus === undefined ? undefined : cells[focus];
  const focusDigit = focusCell?.value ?? null;

  const isPeer = (index: number): boolean => {
    if (focus === undefined) return false;
    return (
      rowOf(index) === rowOf(focus) ||
      colOf(index) === colOf(focus) ||
      boxOf(rowOf(index), colOf(index)) === boxOf(rowOf(focus), colOf(focus))
    );
  };

  return (
    <div
      role="grid"
      aria-label="Sudoku board"
      className="grid aspect-square w-full grid-cols-9 overflow-hidden rounded-lg border-2 border-foreground/30 bg-background shadow-sm"
      style={{ gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))` }}
    >
      {cells.map((view) => (
        <Cell
          key={view.index}
          view={view}
          isPeer={isPeer(view.index)}
          isSameDigit={focusDigit !== null && view.value === focusDigit}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
