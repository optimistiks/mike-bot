"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

import {
  ToggleGroup as ShadcnToggleGroup,
  ToggleGroupItem as ShadcnToggleGroupItem,
} from "@/components/ui/toggle-group";
import "@/components/ui/8bit/styles/retro.css";

export const toggleGroupVariants = cva("", {
  variants: {
    font: { normal: "", retro: "retro" },
    variant: {
      default: "bg-transparent",
      outline:
        "bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
    },
    size: {
      default: "h-9 min-w-9 px-2",
      sm: "h-4 min-w-4 px-1.5",
      lg: "h-10 min-w-10 px-2.5",
    },
  },
  defaultVariants: { variant: "default", font: "retro", size: "default" },
});

export type BitToggleGroupProps = ToggleGroupPrimitive.Props &
  VariantProps<typeof toggleGroupVariants>;

export type BitToggleGroupItemProps = TogglePrimitive.Props &
  VariantProps<typeof toggleGroupVariants>;

function ToggleGroup({
  className,
  font,
  children,
  ...props
}: BitToggleGroupProps) {
  return (
    <ShadcnToggleGroup
      className={cn("gap-3", className, font !== "normal" && "retro")}
      {...props}
    >
      {children}
    </ShadcnToggleGroup>
  );
}

function ToggleGroupItem({
  className,
  font,
  variant,
  children,
  ...props
}: BitToggleGroupItemProps) {
  return (
    <ShadcnToggleGroupItem
      className={cn(
        "relative transition-transform active:translate-x-1 active:translate-y-1",
        className,
        font !== "normal" && "retro",
      )}
      variant={variant}
      {...props}
    >
      {children}
      {variant === "outline" && (
        <>
          <div
            className="pointer-events-none absolute inset-0 -my-1.5 border-y-6 border-foreground dark:border-ring"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 -mx-1.5 border-x-6 border-foreground dark:border-ring"
            aria-hidden="true"
          />
        </>
      )}
    </ShadcnToggleGroupItem>
  );
}

export { ToggleGroup, ToggleGroupItem };
