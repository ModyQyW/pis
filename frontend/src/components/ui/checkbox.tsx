import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  className,
  ariaLabel,
  title,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  title?: string;
}) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        "flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border border-control bg-canvas text-brand-fg outline-none transition-colors data-checked:border-brand data-checked:bg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:opacity-40",
        className,
      )}
    >
      <CheckboxPrimitive.Indicator className="data-unchecked:hidden">
        <Check size={10} strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/** A checkbox with its label in one row; a click anywhere in the row toggles it. */
export function CheckboxField({
  checked,
  onCheckedChange,
  disabled,
  className,
  ariaLabel,
  checkboxClassName,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel: string;
  checkboxClassName?: string;
  children: ReactNode;
}) {
  return (
    <label
      className={className}
      onClick={(event) => {
        if ((event.target as Element).closest("[role=checkbox]")) return;
        event.preventDefault();
        event.currentTarget.querySelector<HTMLElement>("[role=checkbox]")?.focus();
        if (!disabled) onCheckedChange(!checked);
      }}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        ariaLabel={ariaLabel}
        className={checkboxClassName}
      />
      {children}
    </label>
  );
}
