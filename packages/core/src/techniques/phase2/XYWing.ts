import type { Cell, Grid } from '../../types/Grid.js';
import type { HintAccumulator } from '../../types/Hint.js';
import type { HintProducer } from '../../types/HintProducer.js';
import type { Technique } from '../../types/Technique.js';
import { TECHNIQUE_DIFFICULTY } from '../../types/Technique.js';
import { CELL_COUNT } from '../../models/board.js';
import { candidateCount, candidateList, hasCandidate } from '../../candidates/bitmask.js';

function cellName(row: number, col: number): string {
  return `R${row + 1}C${col + 1}`;
}

/**
 * XY-Wing and XYZ-Wing — line-by-line port of SE's `XYWing.java`.
 *
 * A pivot cell sees two "pincer" cells. Between them the three cells hold
 * exactly three digits, arranged so that whichever value the pivot takes, one
 * pincer or the other must be `z` — so `z` can be eliminated from any cell
 * that sees both pincers.
 *
 * - **XY-Wing** (4.2): the pivot has 2 candidates and shares none with both
 *   pincers at once.
 * - **XYZ-Wing** (4.4): the pivot has 3 candidates and shares `z` too, so
 *   victims must see all three cells rather than just the pincers.
 *
 * SE ref: diuf/sudoku/solver/rules/XYWing.java
 */
export class XYWing implements HintProducer {
  readonly technique: Technique;
  readonly difficulty: number;
  private readonly isXYZ: boolean;

  constructor(isXYZ: boolean) {
    this.isXYZ = isXYZ;
    this.technique = isXYZ ? 'XYZWing' : 'XYWing';
    this.difficulty = TECHNIQUE_DIFFICULTY[this.technique];
  }

  getHints(grid: Grid, accumulator: HintAccumulator): void {
    // SE: targetCardinality = isXYZ ? 3 : 2
    const targetCardinality = this.isXYZ ? 3 : 2;

    for (let index = 0; index < CELL_COUNT; index++) {
      // Safe: index is a valid cell index
      const xyCell = grid.cells[index]!;
      if (xyCell.value !== null) continue;
      if (xyCell.candidateCount !== targetCardinality) continue;

      const peers = grid.getPeers(xyCell.index).filter((c) => c.value === null);

      for (const xzCell of peers) {
        if (xzCell.candidateCount !== 2) continue;

        // SE's "small test": xy minus xz must leave exactly one digit.
        const remValues = xyCell.candidates & ~xzCell.candidates;
        if (candidateCount(remValues) !== 1) continue;

        for (const yzCell of peers) {
          if (yzCell.index === xzCell.index) continue;
          if (yzCell.candidateCount !== 2) continue;

          if (!this.isWing(xyCell, xzCell, yzCell)) continue;
          if (this.emit(grid, xyCell, xzCell, yzCell, accumulator)) return;
        }
      }
    }
  }

  /**
   * SE's `isXYWing` / `isXYZWing`. Both require the three cells to span
   * exactly three digits; they differ in how much the pivot shares.
   */
  private isWing(xy: Cell, xz: Cell, yz: Cell): boolean {
    const expectedPivot = this.isXYZ ? 3 : 2;
    if (xy.candidateCount !== expectedPivot) return false;
    if (xz.candidateCount !== 2 || yz.candidateCount !== 2) return false;

    const union = xy.candidates | xz.candidates | yz.candidates;
    const intersection = xy.candidates & xz.candidates & yz.candidates;

    // XY-Wing: pivot shares nothing with both pincers. XYZ-Wing: it shares z.
    return candidateCount(union) === 3 && candidateCount(intersection) === (this.isXYZ ? 1 : 0);
  }

  /**
   * Port of `createHint` plus SE's `isWorth()`.
   *
   * @returns true if the accumulator signalled 'stop'
   */
  private emit(
    grid: Grid,
    xyCell: Cell,
    xzCell: Cell,
    yzCell: Cell,
    accumulator: HintAccumulator,
  ): boolean {
    // z is the digit the two pincers share.
    const shared = xzCell.candidates & yzCell.candidates;
    const zValue = candidateList(shared)[0];
    if (zValue === undefined) return false;

    // SE: victims see both pincers — and the pivot too, for XYZ.
    const xzPeers = new Set(grid.getPeers(xzCell.index).map((c) => c.index));
    const yzPeers = new Set(grid.getPeers(yzCell.index).map((c) => c.index));
    const xyPeers = new Set(grid.getPeers(xyCell.index).map((c) => c.index));
    const pattern = new Set([xyCell.index, xzCell.index, yzCell.index]);

    const eliminations: { cell: number; digit: number }[] = [];
    for (let index = 0; index < CELL_COUNT; index++) {
      if (pattern.has(index)) continue;
      if (!xzPeers.has(index) || !yzPeers.has(index)) continue;
      if (this.isXYZ && !xyPeers.has(index)) continue;

      // Safe: index is a valid cell index
      const cell = grid.cells[index]!;
      if (cell.value !== null) continue;
      if (hasCandidate(cell.candidates, zValue)) {
        eliminations.push({ cell: index, digit: zValue });
      }
    }

    if (eliminations.length === 0) return false;

    const involvedCandidates = new Map<number, readonly number[]>([
      [xyCell.index, candidateList(xyCell.candidates)],
      [xzCell.index, candidateList(xzCell.candidates)],
      [yzCell.index, candidateList(yzCell.candidates)],
    ]);

    const label = this.isXYZ ? 'XYZ-Wing' : 'XY-Wing';
    const result = accumulator({
      type: 'elimination',
      technique: this.technique,
      difficulty: this.difficulty,
      eliminations,
      explanation:
        `${label}: ${cellName(xyCell.row, xyCell.col)} pivots between ` +
        `${cellName(xzCell.row, xzCell.col)} and ${cellName(yzCell.row, yzCell.col)}. ` +
        `Whichever value the pivot takes, one of them must be ${zValue}, ` +
        `so ${zValue} can be removed from any cell seeing both`,
      involvedCells: [xyCell.index, xzCell.index, yzCell.index],
      involvedCandidates,
    });

    return result === 'stop';
  }
}
