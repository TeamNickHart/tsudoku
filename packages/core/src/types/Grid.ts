export type RegionType = 'row' | 'col' | 'box';

export interface Cell {
  readonly index: number;
  readonly row: number;
  readonly col: number;
  readonly box: number;
  readonly value: number | null;
  readonly candidates: number;
  readonly isGiven: boolean;
  readonly candidateList: readonly number[];
  readonly candidateCount: number;
}

export interface Region {
  readonly type: RegionType;
  readonly index: number;
  readonly cells: readonly Cell[];
  getCandidateCells(digit: number): readonly Cell[];
  getUnsolvedCells(): readonly Cell[];
}

export interface Grid {
  readonly cells: readonly Cell[];
  readonly regions: readonly Region[];
  getRow(r: number): Region;
  getCol(c: number): Region;
  getBox(b: number): Region;
  getCell(row: number, col: number): Cell;
  getCellByIndex(index: number): Cell;
  getPeers(cellIndex: number): readonly Cell[];
}
