# Contributing to TSudoku

Thank you for your interest in contributing to TSudoku!

## Getting Started

```bash
# Clone the repo
git clone https://github.com/tsudoku/tsudoku.git
cd tsudoku

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Run the full check suite:
   ```bash
   pnpm build && pnpm typecheck && pnpm lint && pnpm test
   ```
4. Create a changeset if your change affects published packages:
   ```bash
   pnpm changeset
   ```
5. Open a PR against `main`

## Commit Convention

Format: `type(scope): description`

**Types:** `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `bench`, `adr`, `ci`, `style`

**Scopes:** `core`, `cli`, `solver`, `generator`, `react-native`, `ml`, `docs`, `ci`, `benchmarks`

Examples:

- `feat(core): implement NakedSingle technique`
- `test(core): add SE parity tests for HiddenSingle`
- `adr: add ADR-0008 for chain implementation strategy`

## Adding a Technique

See [PORTING.md](./PORTING.md) for the full guide. In short:

1. Create `packages/core/src/techniques/phaseN/MyTechnique.ts` implementing `HintProducer`
2. Create `packages/core/tests/techniques/phaseN/MyTechnique.test.ts` with all required test cases
3. Register in `packages/core/src/solver/producers.ts` at the correct difficulty position
4. Add to `Technique` type union and `TECHNIQUE_DIFFICULTY` map
5. Run `pnpm benchmark --technique MyTechnique` and verify >= 99% agreement

## Code Standards

- **No `any`.** Use `unknown` with type guards.
- **No mutation.** Grid, Cell, and Region are immutable.
- **Explicit return types** on all exported functions.
- **Test everything.** Detection, non-detection, short-circuit, explanation.

## Running Benchmarks

```bash
# Run all benchmarks
pnpm benchmark

# Run for a specific technique
pnpm benchmark --technique NakedSingle
```

The benchmark compares TSudoku output against SudokuExplainer on a reference corpus. CI fails if any implemented technique drops below 95% agreement.
