export type Technique =
  | 'NakedSingle'
  | 'HiddenSingle'
  | 'DirectPointing'
  | 'DirectClaiming'
  | 'DirectHiddenPair'
  | 'DirectHiddenTriplet';

export const TECHNIQUE_DIFFICULTY: Readonly<Record<Technique, number>> = {
  NakedSingle: 2.3,
  HiddenSingle: 1.5,
  DirectPointing: 1.7,
  DirectClaiming: 1.9,
  DirectHiddenPair: 2.0,
  DirectHiddenTriplet: 2.5,
};

// HiddenSingle uses different ratings depending on context:
// - 1.0: "alone" — last empty cell in a region (SE calls this isAlone)
// - 1.2: true hidden single in a box (block)
// - 1.5: true hidden single in a row or column (line)
export const HIDDEN_SINGLE_ALONE_DIFFICULTY = 1.0;
export const HIDDEN_SINGLE_BOX_DIFFICULTY = 1.2;
export const HIDDEN_SINGLE_LINE_DIFFICULTY = 1.5;

// NakedSingle is always 2.3 in SE (no sub-ratings)
export const NAKED_SINGLE_DIFFICULTY = 2.3;
