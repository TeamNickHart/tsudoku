import { SIZE } from '@tsudoku/core';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface NumberPadProps {
  readonly counts: Readonly<Record<number, number>>;
  readonly onDigit: (digit: number) => void;
  readonly onErase: () => void;
  readonly disabled: boolean;
}

/**
 * Digit entry.
 *
 * A digit with all nine placed is dimmed — the "all of these are solved"
 * signal, which saves scanning the board to work it out.
 */
export function NumberPad({ counts, onDigit, onErase, disabled }: NumberPadProps): JSX.Element {
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {Array.from({ length: SIZE }, (_, i) => i + 1).map((digit) => {
        const complete = (counts[digit] ?? 0) >= SIZE;
        return (
          <Button
            key={digit}
            variant="outline"
            onClick={() => onDigit(digit)}
            disabled={disabled}
            className={cn(
              'h-12 text-lg tabular-nums sm:h-14',
              complete && 'text-muted-foreground/40',
            )}
            aria-label={`Enter ${digit}${complete ? ' (all placed)' : ''}`}
          >
            {digit}
          </Button>
        );
      })}
      <Button
        variant="outline"
        onClick={onErase}
        disabled={disabled}
        className="h-12 sm:h-14"
        aria-label="Erase"
      >
        ⌫
      </Button>
    </div>
  );
}
