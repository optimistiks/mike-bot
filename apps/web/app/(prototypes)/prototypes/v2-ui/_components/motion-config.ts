/**
 * Every spring and stagger the prototype animates with, in one place.
 *
 * Motion configuration lives in component props rather than in the stylesheet,
 * which is understood not to violate the prototype's single-CSS-file rule: a
 * spring is not a declarative style, it is a physics simulation the library
 * runs. Collecting the numbers here keeps them readable as a system anyway —
 * the scores, their bars, and the rows they sit in have to feel like one
 * material, and they cannot if their constants are scattered across four files.
 */

/**
 * Under-damped on purpose: a score that eases into place reads as a number
 * being set, and a score that overshoots and settles reads as a scoreboard
 * landing. The overshoot is the entire point of the spec's "slight overshoot".
 */
export const SCORE_SPRING = { stiffness: 210, damping: 11, mass: 0.9 } as const;

/**
 * The bar is heavier than the number it accompanies — it overshoots less, so
 * the fill reads as being pushed rather than flung. Its squares are discrete,
 * so a violent spring would only show as a flicker at the end anyway.
 */
export const BAR_SPRING = { stiffness: 130, damping: 16, mass: 1 } as const;

/** Rows arrive on the same spring as everything else, with no overshoot. */
export const ROW_SPRING = {
  type: "spring",
  stiffness: 320,
  damping: 30,
  mass: 0.8,
} as const;

/** The reveal's height change. Interruptible by virtue of being a spring. */
export const LAYOUT_SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 38,
  mass: 0.9,
} as const;

/** Seconds between one row's reveal and the next. */
const STAGGER_STEP = 0.055;

/**
 * How far down the list the stagger keeps leading the eye before it gives up.
 *
 * Past this the delay is flat: a thirty-person Chat that staggered all the way
 * down would leave its last rows arriving nearly two seconds after the first,
 * which stops being a lead and starts being a wait.
 */
const STAGGER_CAP = 8;

/** The reveal delay for the row at `index`, in seconds. */
export function staggerDelay(index: number): number {
  return Math.min(index, STAGGER_CAP) * STAGGER_STEP;
}
