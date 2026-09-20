import { BOX_HEIGHT, BOX_WIDTH, SIZE, boxOf, colOf, rowOf } from '@tsudoku/core';
import type { CellView } from '@tsudoku/game';
import { useDragSelect } from '@/lib/useDragSelect';
import { cn } from '@/lib/utils';
import { Cell } from './Cell';

/**
 * The grid rules, drawn once for the whole board.
 *
 * Deliberately NOT per cell. When each cell drew its own right/bottom rule, a
 * box boundary was really nine independent segments, and sub-pixel differences
 * in cell offsets (measured at 279.992 vs 280 across one boundary) put them on
 * different device pixels — so the line came out solid in some columns and
 * faint or missing in others.
 *
 * Here each line is a single element spanning the full width or height,
 * positioned as a percentage of the board. One element, one rasterisation, so
 * a line is either fully drawn or not drawn at all.
 */
function BoardLines(): JSX.Element {
  const lines = [];

  for (let i = 1; i < SIZE; i++) {
    const pct = (i / SIZE) * 100;
    const isBoxBoundary = i % BOX_WIDTH === 0;
    lines.push(
      <span
        key={`v${i}`}
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0',
          isBoxBoundary ? 'w-[2px] bg-foreground/30' : 'w-px bg-border/60',
        )}
        // Centre the rule on the boundary so a 2px line straddles it evenly.
        style={{ left: `calc(${pct}% - ${isBoxBoundary ? 1 : 0.5}px)` }}
      />,
    );
  }

  for (let i = 1; i < SIZE; i++) {
    const pct = (i / SIZE) * 100;
    const isBoxBoundary = i % BOX_HEIGHT === 0;
    lines.push(
      <span
        key={`h${i}`}
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0',
          isBoxBoundary ? 'h-[2px] bg-foreground/30' : 'h-px bg-border/60',
        )}
        style={{ top: `calc(${pct}% - ${isBoxBoundary ? 1 : 0.5}px)` }}
      />,
    );
  }

  return <>{lines}</>;
}

interface BoardProps {
  readonly cells: readonly CellView[];
  readonly selected: readonly number[];
  /** Replace the whole selection — used while painting a drag. */
  readonly onReplaceSelection: (cells: readonly number[]) => void;
  /** Toggle one cell in or out — used for taps. */
  readonly onToggleSelection: (cell: number) => void;
  /** Keyboard activation. */
  readonly onActivate: (index: number, additive: boolean) => void;
  /** False in value mode, where selecting a run has no meaning. */
  readonly multiSelect: boolean;
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
  multiSelect,
}: BoardProps): JSX.Element {
  const { cellProps } = useDragSelect({
    onReplace: onReplaceSelection,
    onToggle: onToggleSelection,
    selected,
    multiSelect,
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
      className="relative grid aspect-square w-full grid-cols-9 overflow-hidden rounded-lg border-2 border-foreground/30 bg-background shadow-sm"
      style={{ gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))` }}
    >
      <BoardLines />
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
