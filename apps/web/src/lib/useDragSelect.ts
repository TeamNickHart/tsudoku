import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drag-to-paint / tap-to-toggle cell selection.
 *
 * The interaction, which is the bit worth getting right:
 *
 * - **Tap** toggles that one cell in or out of the selection. This is how you
 *   deselect a few cells after painting a line.
 * - **Drag starting on an unselected cell** replaces the selection and paints
 *   as you move — "draw a line across the board".
 * - **Drag starting on an already-selected cell** extends the selection
 *   instead of replacing it, so you can paint a second line without losing
 *   the first.
 *
 * A tap is a drag of zero distance, so the two cannot be told apart at
 * pointer-down. We resolve it at pointer-up: if the pointer never entered a
 * second cell, it was a tap.
 *
 * Uses Pointer Events so mouse, touch and stylus all take the same path.
 *
 * Touch needs different handling from mouse, and getting this wrong is a
 * silent failure on exactly the device people play on. A touch drag gets
 * *implicit pointer capture*: every `pointermove` is delivered to the element
 * where the finger went down, so `pointerenter` never fires on the cells the
 * finger passes over. So the drag is tracked with `pointermove` +
 * `document.elementFromPoint`, which behaves identically for mouse and touch,
 * and `pointerenter` is kept only as a belt-and-braces path for mouse.
 */

/** The cell index under a point, or null when the point is off the grid. */
function cellAtPoint(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y);
  const cell = el?.closest<HTMLElement>('[data-cell-index]');
  if (!cell) return null;
  const raw = cell.dataset.cellIndex;
  return raw === undefined ? null : Number(raw);
}

interface DragSelectOptions {
  /** Replace the entire selection. */
  readonly onReplace: (cells: readonly number[]) => void;
  /** Toggle one cell in or out. */
  readonly onToggle: (cell: number) => void;
  /** The current selection, needed to decide replace-vs-extend at drag start. */
  readonly selected: readonly number[];
  /**
   * When false, dragging does not paint — the gesture degrades to a plain tap
   * on the cell where the pointer went down. Used for value mode, where a
   * multi-selection has no meaning.
   */
  readonly multiSelect: boolean;
}

interface DragSelectResult {
  /** Spread onto each cell element. */
  readonly cellProps: (index: number) => {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerEnter: () => void;
  };
  /** True while a drag is in progress — useful for suppressing hover styling. */
  readonly isDragging: boolean;
}

export function useDragSelect({
  onReplace,
  onToggle,
  selected,
  multiSelect,
}: DragSelectOptions): DragSelectResult {
  const [isDragging, setIsDragging] = useState(false);

  // Refs rather than state: these change many times per drag and must not
  // trigger a re-render on every pointermove.
  const startCell = useRef<number | null>(null);
  const painted = useRef<Set<number>>(new Set());
  const movedToAnotherCell = useRef(false);

  const finish = useCallback(() => {
    const start = startCell.current;
    if (start === null) return;

    // A drag that never left its starting cell is a tap.
    if (!movedToAnotherCell.current) {
      onToggle(start);
    }

    startCell.current = null;
    painted.current = new Set();
    movedToAnotherCell.current = false;
    setIsDragging(false);
  }, [onToggle]);

  const paintCell = useCallback(
    (index: number) => {
      if (!multiSelect) return;
      if (startCell.current === null) return;
      if (painted.current.has(index)) return;

      movedToAnotherCell.current = true;
      painted.current.add(index);
      onReplace([...painted.current]);
    },
    [onReplace, multiSelect],
  );

  /**
   * Window listeners for the drag, attached synchronously at pointer-down.
   *
   * These deliberately do NOT live in an effect keyed on `isDragging`: an
   * effect runs only after React commits the state change, so the first few
   * pointermove events of a fast drag would land before the listener existed
   * and be silently dropped. Attaching here means no move is missed.
   */
  const detach = useRef<(() => void) | null>(null);

  const attachDragListeners = useCallback(() => {
    const onMove = (e: PointerEvent): void => {
      const index = cellAtPoint(e.clientX, e.clientY);
      if (index !== null) paintCell(index);
    };
    const onUp = (): void => {
      detach.current?.();
      finish();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    detach.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      detach.current = null;
    };
  }, [paintCell, finish]);

  // Clean up if the component unmounts mid-drag.
  useEffect(() => () => detach.current?.(), []);

  const onPointerDown = useCallback(
    (index: number, e: React.PointerEvent) => {
      // Let the browser keep sending events to this element mid-drag, and stop
      // touch drags from scrolling the page.
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      e.preventDefault();

      startCell.current = index;
      movedToAnotherCell.current = false;

      // Starting on a selected cell extends; starting elsewhere replaces.
      const extending = multiSelect && selected.includes(index);
      painted.current = new Set(extending ? selected : []);
      painted.current.add(index);

      attachDragListeners();
      setIsDragging(true);
    },
    [selected, attachDragListeners, multiSelect],
  );

  // Kept for mouse, where it fires naturally. Touch relies on the pointermove
  // handler above; paintCell dedupes so both firing is harmless.
  const onPointerEnter = useCallback(
    (index: number) => {
      paintCell(index);
    },
    [paintCell],
  );

  const cellProps = useCallback(
    (index: number) => ({
      onPointerDown: (e: React.PointerEvent) => onPointerDown(index, e),
      onPointerEnter: () => onPointerEnter(index),
    }),
    [onPointerDown, onPointerEnter],
  );

  return { cellProps, isDragging };
}
