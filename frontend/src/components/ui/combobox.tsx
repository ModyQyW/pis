import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Check, ChevronsUpDown } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { cn } from "../../lib/cn";

export type ComboboxOption = {
  value: string;
  label: string;
  detail?: string;
};

/** A single-select combobox. Type in the field to filter the list. */
export function Combobox({
  value,
  options,
  onValueChange,
  ariaLabel,
  placeholder,
  emptyLabel,
  disabled,
  className,
  popupClassName,
  popupStart,
  onOpenChange,
}: {
  value: ComboboxOption | null;
  options: ComboboxOption[];
  onValueChange: (option: ComboboxOption) => void;
  ariaLabel: string;
  placeholder?: string;
  emptyLabel: string;
  disabled?: boolean;
  className?: string;
  popupClassName?: string;
  popupStart?: ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <ComboboxPrimitive.Root
      items={options}
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      onOpenChange={(next) => {
        onOpenChange?.(next);
        // Select the current label so typing starts a search instead of appending to it.
        if (next) requestAnimationFrame(() => inputRef.current?.select());
      }}
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      filter={(option, query) =>
        `${option.label} ${option.detail ?? ""}`.toLowerCase().includes(query.toLowerCase())
      }
      disabled={disabled}
    >
      <div className={cn("relative", className)}>
        <ComboboxPrimitive.Input
          ref={inputRef}
          aria-label={ariaLabel}
          placeholder={placeholder}
          className="h-8 w-full rounded-md border border-control bg-canvas px-2 pr-7 text-label text-fg outline-none placeholder:text-faint focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus-ring)]"
        />
        <ComboboxPrimitive.Trigger
          aria-label={ariaLabel}
          className="absolute inset-y-0 right-0 flex w-7 items-center justify-center rounded-r-md text-faint transition-colors hover:text-fg"
        >
          <ChevronsUpDown size={12} />
        </ComboboxPrimitive.Trigger>
      </div>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={4} className="z-[60]">
          <ComboboxPrimitive.Popup
            className={cn(
              "flex w-[var(--anchor-width)] max-w-[var(--available-width)] flex-col overflow-hidden rounded-lg border border-border-strong bg-surface p-1 shadow-popover outline-none",
              popupClassName,
            )}
          >
            <div className="flex min-h-0">
              {popupStart}
              <div className="min-w-0 flex-1 overflow-hidden">
                <ComboboxPrimitive.Empty className="text-center text-label text-faint">
                  <span className="block px-2 py-4">{emptyLabel}</span>
                </ComboboxPrimitive.Empty>
                <ComboboxPrimitive.List className="max-h-[min(22rem,var(--available-height))] overflow-y-auto scroll-thin">
                  {(option: ComboboxOption) => (
                    <ComboboxPrimitive.Item
                      key={option.value}
                      value={option}
                      className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-label text-subtle outline-none select-none data-highlighted:bg-surface-2 data-highlighted:text-fg data-selected:text-fg"
                    >
                      <span className="flex w-3 shrink-0 justify-center">
                        <ComboboxPrimitive.ItemIndicator className="text-brand-ink">
                          <Check size={12} />
                        </ComboboxPrimitive.ItemIndicator>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{option.label}</span>
                        {option.detail ? (
                          <span className="block truncate text-micro text-faint">
                            {option.detail}
                          </span>
                        ) : null}
                      </span>
                    </ComboboxPrimitive.Item>
                  )}
                </ComboboxPrimitive.List>
              </div>
            </div>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}
