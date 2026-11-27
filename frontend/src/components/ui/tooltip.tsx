import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type {
  TooltipPopupProps,
  TooltipPositionerProps,
  TooltipTriggerProps,
} from "@base-ui/react/tooltip";
import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

/** Shared delay for every tooltip in the app. */
function TooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Provider delay={300}>{children}</TooltipPrimitive.Provider>;
}

function Tooltip({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Root>{children}</TooltipPrimitive.Root>;
}

function TooltipTrigger({ className, ...props }: TooltipTriggerProps) {
  return (
    <TooltipPrimitive.Trigger type="button" className={cn("outline-none", className)} {...props} />
  );
}

function TooltipContent({
  className,
  children,
  side = "top",
  sideOffset = 6,
  ...props
}: TooltipPopupProps & {
  side?: TooltipPositionerProps["side"];
  sideOffset?: number;
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset} className="z-[60]">
        <TooltipPrimitive.Popup
          className={cn(
            "max-w-xs rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-micro leading-4 text-subtle shadow-popover outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
