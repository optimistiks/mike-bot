/**
 * Vitest stub for the `next/cache` directives' companion APIs.
 *
 * Vitest compiles with esbuild rather than Next's compiler, so `use cache` is
 * an inert string here and the cached functions simply run. `cacheLife` is not
 * inert: it throws on sight outside a Next runtime, which would fail every test
 * that reaches a cached function. Stubbing it keeps those tests exercising the
 * real code around it, at the cost of never proving the caching itself — that
 * belongs to `next build` and `next start`.
 */
export function cacheLife(): void {
  // No lifetime to record: nothing is cached under Vitest.
}

export function cacheTag(): void {
  // Likewise, nothing to tag.
}
