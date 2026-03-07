# Benchmark Corpus

JSONL files containing puzzles with known SudokuExplainer ratings.

## Format

Each line is a JSON object:

```json
{ "puzzle": "530070000...", "se_rating": 2.3, "se_technique": "NakedSingle" }
```

## Files

- `phase1.jsonl` — puzzles rated SE 1.0-2.5 (direct techniques)
- `phase2.jsonl` — puzzles rated SE 2.6-4.4 (candidate techniques)
- `phase3.jsonl` — puzzles rated SE 4.5-6.0 (uniqueness techniques)
- `phase4.jsonl` — puzzles rated SE 6.2+ (chain techniques)

## Generating Corpus

Use the SE reference to rate puzzles:

```bash
java -cp SudokuExplainer.jar diuf.sudoku.test.serate \
  --input=puzzles.txt --output=rated.txt --format="%g ED=%r/%p/%d"
```
