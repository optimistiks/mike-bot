import { Progress } from "@/components/ui/8bit/progress";

/**
 * Line 3's bar, scaled against the section leader rather than any absolute
 * ceiling: the shape of the standings is what the bar is for.
 *
 * Karma received can go negative — a Member marked down more than up — and a
 * whole section can, in principle, lead with zero or less. Both clamp to an
 * empty bar rather than an inverted one.
 *
 * This is the spec's pre-declared `xp-bar` → `progress` fallback, taken because
 * `xp-bar` fights a driven value: every section leader sits at exactly 100, and
 * `xp-bar` answers 100 with a "LEVEL UP!" overlay and a `animate-pulse` that
 * cannot be turned off. On a leaderboard the pulse reads as a loading skeleton,
 * and once ticket 06 springs the value through 100 with overshoot it would
 * flicker on every reveal. `xp-bar` also hardcodes its fill colour past the
 * props it spreads and never forwards `className` to the bar, so neither the
 * palette nor the height is reachable. `progress` is what `xp-bar` wraps, so
 * the retro squares are unchanged, and its default fill is the palette's own
 * primary rather than `xp-bar`'s hardcoded yellow.
 */
export function ScoreBar({
  score,
  leaderScore,
}: {
  score: number;
  leaderScore: number;
}) {
  const percent =
    leaderScore > 0
      ? Math.min(100, Math.max(0, (score / leaderScore) * 100))
      : 0;

  return (
    <Progress variant="retro" value={percent} className="h-3 min-w-0 flex-1" />
  );
}
