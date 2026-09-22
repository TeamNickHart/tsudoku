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
  /** The digit being scanned for, so notes for it can be picked out. */
  readonly focusDigit: number | null;
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
  focusDigit,
  onPointerDown,
  onPointerEnter,
  onActivate,
}: CellProps): JSX.Element {
  const {
    index,
    value,
    lock,
    notes,
    isError,
    staleNotes,
    includedNotes,
    isSelected,
    roles,
    noteRoles,
  } = view;

  const row = Math.floor(index / SIZE);
  const col = index % SIZE;

  // An empty cell where the focused digit is still a live candidate. This is
  // the set the player is scanning for, so the cell itself gets a tint —
  // picking out single notes at 10px is hard, and the cell-level cue is what
  // makes the pattern visible across the whole board.
  const holdsFocusNote =
    focusDigit !== null && value === null && includedNotes.includes(focusDigit);

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
        // No borders and no per-cell rules. Grid lines are drawn once by
        // <BoardLines> as full-width/height overlays on the board itself.
        // Drawing them per cell meant a box boundary was really nine separate
        // segments, and sub-pixel differences in cell offsets (measured at
        // 279.992 vs 280) landed them on different device pixels, so the line
        // rendered solid in some columns and faint or missing in others.
        'border-0',
        // Adjacency shading, then selection, then decorations — later wins.
        holdsFocusNote &&
          !isSelected &&
          'bg-board-primary/10 ring-1 ring-inset ring-board-primary/40',
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
        <NoteGrid
          notes={notes}
          included={includedNotes}
          staleNotes={staleNotes}
          focusDigit={focusDigit}
          noteRoles={noteRoles}
        />
      )}
    </button>
  );
}

interface NoteGridProps {
  readonly notes: CellView['notes'];
  /** Every noted digit, from either source. */
  readonly included: readonly number[];
  readonly staleNotes: readonly number[];
  readonly noteRoles: CellView['noteRoles'];
  /** The digit being scanned for. Its notes stand out; others recede. */
  readonly focusDigit: number | null;
}

/**
 * The 3x3 mini-grid of notes inside an empty cell.
 *
 * Every digit occupies a fixed position whether or not it is noted, so notes
 * do not jump around as they are added — which matters a lot when scanning.
 */
function NoteGrid({
  notes,
  included,
  staleNotes,
  noteRoles,
  focusDigit,
}: NoteGridProps): JSX.Element | null {
  const hasAny = included.length > 0 || notes.excluded.length > 0;
  if (!hasAny) return null;

  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 p-[6%]">
      {Array.from({ length: SIZE }, (_, i) => i + 1).map((digit) => {
        const isIncluded = included.includes(digit);
        const excluded = notes.excluded.includes(digit);
        if (!isIncluded && !excluded) {
          return <span key={digit} aria-hidden />;
        }

        const isStale = staleNotes.includes(digit);
        // Auto notes render lighter: the app maintains them, and they vanish
        // on their own when a placement rules them out. A note the player wrote
        // stays put and goes stale instead.
        const isAuto = notes.auto.includes(digit);
        const roles = noteRoles[digit] ?? [];
        const roleClasses = roles.map((r) => NOTE_ROLE_STYLES[r] ?? '');
        // A digit marked both possible and impossible is a contradiction the
        // player wrote down. Show it rather than resolving it.
        const isConflict = isIncluded && excluded;

        // Digit focus: the player pressed a number and wants to see where it
        // can still go.
        //
        // A noted focus digit is what they are looking for, so it is pulled
        // forward. A *struck* focus digit is the opposite — they have already
        // ruled it out here — so it recedes rather than disappearing, since
        // "I decided no" is information worth keeping visible. Everything
        // else in the cell dims, which is what makes the scan work: the
        // contrast comes from suppressing the noise, not from shouting.
        const isFocusDigit = focusDigit === digit;
        const dimmedByFocus = focusDigit !== null && !isFocusDigit;

        return (
          <span
            key={digit}
            className={cn(
              // Minimum 0.625rem (10px). The old floor was 0.45rem — 7.2px on a
              // 375px-wide phone, measured, which is below what anyone can
              // comfortably read and well under the ~11px where digits stay
              // legible at a glance. The note cell is a third of a board cell,
              // so 2.2vmin tracks it closely and the max only matters on very
              // wide screens.
              'flex items-center justify-center text-[clamp(0.625rem,2.2vmin,0.8rem)]',
              'leading-none tabular-nums transition-opacity',
              'text-board-note',
              isAuto && 'opacity-60',
              excluded && 'line-through decoration-1 opacity-70',
              isStale && 'text-board-note-stale',
              isConflict && 'text-board-error underline decoration-wavy',
              dimmedByFocus && 'opacity-25',
              isFocusDigit && isIncluded && 'text-board-primary scale-125 font-bold opacity-100',
              isFocusDigit && excluded && !isIncluded && 'opacity-30',
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
