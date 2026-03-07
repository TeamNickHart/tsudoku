# ADR-0006: tsup for ESM+CJS Dual Output

- **Status:** Accepted
- **Date:** 2026-03-07
- **Phase:** 0
- **Deciders:** Nick Hart

## Context

The TypeScript ecosystem is in an ESM transition. Some consumers use ESM (`import`), others still require CJS (`require`). We need to ship both formats from every package with correct type declarations.

## Decision

We will use tsup (esbuild-based) to build ESM + CJS dual output with `.d.ts` generation for every package.

```typescript
// tsup.config.ts (identical across packages)
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

## Rationale

tsup is fast (esbuild-powered), zero-config for common cases, and handles the dual-format complexity (conditional exports, `.js`/`.cjs` extensions) correctly. It's the most popular build tool for library authoring in the TypeScript ecosystem.

## Alternatives Considered

### tsc Only

- **Pros:** No extra dependency, TypeScript-native
- **Cons:** Cannot produce CJS + ESM from single source, no bundling, slow

### Rollup + rollup-plugin-typescript2

- **Pros:** Maximum control, tree-shaking
- **Cons:** Complex config, slower than esbuild, more dependencies

### unbuild

- **Pros:** Similar to tsup, passive bundling
- **Cons:** Less mature, smaller community

## Consequences

- **Positive:** Fast builds, correct dual output, minimal config
- **Negative:** esbuild doesn't type-check (we use `tsc --noEmit` separately)
- **Neutral:** All packages share identical `tsup.config.ts`

## Compliance

- Every package must have a `tsup.config.ts` with the standard config
- `package.json` must have conditional `exports` with `import`, `require`, and `types`
- CI runs `tsc --noEmit` (typecheck) separately from build
