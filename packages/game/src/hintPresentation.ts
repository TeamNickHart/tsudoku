import { CELL_COUNT, boxOf, colOf, rowOf } from '@tsudoku/core';
import type { DirectHint, EliminationHint, Grid, Hint, Technique } from '@tsudoku/core';
import type { Decoration, DecorationRole } from './types.js';

/**
 * Turn a hint into something the board can show: coloured groups on the board,
 * and a sentence whose phrases point at those groups.
 *
 * The engine's own explanation names cells by coordinate ("remove 4 from R8C3").
 * That is precise but makes the player translate every reference back onto the
 * board. Here the reasoning is told in words, and each "these two cells" is a
 * reference the UI draws in the same colour as the cells it means:
 *
 * - `primary` (green) — the cell a placement goes in, and its digit
 * - `supporting` (yellow) — the pattern the argument rests on
 * - `eliminated` (orange) — the candidates it rules out
 * - `pivot` — the hinge of a wing
 * - `house` (tint) — the row, column or box where the reasoning happens
 *
 * The roles are the same ones tutor lessons use, so a hint and a lesson look
 * alike. Every group is derived from the hint plus the grid it was found on —
 * the player's grid, eliminations included (see `toPlayerGrid`) — so nothing
 * is authored per puzzle.
 */

/** A run of a hint's sentence: plain text, or a phrase pointing at a group. */
export type HintSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'ref'; readonly role: DecorationRole; readonly text: string };

export interface HintPresentation {
  /** The technique's name as a player would say it: "X-Wing", not "XWing". */
  readonly title: string;
  /** Everything the board should show for this hint. */
  readonly decorations: readonly Decoration[];
  /** The reasoning, as text with references to the decorated groups. */
  readonly sentence: readonly HintSegment[];
}

const TECHNIQUE_NAMES: Readonly<Record<Technique, string>> = {
  NakedSingle: 'Naked Single',
  HiddenSingle: 'Hidden Single',
  DirectPointing: 'Pointing',
  DirectClaiming: 'Claiming',
  DirectHiddenPair: 'Hidden Pair',
  DirectHiddenTriplet: 'Hidden Triple',
  Pointing: 'Pointing',
  Claiming: 'Claiming',
  NakedPair: 'Naked Pair',
  NakedTriplet: 'Naked Triple',
  NakedQuad: 'Naked Quad',
  HiddenPair: 'Hidden Pair',
  HiddenTriplet: 'Hidden Triple',
  HiddenQuad: 'Hidden Quad',
  XWing: 'X-Wing',
  Swordfish: 'Swordfish',
  Jellyfish: 'Jellyfish',
  XYWing: 'XY-Wing',
  XYZWing: 'XYZ-Wing',
};

type HouseKind = 'row' | 'col' | 'box';
interface House {
  readonly kind: HouseKind;
  readonly index: number;
}

const HOUSE_ORDER: readonly HouseKind[] = ['box', 'row', 'col'];

function houseOf(cell: number, kind: HouseKind): House {
  const index =
    kind === 'row' ? rowOf(cell) : kind === 'col' ? colOf(cell) : boxOf(rowOf(cell), colOf(cell));
  return { kind, index };
}

function houseCells(house: House): readonly number[] {
  const cells: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (houseOf(i, house.kind).index === house.index) cells.push(i);
  }
  return cells;
}

/** Houses every one of `cells` lies in, box first. */
function commonHouses(cells: readonly number[]): readonly House[] {
  const first = cells[0];
  if (first === undefined) return [];
  return HOUSE_ORDER.map((kind) => houseOf(first, kind)).filter((h) =>
    cells.every((c) => houseOf(c, h.kind).index === h.index),
  );
}

function houseName(house: House): string {
  return `${house.kind === 'col' ? 'column' : house.kind} ${house.index + 1}`;
}

/** "rows 3 and 5", "columns 4, 8 and 9". */
function linesName(kind: 'row' | 'col', indexes: readonly number[]): string {
  const word = kind === 'row' ? 'rows' : 'columns';
  return `${word} ${listOf(indexes.map((i) => String(i + 1)))}`;
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** "this cell", "these two cells", "these 12 cells". */
function cellsPhrase(count: number, noun = 'cell'): string {
  if (count === 1) return `this ${noun}`;
  return `these ${NUMBER_WORDS[count] ?? String(count)} ${noun}s`;
}

/** "3", "3 and 5", "1, 3 and 4". */
function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}

function candidatesOf(grid: Grid, cell: number): readonly number[] {
  return grid.getCellByIndex(cell).candidateList;
}

/** Cells of `house` where `digit` is still a candidate. */
function placesFor(grid: Grid, house: House, digit: number): readonly number[] {
  return houseCells(house).filter((c) => candidatesOf(grid, c).includes(digit));
}

/** Builds the decoration list without duplicates. */
class Board {
  private readonly items: Decoration[] = [];
  private readonly seen = new Set<string>();

  private add(decoration: Decoration, key: string): void {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.items.push(decoration);
  }

  cell(cell: number, role: DecorationRole): void {
    this.add({ target: { kind: 'cell', cell }, role }, `c${cell}${role}`);
  }

  note(cell: number, digit: number, role: DecorationRole): void {
    this.add({ target: { kind: 'note', cell, digit }, role }, `n${cell}.${digit}${role}`);
  }

  house(house: House): void {
    for (const cell of houseCells(house)) this.cell(cell, 'house');
  }

  /** The pattern: each cell and the candidates it contributes. */
  pattern(candidates: ReadonlyMap<number, readonly number[]>, role: DecorationRole): void {
    for (const [cell, digits] of candidates) {
      this.cell(cell, role);
      for (const digit of digits) this.note(cell, digit, role);
    }
  }

  eliminations(hint: EliminationHint): void {
    for (const { cell, digit } of hint.eliminations) this.note(cell, digit, 'eliminated');
  }

  placement(hint: DirectHint): void {
    this.cell(hint.cell, 'primary');
    this.note(hint.cell, hint.digit, 'primary');
  }

  get decorations(): readonly Decoration[] {
    return this.items;
  }
}

const text = (t: string): HintSegment => ({ kind: 'text', text: t });
const ref = (role: DecorationRole, t: string): HintSegment => ({ kind: 'ref', role, text: t });

/** Every digit the pattern contributes, ascending. */
function patternDigits(hint: Hint): readonly number[] {
  return [...new Set([...hint.involvedCandidates.values()].flat())].sort((a, b) => a - b);
}

/** Pattern cells, from the hint's candidates (its involvedCells may add the target). */
function patternCells(hint: Hint): readonly number[] {
  return [...hint.involvedCandidates.keys()];
}

function eliminatedCells(hint: EliminationHint): readonly number[] {
  return [...new Set(hint.eliminations.map((e) => e.cell))];
}

/** The house where `cell` is the only place left for `digit`, once `gone` are discounted. */
function singleHouse(
  grid: Grid,
  cell: number,
  digit: number,
  gone: readonly number[] = [],
): House | null {
  for (const kind of HOUSE_ORDER) {
    const house = houseOf(cell, kind);
    const places = placesFor(grid, house, digit).filter((c) => !gone.includes(c));
    if (places.length === 1 && places[0] === cell) return house;
  }
  return null;
}

/**
 * Present a hint. Techniques without a dedicated presentation fall back to the
 * engine's own sentence and generic groups, so a newly ported technique still
 * shows something sensible.
 */
export function presentHint(hint: Hint, grid: Grid): HintPresentation {
  const { decorations, sentence } = presentSpecific(hint, grid) ?? presentGeneric(hint);
  return { title: TECHNIQUE_NAMES[hint.technique], decorations, sentence };
}

type Presented = Omit<HintPresentation, 'title'>;

function presentGeneric(hint: Hint): Presented {
  const board = new Board();
  board.pattern(hint.involvedCandidates, 'supporting');
  if (hint.type === 'direct') board.placement(hint);
  else board.eliminations(hint);
  return { decorations: board.decorations, sentence: [text(hint.explanation)] };
}

function presentSpecific(hint: Hint, grid: Grid): Presented | null {
  switch (hint.technique) {
    case 'HiddenSingle':
      return hint.type === 'direct' ? hiddenSingle(hint, grid) : null;
    case 'NakedSingle':
      return hint.type === 'direct' ? nakedSingle(hint) : null;
    case 'DirectPointing':
    case 'DirectClaiming':
      return hint.type === 'direct' ? directLocking(hint, grid) : null;
    case 'DirectHiddenPair':
    case 'DirectHiddenTriplet':
      return hint.type === 'direct' ? directHiddenSet(hint, grid) : null;
    case 'Pointing':
    case 'Claiming':
      return hint.type === 'elimination' ? locking(hint) : null;
    case 'NakedPair':
    case 'NakedTriplet':
    case 'NakedQuad':
      return hint.type === 'elimination' ? nakedSet(hint) : null;
    case 'HiddenPair':
    case 'HiddenTriplet':
    case 'HiddenQuad':
      return hint.type === 'elimination' ? hiddenSet(hint, grid) : null;
    case 'XWing':
    case 'Swordfish':
    case 'Jellyfish':
      return hint.type === 'elimination' ? fish(hint) : null;
    case 'XYWing':
    case 'XYZWing':
      return hint.type === 'elimination' ? wing(hint) : null;
  }
}

function hiddenSingle(hint: DirectHint, grid: Grid): Presented | null {
  const house = singleHouse(grid, hint.cell, hint.digit);
  if (house === null) return null;
  const board = new Board();
  board.house(house);
  board.placement(hint);
  const others = houseCells(house).filter((c) => c !== hint.cell);
  const fullHouse = others.every((c) => grid.getCellByIndex(c).value !== null);
  return {
    decorations: board.decorations,
    sentence: fullHouse
      ? [
          ref('primary', 'This cell'),
          text(' is the last empty cell in '),
          ref('house', houseName(house)),
          text(`, so it must be ${hint.digit}.`),
        ]
      : [
          ref('primary', 'This cell'),
          text(` is the only place left for ${hint.digit} in `),
          ref('house', houseName(house)),
          text('.'),
        ],
  };
}

function nakedSingle(hint: DirectHint): Presented {
  const board = new Board();
  board.placement(hint);
  return {
    decorations: board.decorations,
    sentence: [ref('primary', 'This cell'), text(` has only one candidate left: ${hint.digit}.`)],
  };
}

/** Pointing and Claiming: a digit confined to where a box and a line overlap. */
/** "share column 3", "are both in box 2", "are all in box 2". */
function shareVerb(cover: House, count: number): string {
  if (cover.kind !== 'box') return 'share';
  return count === 2 ? 'are both in' : 'are all in';
}

function lockingGeometry(
  cells: readonly number[],
  pointing: boolean,
): { source: House; cover: House } | null {
  const shared = commonHouses(cells);
  const box = shared.find((h) => h.kind === 'box');
  const line = shared.find((h) => h.kind !== 'box');
  if (box === undefined || line === undefined) return null;
  return pointing ? { source: box, cover: line } : { source: line, cover: box };
}

function locking(hint: EliminationHint): Presented | null {
  const cells = patternCells(hint);
  const digit = patternDigits(hint)[0];
  const geometry = lockingGeometry(cells, hint.technique === 'Pointing');
  if (digit === undefined || geometry === null) return null;
  const { source, cover } = geometry;
  const board = new Board();
  board.house(source);
  board.pattern(hint.involvedCandidates, 'supporting');
  board.eliminations(hint);
  const shareWord = shareVerb(cover, cells.length);
  return {
    decorations: board.decorations,
    sentence: [
      text('In '),
      ref('house', houseName(source)),
      text(`, ${digit} can only go in `),
      ref('supporting', cellsPhrase(cells.length)),
      text(
        `, which ${shareWord} ${houseName(cover)}. Whichever it is, ${houseName(cover)} gets its ${digit} there, so ${digit} can't go in `,
      ),
      ref('eliminated', cellsPhrase(eliminatedCells(hint).length)),
      text('.'),
    ],
  };
}

function directLocking(hint: DirectHint, grid: Grid): Presented | null {
  const cells = patternCells(hint).filter((c) => c !== hint.cell);
  const geometry = lockingGeometry(cells, hint.technique === 'DirectPointing');
  if (geometry === null) return null;
  const { source, cover } = geometry;
  const sourceCells = houseCells(source);
  const gone = houseCells(cover).filter((c) => !sourceCells.includes(c));
  const single = singleHouse(grid, hint.cell, hint.digit, gone);
  if (single === null) return null;
  const board = new Board();
  board.house(source);
  for (const cell of cells) {
    board.cell(cell, 'supporting');
    board.note(cell, hint.digit, 'supporting');
  }
  board.placement(hint);
  const shareWord = shareVerb(cover, cells.length);
  return {
    decorations: board.decorations,
    sentence: [
      text('In '),
      ref('house', houseName(source)),
      text(`, ${hint.digit} can only go in `),
      ref('supporting', cellsPhrase(cells.length)),
      text(
        `, which ${shareWord} ${houseName(cover)} — so ${hint.digit} can't go anywhere else in ${houseName(cover)}. That leaves `,
      ),
      ref('primary', 'this cell'),
      text(` as the only place for ${hint.digit} in ${houseName(single)}.`),
    ],
  };
}

/** The house where every digit of a hidden set is confined to the pattern. */
function hiddenHouse(
  grid: Grid,
  cells: readonly number[],
  digits: readonly number[],
): House | null {
  return (
    commonHouses(cells).find((house) =>
      digits.every((d) => placesFor(grid, house, d).every((c) => cells.includes(c))),
    ) ?? null
  );
}

function directHiddenSet(hint: DirectHint, grid: Grid): Presented | null {
  const cells = patternCells(hint).filter((c) => c !== hint.cell);
  const digits = patternDigits(hint).filter((d) => d !== hint.digit);
  const house = hiddenHouse(grid, cells, digits);
  const single = singleHouse(grid, hint.cell, hint.digit, cells);
  if (house === null || single === null) return null;
  const board = new Board();
  board.house(house);
  board.pattern(hint.involvedCandidates, 'supporting');
  board.placement(hint);
  return {
    decorations: board.decorations,
    sentence: [
      text('In '),
      ref('house', houseName(house)),
      text(`, ${listOf(digits.map(String))} can only go in `),
      ref('supporting', cellsPhrase(cells.length)),
      text(`, so those cells are spoken for. That leaves `),
      ref('primary', 'this cell'),
      text(` as the only place for ${hint.digit} in ${houseName(single)}.`),
    ],
  };
}

function nakedSet(hint: EliminationHint): Presented | null {
  const cells = patternCells(hint);
  const targets = eliminatedCells(hint);
  const house = commonHouses(cells).find((h) =>
    targets.every((c) => houseOf(c, h.kind).index === h.index),
  );
  if (house === undefined) return null;
  const digits = listOf(patternDigits(hint).map(String));
  const board = new Board();
  board.house(house);
  board.pattern(hint.involvedCandidates, 'supporting');
  board.eliminations(hint);
  return {
    decorations: board.decorations,
    sentence: [
      text('Between them, '),
      ref('supporting', cellsPhrase(cells.length)),
      text(` in `),
      ref('house', houseName(house)),
      text(
        ` can only hold ${digits}, so those digits are taken there. No other cell in ${houseName(house)} can have them: remove them from `,
      ),
      ref('eliminated', cellsPhrase(targets.length)),
      text('.'),
    ],
  };
}

function hiddenSet(hint: EliminationHint, grid: Grid): Presented | null {
  const cells = patternCells(hint);
  const digits = patternDigits(hint);
  const house = hiddenHouse(grid, cells, digits);
  if (house === null) return null;
  const board = new Board();
  board.house(house);
  board.pattern(hint.involvedCandidates, 'supporting');
  board.eliminations(hint);
  return {
    decorations: board.decorations,
    sentence: [
      text('In '),
      ref('house', houseName(house)),
      text(`, ${listOf(digits.map(String))} can only go in `),
      ref('supporting', cellsPhrase(cells.length)),
      text(`, so those cells must hold them and nothing else: remove `),
      ref('eliminated', cellsPhrase(hint.eliminations.length, 'candidate')),
      text('.'),
    ],
  };
}

function fish(hint: EliminationHint): Presented | null {
  const cells = patternCells(hint);
  const digit = patternDigits(hint)[0];
  if (digit === undefined) return null;
  const rows = [...new Set(cells.map(rowOf))].sort((a, b) => a - b);
  const cols = [...new Set(cells.map(colOf))].sort((a, b) => a - b);
  // The base lines hold the pattern; eliminations lie along the cover lines.
  const baseIsRows = hint.eliminations.every(
    (e) => cols.includes(colOf(e.cell)) && !rows.includes(rowOf(e.cell)),
  );
  const [baseKind, baseLines, coverKind, coverLines] = baseIsRows
    ? (['row', rows, 'col', cols] as const)
    : (['col', cols, 'row', rows] as const);
  const board = new Board();
  for (const index of baseLines) board.house({ kind: baseKind, index });
  board.pattern(hint.involvedCandidates, 'supporting');
  board.eliminations(hint);
  const coverName = linesName(coverKind, coverLines);
  return {
    decorations: board.decorations,
    sentence: [
      text('In '),
      ref('house', linesName(baseKind, baseLines)),
      text(`, ${digit} can only go in `),
      ref('supporting', cellsPhrase(cells.length)),
      text(
        `, which line up in ${coverName}. Each of those lines gets its ${digit} from one of them, so ${digit} can't go anywhere else in ${coverName}: remove it from `,
      ),
      ref('eliminated', cellsPhrase(eliminatedCells(hint).length)),
      text('.'),
    ],
  };
}

function wing(hint: EliminationHint): Presented | null {
  const [pivot, ...pincers] = hint.involvedCells;
  const target = hint.eliminations[0]?.digit;
  if (pivot === undefined || pincers.length !== 2 || target === undefined) return null;
  const pivotDigits = hint.involvedCandidates.get(pivot) ?? [];
  const board = new Board();
  board.cell(pivot, 'pivot');
  for (const digit of pivotDigits) board.note(pivot, digit, 'pivot');
  for (const cell of pincers) {
    board.cell(cell, 'supporting');
    for (const digit of hint.involvedCandidates.get(cell) ?? []) {
      board.note(cell, digit, 'supporting');
    }
  }
  board.eliminations(hint);
  const xyz = hint.technique === 'XYZWing';
  const options = listOf(pivotDigits.map(String)).replace(/ and /, ' or ');
  return {
    decorations: board.decorations,
    sentence: [
      ref('pivot', 'This cell'),
      text(` must be ${options}, and `),
      ref('supporting', cellsPhrase(2)),
      text(
        xyz
          ? ` each pair ${target} with one of the others. Whichever the pivot is, ${target} is in one of the three, so ${target} can't go in `
          : ` each pair one of those with ${target}. Whichever the pivot is, one of them must be ${target}, so ${target} can't go in `,
      ),
      ref('eliminated', cellsPhrase(eliminatedCells(hint).length)),
      text(xyz ? ', which sees all three.' : ', which sees both.'),
    ],
  };
}
