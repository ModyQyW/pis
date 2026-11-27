import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "../../lib/cn";

export type SelectOption = { value: string; label: string };

/** A single-select dropdown styled with the shared control tokens. */
export function Select({
  value,
  options,
  onValueChange,
  ariaLabel,
  disabled,
  className,
}: {
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <SelectPrimitive.Root
      items={options}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-control bg-canvas px-2 text-label text-fg outline-none select-none focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)] disabled:opacity-60",
          className,
        )}
      >
        <SelectPrimitive.Value className="min-w-0 truncate" />
        <SelectPrimitive.Icon className="shrink-0 text-faint">
          <ChevronsUpDown size={12} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={4} className="z-[60]">
          <SelectPrimitive.Popup className="min-w-[var(--anchor-width)] max-w-[var(--available-width)] overflow-hidden rounded-lg border border-border-strong bg-surface p-1 shadow-popover outline-none">
            <SelectPrimitive.List className="max-h-[min(22rem,var(--available-height))] overflow-y-auto scroll-thin">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-label text-subtle outline-none select-none data-highlighted:bg-surface-2 data-highlighted:text-fg data-selected:text-fg"
                >
                  <span className="flex w-3 shrink-0 justify-center">
                    <SelectPrimitive.ItemIndicator className="text-brand-ink">
                      <Check size={12} />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText className="min-w-0 flex-1 truncate">
                    {option.label}
                  </SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
