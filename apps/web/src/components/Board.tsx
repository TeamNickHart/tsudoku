import { SIZE, boxOf, colOf, rowOf } from '@tsudoku/core';
import type { CellView } from '@tsudoku/game';
import { useDragSelect } from '@/lib/useDragSelect';
import { Cell } from './Cell';

interface BoardProps {
  readonly cells: readonly CellView[];
  readonly selected: readonly number[];
  /** Replace the whole selection — used while painting a drag. */
  readonly onReplaceSelection: (cells: readonly number[]) => void;
  /** Toggle one cell in or out — used for taps. */
  readonly onToggleSelection: (cell: number) => void;
  /** Keyboard activation. */
  readonly onActivate: (index: number, additive: boolean) => void;
}

/**
 * The 9x9 board.
 *
 * Peer and same-digit shading are computed here rather than in the game model:
 * they are navigation aids, not game state, and a different UI might highlight
 * differently or not at all.
 */
export function Board({
  cells,
  selected,
  onReplaceSelection,
  onToggleSelection,
  onActivate,
}: BoardProps): JSX.Element {
  const { cellProps } = useDragSelect({
    onReplace: onReplaceSelection,
    onToggle: onToggleSelection,
    selected,
  });

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
          onActivate={onActivate}
          {...cellProps(view.index)}
        />
      ))}
    </div>
  );
}
