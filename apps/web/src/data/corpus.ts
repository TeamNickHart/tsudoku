// GENERATED — do not edit by hand.
// Regenerate: node apps/web/scripts/build-corpus-slice.mjs
//
// A technique-balanced slice of benchmarks/corpus/phase1.jsonl. Every puzzle
// here is SE-verified, so the rating and hardest-technique labels are ground
// truth, not estimates.

export interface CorpusPuzzle {
  /** 81 chars, digits and '0' for blanks. */
  readonly puzzle: string;
  /** SudokuExplainer difficulty rating. */
  readonly rating: number;
  /** The hardest technique SE needed to solve it. */
  readonly technique: string;
}

export const PUZZLES: readonly CorpusPuzzle[] = [
  {
    puzzle: '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
    rating: 1.2,
    technique: 'HiddenSingle',
  },
  {
    puzzle: '003020600900305001001806400008102900700000008006708200002609500800203009005010300',
    rating: 1.2,
    technique: 'HiddenSingle',
  },
  {
    puzzle: '200080300060070084030500209000105408000000000402706000301007040720040060004010003',
    rating: 1.2,
    technique: 'HiddenSingle',
  },
  {
    puzzle: '000260701680070090190004500820100040004602900050003028009300074040050036703018000',
    rating: 1.2,
    technique: 'HiddenSingle',
  },
  {
    puzzle: '906530174310804050700000003020907061400000009190208030600000002050406097279015608',
    rating: 1.2,
    technique: 'HiddenSingle',
  },
  {
    puzzle: '000000790209300500870900030000010650000406000057030000090004061005001409021000000',
    rating: 1.2,
    technique: 'HiddenSingle',
  },
  {
    puzzle: '000090000040501070070824010008107200060000030209000704700958001000000000301000609',
    rating: 1.7,
    technique: 'DirectPointing',
  },
  {
    puzzle: '410000035086503270000000000000309000005467100000201000209000307030602090060000080',
    rating: 1.7,
    technique: 'DirectPointing',
  },
  {
    puzzle: '006500900540000026030000504000070600908000107001060000607000090490000012005009400',
    rating: 1.7,
    technique: 'DirectPointing',
  },
  {
    puzzle: '006052000000000000930006008005093407009405200403260800300600021000000000000540300',
    rating: 1.7,
    technique: 'DirectPointing',
  },
  {
    puzzle: '020936070600000009009080400007000500080000010041795860400802001010060050000010000',
    rating: 1.7,
    technique: 'DirectPointing',
  },
  {
    puzzle: '002400057005080006070000003010560000060804010000021070300000080700010400920003500',
    rating: 1.7,
    technique: 'DirectPointing',
  },
  {
    puzzle: '000000000904607000076804100309701080008000300050308702007502610000403208000000000',
    rating: 2,
    technique: 'DirectHiddenPair',
  },
  {
    puzzle: '000000907000420180000705026100904000050000040000507009920108000034059000507000000',
    rating: 2,
    technique: 'DirectHiddenPair',
  },
  {
    puzzle: '850002400720000009004000000000107002305000900040000000000080070017000000000036040',
    rating: 2,
    technique: 'DirectHiddenPair',
  },
  {
    puzzle: '860090007001000002007008690009405000100000006000209300056100700200000400700080015',
    rating: 2,
    technique: 'DirectHiddenPair',
  },
  {
    puzzle: '070040200009500004100020070000201040705000806040705000060050001200009400008010030',
    rating: 2,
    technique: 'DirectHiddenPair',
  },
  {
    puzzle: '000010400000403500610000807050200000001050300000008040807000019009307000002060000',
    rating: 2,
    technique: 'DirectHiddenPair',
  },
  {
    puzzle: '400001503000003200300090740000008370200000005083600000057030001002700000804900007',
    rating: 2.3,
    technique: 'NakedSingle',
  },
  {
    puzzle: '020907010700000005010605040000578000407090108000000000208000301000301000031000560',
    rating: 2.3,
    technique: 'NakedSingle',
  },
  {
    puzzle: '080032000007001003000890020940000500602040807005000034070014000400200300000960040',
    rating: 2.3,
    technique: 'NakedSingle',
  },
  {
    puzzle: '010000950050401800002030000100000570000706000024000009000060400007208090091000020',
    rating: 2.3,
    technique: 'NakedSingle',
  },
  {
    puzzle: '400000007020010030005906800019000620004000300060308010000201000080504070000000000',
    rating: 2.3,
    technique: 'NakedSingle',
  },
  {
    puzzle: '100070005300090004000302000003000400010436050600809007807000906000901000000040000',
    rating: 2.3,
    technique: 'NakedSingle',
  },
  {
    puzzle: '090052000602030008003089020031000000500000009000000260070910600800020307000740090',
    rating: 2.5,
    technique: 'DirectHiddenTriplet',
  },
  {
    puzzle: '000090610906000000004025009603002000700903001000500903100750300000000108035080000',
    rating: 2.5,
    technique: 'DirectHiddenTriplet',
  },
  {
    puzzle: '060905020000307000090080060987000543000000000032050670000126000050804090004000800',
    rating: 2.5,
    technique: 'DirectHiddenTriplet',
  },
  {
    puzzle: '050000020003906100800000007060509080200104009000708000900405001007000200500070003',
    rating: 2.5,
    technique: 'DirectHiddenTriplet',
  },
  {
    puzzle: '059020001002806500800000000008004002000050000400300700000000007006109400100070830',
    rating: 2.5,
    technique: 'DirectHiddenTriplet',
  },
  {
    puzzle: '005040030070589000001000000530860070600070008080015069000000400000158090060020800',
    rating: 2.5,
    technique: 'DirectHiddenTriplet',
  },
];

/** Puzzles grouped by the technique they teach, easiest first. */
export const BY_TECHNIQUE: ReadonlyMap<string, readonly CorpusPuzzle[]> = new Map(
  PUZZLES.reduce<[string, CorpusPuzzle[]][]>((acc, p) => {
    const found = acc.find(([t]) => t === p.technique);
    if (found) found[1].push(p);
    else acc.push([p.technique, [p]]);
    return acc;
  }, []),
);
