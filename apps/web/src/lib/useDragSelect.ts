import { useCallback, useEffect, useRef } from 'react';

/**
 * Tap / drag gesture recognition for board cells.
 *
 * The hook only tells taps from drags and reports which cells a drag covered.
 * What a tap or a drag *means* — toggle a cell, switch to note mode, focus a
 * digit — is the host's call.
 *
 * The rules, which are the bit worth getting right:
 *
 * - **A press is a tap until proven otherwise.** It becomes a drag only once
 *   the pointer has travelled a real distance from where it went down *and*
 *   is over a different cell. A sloppy tap that wobbles across a cell border
 *   stays a tap, so it cannot wipe out a selection the player built up.
 * - **Nothing changes until the drag is certain.** `onDragStart` and the first
 *   `onPaint` fire together at the moment the threshold is crossed, never at
 *   pointer-down.
 * - **A drag always starts a new run, and the run includes the cell it started
 *   on.** Cells the pointer crossed before the threshold was met, or skipped
 *   between two pointermove samples on a fast swipe, are filled in by walking
 *   the path between samples.
 *
 * Uses Pointer Events so mouse, touch and stylus take the same path. A touch
 * drag gets *implicit pointer capture*, so `pointerenter` never fires on the
 * cells a finger passes over; tracking `pointermove` on the window with
 * `document.elementFromPoint` behaves the same for every pointer type.
 */

/** The cell index under a point, or null when the point is off the grid. */
function cellAtPoint(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y);
  const cell = el?.closest<HTMLElement>('[data-cell-index]');
  if (!cell) return null;
  const raw = cell.dataset.cellIndex;
  return raw === undefined ? null : Number(raw);
}

/**
 * How far a press must travel before it can become a drag, as a fraction of
 * the cell's width. Large enough to absorb a finger rolling as it lifts; small
 * enough that a deliberate drag into the next cell still registers before the
 * finger is halfway across it.
 */
const DRAG_THRESHOLD = 0.4;
/** Floor for the threshold in px, so tiny cells do not make it twitchy. */
const MIN_DRAG_PX = 8;
/** Path sampling step as a fraction of cell width — finer than a cell. */
const SAMPLE_STEP = 0.25;

interface DragSelectOptions {
  /** A press that never became a drag. */
  readonly onTap: (cell: number) => void;
  /**
   * The press just became a drag. Fires once, immediately before the first
   * `onPaint`, so the host can switch mode in the same update.
   */
  readonly onDragStart: () => void;
  /** Every cell this drag has covered so far, start cell first. */
  readonly onPaint: (cells: readonly number[]) => void;
}

interface DragSelectResult {
  /** Spread onto each cell element. */
  readonly cellProps: (index: number) => {
    onPointerDown: (e: React.PointerEvent) => void;
  };
}

interface Gesture {
  readonly pointerId: number;
  readonly startCell: number;
  readonly startX: number;
  readonly startY: number;
  readonly cellSize: number;
  lastX: number;
  lastY: number;
  isDrag: boolean;
  readonly painted: Set<number>;
}

export function useDragSelect(options: DragSelectOptions): DragSelectResult {
  // The window listeners outlive the render that attached them, so they read
  // the host's callbacks through a ref. Closing over the callbacks directly
  // was a real bug: a drag that began in value mode switched to note mode, but
  // the listeners kept calling the value-mode handlers from pointer-down, so
  // the run collapsed to one cell and the rest of a touch drag was dropped.
  const latest = useRef(options);
  latest.current = options;

  const gesture = useRef<Gesture | null>(null);
  const detach = useRef<(() => void) | null>(null);

  /** Add every cell on the straight path between two points. */
  const paintPath = useCallback((g: Gesture, x0: number, y0: number, x1: number, y1: number) => {
    const step = Math.max(1, g.cellSize * SAMPLE_STEP);
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    let changed = false;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const cell = cellAtPoint(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      if (cell !== null && !g.painted.has(cell)) {
        g.painted.add(cell);
        changed = true;
      }
    }
    return changed;
  }, []);

  const onMove = useCallback(
    (e: PointerEvent) => {
      const g = gesture.current;
      if (g === null || e.pointerId !== g.pointerId) return;
      const { clientX: x, clientY: y } = e;

      if (!g.isDrag) {
        const travelled = Math.hypot(x - g.startX, y - g.startY);
        const threshold = Math.max(MIN_DRAG_PX, g.cellSize * DRAG_THRESHOLD);
        if (travelled < threshold) return;
        const here = cellAtPoint(x, y);
        if (here === null || here === g.startCell) return;

        // Certain now. Walk from where the press began so nothing between
        // the start cell and here is lost.
        g.isDrag = true;
        paintPath(g, g.startX, g.startY, x, y);
        g.lastX = x;
        g.lastY = y;
        latest.current.onDragStart();
        latest.current.onPaint([...g.painted]);
        return;
      }

      const changed = paintPath(g, g.lastX, g.lastY, x, y);
      g.lastX = x;
      g.lastY = y;
      if (changed) latest.current.onPaint([...g.painted]);
    },
    [paintPath],
  );

  const end = useCallback((e: PointerEvent) => {
    const g = gesture.current;
    if (g === null || e.pointerId !== g.pointerId) return;
    detach.current?.();
    gesture.current = null;
    // A cancelled press (the browser took the gesture over) is neither a tap
    // nor a drag; doing nothing is the only safe reading.
    if (e.type === 'pointerup' && !g.isDrag) latest.current.onTap(g.startCell);
  }, []);

  // Clean up if the component unmounts mid-gesture.
  useEffect(() => () => detach.current?.(), []);

  const onPointerDown = useCallback(
    (index: number, e: React.PointerEvent) => {
      // One gesture at a time: ignore a second finger and non-primary buttons.
      if (!e.isPrimary || e.button !== 0) return;
      // A leftover gesture means its pointerup was lost (a mouse released
      // outside the window). Drop it rather than let it block every press.
      detach.current?.();
      // Let pointermove reach whatever is under the finger, and stop touch
      // drags from scrolling the page.
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      e.preventDefault();

      gesture.current = {
        pointerId: e.pointerId,
        startCell: index,
        startX: e.clientX,
        startY: e.clientY,
        cellSize: e.currentTarget.getBoundingClientRect().width,
        lastX: e.clientX,
        lastY: e.clientY,
        isDrag: false,
        painted: new Set([index]),
      };

      // Attached synchronously, not in an effect keyed on state: an effect
      // runs only after React commits, so the opening moves of a fast drag
      // would land before the listener existed and be silently dropped.
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      detach.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        detach.current = null;
      };
    },
    [onMove, end],
  );

  const cellProps = useCallback(
    (index: number) => ({
      onPointerDown: (e: React.PointerEvent) => onPointerDown(index, e),
    }),
    [onPointerDown],
  );

  return { cellProps };
}
