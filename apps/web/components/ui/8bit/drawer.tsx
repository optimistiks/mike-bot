"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

import {
  Drawer as ShadcnDrawer,
  DrawerClose as ShadcnDrawerClose,
  DrawerContent as ShadcnDrawerContent,
  DrawerDescription as ShadcnDrawerDescription,
  DrawerFooter as ShadcnDrawerFooter,
  DrawerHeader as ShadcnDrawerHeader,
  DrawerOverlay as ShadcnDrawerOverlay,
  DrawerPortal as ShadcnDrawerPortal,
  DrawerTitle as ShadcnDrawerTitle,
  DrawerTrigger as ShadcnDrawerTrigger,
} from "@/components/ui/drawer";
import "@/components/ui/8bit/styles/retro.css";

const Drawer = ShadcnDrawer;
const DrawerPortal = ShadcnDrawerPortal;
const DrawerOverlay = ShadcnDrawerOverlay;
const DrawerClose = ShadcnDrawerClose;

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return <ShadcnDrawerTitle className={cn(className, "retro")} {...props} />;
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <ShadcnDrawerDescription className={cn(className, "retro")} {...props} />
  );
}

function DrawerTrigger({ className, ...props }: DrawerPrimitive.Trigger.Props) {
  return <ShadcnDrawerTrigger className={cn(className, "retro")} {...props} />;
}

export const drawerVariants = cva("", {
  variants: {
    font: {
      normal: "",
      retro: "retro",
    },
  },
  defaultVariants: {
    font: "retro",
  },
});

export type DrawerProps = DrawerPrimitive.Popup.Props &
  VariantProps<typeof drawerVariants>;

function DrawerContent({ className, children, ...props }: DrawerProps) {
  return (
    <ShadcnDrawerContent
      className={cn(
        "rounded-none border-t-4 border-foreground bg-background dark:border-ring",
        className,
        "retro",
      )}
      {...props}
    >
      {children}
    </ShadcnDrawerContent>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <ShadcnDrawerHeader className={cn(className, "retro")} {...props} />;
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <ShadcnDrawerFooter className={cn(className, "retro")} {...props} />;
}

export {
  Drawer,
  DrawerHeader,
  DrawerFooter,
  DrawerClose,
  DrawerTrigger,
  DrawerContent,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerDescription,
};
