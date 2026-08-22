"use client";

import { useDelayedSpring } from "../_lib/use-delayed-spring";
import { SCORE_SPRING } from "./motion-config";

/**
 * Line 3's number, springing from zero to its score with an overshoot.
 *
 * A negative score — a Member marked down more than up — springs downward from
 * zero and overshoots past its target the same way, which is correct: the
 * overshoot belongs to the motion, not to the sign.
 *
 * Whole points are the only thing a score can be, so they are also the only
 * thing worth re-rendering for.
 */
export function ScoreCounter({
  score,
  delay,
  className,
}: {
  score: number;
  /** Seconds to wait before the count starts, staggering scores down the list. */
  delay: number;
  className?: string;
}) {
  const value = useDelayedSpring(score, {
    spring: SCORE_SPRING,
    delay,
    quantize: Math.round,
  });

  return <span className={className}>{Math.round(value)}</span>;
}
