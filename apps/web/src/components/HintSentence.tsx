import type { DecorationRole, HintSegment } from '@tsudoku/game';
import { cn } from '@/lib/utils';

/**
 * A hint's reasoning, with each reference drawn as a chip in the same colour
 * and shape as the cells it points at on the board.
 */

const CHIP_STYLES: Partial<Record<DecorationRole, string>> = {
  primary: 'ring-2 ring-board-primary bg-board-primary/15',
  supporting: 'ring-2 ring-board-supporting bg-board-supporting/15',
  pivot: 'ring-2 ring-board-pivot bg-board-pivot/10',
  eliminated: 'outline-dashed outline-2 outline-board-eliminated bg-board-eliminated/10',
  house: 'bg-board-house',
};

export function HintSentence({
  segments,
}: {
  readonly segments: readonly HintSegment[];
}): JSX.Element {
  return (
    <p className="leading-relaxed text-foreground">
      {segments.map((segment, i) =>
        segment.kind === 'text' ? (
          <span key={i}>{segment.text}</span>
        ) : (
          <span
            key={i}
            className={cn('mx-0.5 rounded px-1 py-px font-medium', CHIP_STYLES[segment.role] ?? '')}
          >
            {segment.text}
          </span>
        ),
      )}
    </p>
  );
}
