import { SIZE } from '@tsudoku/core';
import type { CellView, DecorationRole } from '@tsudoku/game';
import { cn } from '@/lib/utils';

/**
 * One cell of the board.
 *
 * This component renders and reports clicks. It decides nothing about the game
 * — every question of "what does this cell contain, is it wrong, is it
 * selected, what did the hint say about it" is answered by the `CellView` the
 * game layer produced. That is the rule that keeps the React Native port a
 * re-render rather than a rewrite.
 *
 * The one thing it *does* own is appearance: mapping a semantic
 * `DecorationRole` to actual colors and weights.
 */

/** Semantic role -> ring/background. Roles never name colors; this does. */
const ROLE_STYLES: Record<DecorationRole, string> = {
  primary: 'ring-2 ring-inset ring-board-primary bg-board-primary/10',
  supporting: 'ring-1 ring-inset ring-board-supporting bg-board-supporting/10',
  eliminated: '',
  error: 'bg-board-error/10',
  stale: '',
  'highlight-1': 'bg-board-primary/15',
  'highlight-2': 'bg-board-supporting/15',
  'highlight-3': 'bg-board-peer',
};

/** Roles that style an individual note rather than the whole cell. */
const NOTE_ROLE_STYLES: Partial<Record<DecorationRole, string>> = {
  eliminated: 'text-board-eliminated line-through decoration-2',
  primary: 'text-board-primary font-bold',
  supporting: 'text-board-supporting font-bold',
};

interface CellProps {
  readonly view: CellView;
  /** True when this cell shares a row, column or box with the selection. */
  readonly isPeer: boolean;
  /** True when this cell holds the same digit as the selected cell. */
  readonly isSameDigit: boolean;
  /** Pointer handlers from useDragSelect — drag to paint, tap to toggle. */
  readonly onPointerDown: (e: React.PointerEvent) => void;
  readonly onPointerEnter: () => void;
  /** Keyboard activation, which has no drag equivalent. */
  readonly onActivate: (index: number, additive: boolean) => void;
}

export function Cell({
  view,
  isPeer,
  isSameDigit,
  onPointerDown,
  onPointerEnter,
  onActivate,
}: CellProps): JSX.Element {
  const { index, value, lock, notes, isError, staleNotes, isSelected, roles, noteRoles } = view;

  const row = Math.floor(index / SIZE);
  const col = index % SIZE;

  return (
    <button
      type="button"
      aria-label={`Row ${row + 1}, column ${col + 1}${value === null ? ', empty' : `, ${value}`}`}
      aria-pressed={isSelected}
      data-cell-index={index}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onKeyDown={(e) => {
        // Pointer events do not fire for keyboard activation, so Enter/Space
        // are handled separately rather than relying on the click default.
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate(index, e.shiftKey || e.metaKey || e.ctrlKey);
        }
      }}
      // Stop touch-drag from scrolling the page while painting a selection.
      style={{ touchAction: 'none' }}
      className={cn(
        'relative flex aspect-square items-center justify-center select-none',
        'transition-colors duration-75',
        // Box borders: heavier every three cells.
        'border-r border-b border-border/60',
        col % 3 === 2 && col !== SIZE - 1 && 'border-r-2 border-r-foreground/30',
        row % 3 === 2 && row !== SIZE - 1 && 'border-b-2 border-b-foreground/30',
        col === SIZE - 1 && 'border-r-0',
        row === SIZE - 1 && 'border-b-0',
        // Adjacency shading, then selection, then decorations — later wins.
        isSameDigit && !isSelected && 'bg-board-peer/60',
        isPeer && !isSelected && !isSameDigit && 'bg-board-peer/30',
        isSelected && 'bg-board-selected/20 ring-2 ring-inset ring-board-selected',
        ...roles.map((r) => ROLE_STYLES[r]),
        'hover:bg-board-peer/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {value !== null ? (
        <span
          className={cn(
            'text-[clamp(1.1rem,4.2vmin,2rem)] leading-none tabular-nums',
            // Weight and color carry the given/entered distinction.
            lock === 'given' ? 'font-semibold text-board-given' : 'font-normal text-board-entry',
            isError && 'text-board-error font-semibold',
          )}
        >
          {value}
        </span>
      ) : (
        <NoteGrid notes={notes} staleNotes={staleNotes} noteRoles={noteRoles} />
      )}
    </button>
  );
}

interface NoteGridProps {
  readonly notes: CellView['notes'];
  readonly staleNotes: readonly number[];
  readonly noteRoles: CellView['noteRoles'];
}

/**
 * The 3x3 mini-grid of notes inside an empty cell.
 *
 * Every digit occupies a fixed position whether or not it is noted, so notes
 * do not jump around as they are added — which matters a lot when scanning.
 */
function NoteGrid({ notes, staleNotes, noteRoles }: NoteGridProps): JSX.Element | null {
  const hasAny = notes.included.length > 0 || notes.excluded.length > 0;
  if (!hasAny) return null;

  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 p-[6%]">
      {Array.from({ length: SIZE }, (_, i) => i + 1).map((digit) => {
        const included = notes.included.includes(digit);
        const excluded = notes.excluded.includes(digit);
        if (!included && !excluded) {
          return <span key={digit} aria-hidden />;
        }

        const isStale = staleNotes.includes(digit);
        const roles = noteRoles[digit] ?? [];
        const roleClasses = roles.map((r) => NOTE_ROLE_STYLES[r] ?? '');
        // A digit marked both possible and impossible is a contradiction the
        // player wrote down. Show it rather than resolving it.
        const isConflict = included && excluded;

        return (
          <span
            key={digit}
            className={cn(
              'flex items-center justify-center text-[clamp(0.45rem,1.5vmin,0.7rem)]',
              'leading-none tabular-nums',
              'text-board-note',
              excluded && 'line-through decoration-1 opacity-70',
              isStale && 'text-board-note-stale',
              isConflict && 'text-board-error underline decoration-wavy',
              ...roleClasses,
            )}
          >
            {digit}
          </span>
        );
      })}
    </div>
  );
}
