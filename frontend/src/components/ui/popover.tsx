import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type {
  PopoverCloseProps,
  PopoverPopupProps,
  PopoverPositionerProps,
  PopoverTriggerProps,
} from "@base-ui/react/popover";
import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

function Popover({
  children,
  onOpenChange,
}: {
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  return <PopoverPrimitive.Root onOpenChange={onOpenChange}>{children}</PopoverPrimitive.Root>;
}

function PopoverTrigger({ className, ...props }: PopoverTriggerProps) {
  return (
    <PopoverPrimitive.Trigger type="button" className={cn("outline-none", className)} {...props} />
  );
}

function PopoverContent({
  className,
  children,
  side = "top",
  align = "end",
  sideOffset = 6,
  ...props
}: PopoverPopupProps & {
  side?: PopoverPositionerProps["side"];
  align?: PopoverPositionerProps["align"];
  sideOffset?: number;
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="z-[60]"
      >
        <PopoverPrimitive.Popup
          className={cn(
            "rounded-lg border border-border-strong bg-surface p-3 shadow-popover outline-none",
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverClose({ className, ...props }: PopoverCloseProps) {
  return <PopoverPrimitive.Close type="button" className={className} {...props} />;
}

export { Popover, PopoverClose, PopoverContent, PopoverTrigger };
