"use client";

import type { SpringOptions } from "motion/react";

import { useMotionValueEvent, useSpring } from "motion/react";
import { useEffect, useState } from "react";

/**
 * A value that springs from zero to `target` after a delay, as React state.
 *
 * Both of the standings' physics — the score counting up and its bar filling —
 * are this same machine, which is why it is one hook rather than two copies:
 * a spring, a delay that staggers it down the list, and a filter that keeps the
 * spring's per-frame output from becoming a per-frame render.
 *
 * The spring drives a MotionValue rather than the DOM, because neither caller
 * is animating a style — one is animating text content and the other is
 * animating a discrete count of squares. That is also why the value has to come
 * back through React state at all.
 *
 * `quantize` is what makes that affordable. It maps a raw spring value onto
 * whatever the caller can actually *show* — an integer, a square index — and a
 * frame that lands on the same rung as the last one is dropped instead of
 * re-rendering. A twelve-row section therefore commits a handful of renders
 * across the whole reveal rather than twelve a frame.
 */
export function useDelayedSpring(
  target: number,
  {
    spring: config,
    delay,
    quantize,
  }: {
    spring: SpringOptions;
    /** Seconds to wait before the spring is released. */
    delay: number;
    /** The rungs the caller can render. Values between them are dropped. */
    quantize: (value: number) => number;
  },
): number {
  const spring = useSpring(0, config);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      spring.set(target);
    }, delay * 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [spring, target, delay]);

  useMotionValueEvent(spring, "change", (next) => {
    setValue((previous) =>
      quantize(previous) === quantize(next) ? previous : next,
    );
  });

  return value;
}
