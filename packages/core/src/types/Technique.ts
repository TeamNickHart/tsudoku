export type Technique =
  | 'NakedSingle'
  | 'HiddenSingle'
  | 'DirectPointing'
  | 'DirectClaiming'
  | 'DirectHiddenPair'
  | 'DirectHiddenTriplet'
  // Phase 2 — candidate techniques (SE 2.6–4.4)
  | 'Pointing'
  | 'Claiming'
  | 'NakedPair'
  | 'NakedTriplet'
  | 'NakedQuad'
  | 'HiddenPair'
  | 'HiddenTriplet'
  | 'HiddenQuad'
  | 'XWing'
  | 'Swordfish'
  | 'Jellyfish'
  | 'XYWing'
  | 'XYZWing';

export const TECHNIQUE_DIFFICULTY: Readonly<Record<Technique, number>> = {
  NakedSingle: 2.3,
  HiddenSingle: 1.5,
  DirectPointing: 1.7,
  DirectClaiming: 1.9,
  DirectHiddenPair: 2.0,
  DirectHiddenTriplet: 2.5,
  Pointing: 2.6,
  Claiming: 2.8,
  NakedPair: 3.0,
  XWing: 3.2,
  HiddenPair: 3.4,
  NakedTriplet: 3.6,
  Swordfish: 3.8,
  HiddenTriplet: 4.0,
  XYWing: 4.2,
  XYZWing: 4.4,
  // Rated Phase 3 by SE but implemented here: the code is identical to the
  // smaller sizes, so splitting them across phases would be artificial.
  NakedQuad: 5.0,
  Jellyfish: 5.2,
  HiddenQuad: 5.4,
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
