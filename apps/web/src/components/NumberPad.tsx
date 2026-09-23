import { SIZE } from '@tsudoku/core';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface NumberPadProps {
  readonly counts: Readonly<Record<number, number>>;
  readonly onDigit: (digit: number) => void;
  readonly onErase: () => void;
  /** The digit currently being scanned for, if any. */
  readonly focusDigit: number | null;
  /** Erase needs a selection; digits do not, since they also set focus. */
  readonly eraseDisabled: boolean;
  /**
   * True when the selected cell already holds a value, so a digit press cannot
   * change it. Digits still work — they set the scan focus — but the pad says
   * why entry will not happen.
   */
  readonly entryBlocked: boolean;
  /**
   * Digits that cannot be noted or struck in the current selection, because a
   * peer already holds them. Dimmed and disabled rather than silently inert.
   */
  readonly unavailableDigits: readonly number[];
}

/**
 * Digit entry, and the digit-focus control.
 *
 * Pressing a digit enters it into the selection and focuses it, so the board
 * can show every cell where that digit is still possible. The pressed digit
 * stays visibly active until it is pressed again.
 *
 * A digit with all nine placed is dimmed — the "all of these are solved"
 * signal, which saves scanning the board to work it out.
 */
export function NumberPad({
  counts,
  onDigit,
  onErase,
  focusDigit,
  eraseDisabled,
  entryBlocked,
  unavailableDigits,
}: NumberPadProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {entryBlocked && (
        <p className="text-xs text-muted-foreground" role="status">
          That cell is already filled. Undo to change it.
        </p>
      )}
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: SIZE }, (_, i) => i + 1).map((digit) => {
          const complete = (counts[digit] ?? 0) >= SIZE;
          const focused = focusDigit === digit;
          // A digit already placed in a selected cell's row, column or box
          // cannot be noted there. Dimmed, but NOT disabled: the press still
          // sets the scan focus, and "where else can this digit go?" is a fair
          // question about a digit that cannot go here. The game layer refuses
          // only the note half.
          const unavailable = unavailableDigits.includes(digit);
          return (
            <Button
              key={digit}
              variant="outline"
              onClick={() => onDigit(digit)}
              aria-pressed={focused}
              className={cn(
                'h-12 text-lg tabular-nums sm:h-14',
                complete && 'text-muted-foreground/40',
                focused && 'border-board-primary bg-board-primary/15 font-semibold',
                unavailable && !focused && 'opacity-40',
              )}
              aria-label={`Enter ${digit}${complete ? ' (all placed)' : ''}${focused ? ' (highlighting)' : ''}${unavailable ? ' (already in this row, column or box)' : ''}`}
            >
              {digit}
            </Button>
          );
        })}
        <Button
          variant="outline"
          onClick={onErase}
          disabled={eraseDisabled}
          className="h-12 sm:h-14"
          aria-label="Erase"
        >
          ⌫
        </Button>
      </div>
    </div>
  );
}
