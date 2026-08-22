"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

import "@/components/ui/8bit/styles/retro.css";

export const progressVariants = cva("", {
  variants: {
    variant: {
      default: "",
      retro: "retro",
    },
    font: {
      normal: "",
      retro: "retro",
    },
  },
  defaultVariants: {
    font: "retro",
  },
});

export interface BitProgressProps
  extends
    Omit<ProgressPrimitive.Root.Props, "value">,
    VariantProps<typeof progressVariants> {
  className?: string;
  progressBg?: string;
  /** Base UI reads `null` as indeterminate; omitting the value means empty. */
  value?: number | null;
}

/** Exported so a caller driving `value` can tell when a change is visible. */
export const RETRO_SQUARES = 20;

function Progress({
  className,
  font,
  variant,
  value,
  progressBg,
  ...props
}: BitProgressProps) {
  // The caller sizes the bar through className; the track has to match it.
  // Match the whole `h-` token so fractional (`h-1.5`), keyword (`h-full`), and
  // arbitrary (`h-[3px]`) heights all survive.
  const heightMatch = className?.match(/(?:^|\s)(h-\S+)/);
  const heightClass = heightMatch?.[1] ?? "h-2";
  // `null` is indeterminate and reaches the primitive as-is; only an omitted
  // value falls back to an empty bar.
  const percent = typeof value === "number" ? value : 0;

  return (
    <div className={cn("relative w-full", className)}>
      <ProgressPrimitive.Root
        data-slot="progress"
        value={value === undefined ? 0 : value}
        className={cn("w-full", font !== "normal" && "retro")}
        {...props}
      >
        <ProgressPrimitive.Track
          className={cn(
            "relative w-full overflow-hidden bg-primary/20",
            heightClass,
          )}
        >
          {variant === "retro" ? (
            // Discrete squares rather than a continuous fill: the bar reads as
            // pixels, and a spring-driven value lands on a square boundary.
            <div className="flex h-full w-full">
              {Array.from({ length: RETRO_SQUARES }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "mx-[1px] h-full flex-1",
                    index < Math.round((percent / 100) * RETRO_SQUARES)
                      ? (progressBg ?? "bg-primary")
                      : "bg-transparent",
                  )}
                />
              ))}
            </div>
          ) : (
            <ProgressPrimitive.Indicator
              data-slot="progress-indicator"
              className={cn("h-full w-full", progressBg ?? "bg-primary")}
              style={{ transform: `translateX(-${String(100 - percent)}%)` }}
            />
          )}
        </ProgressPrimitive.Track>
      </ProgressPrimitive.Root>

      <div
        className="pointer-events-none absolute inset-0 -my-1 border-y-4 border-foreground dark:border-ring"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-0 -mx-1 border-x-4 border-foreground dark:border-ring"
        aria-hidden="true"
      />
    </div>
  );
}

export { Progress };
