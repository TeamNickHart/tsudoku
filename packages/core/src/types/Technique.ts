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

// HiddenSingle uses different ratings depending on region type
export const HIDDEN_SINGLE_BOX_DIFFICULTY = 1.2;
export const HIDDEN_SINGLE_LINE_DIFFICULTY = 1.5;

// NakedSingle "last value" (all peers solved) uses 1.0
export const NAKED_SINGLE_LAST_VALUE_DIFFICULTY = 1.0;
export const NAKED_SINGLE_GENERAL_DIFFICULTY = 2.3;
