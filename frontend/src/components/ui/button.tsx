import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent whitespace-nowrap font-medium transition-colors outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/85",
        secondary: "border-border-strong bg-surface text-fg hover:bg-surface-2",
        outline: "border-control bg-transparent text-fg hover:bg-surface-2",
        ghost: "text-subtle hover:bg-surface-2 hover:text-fg",
        brand: "bg-brand text-brand-fg hover:opacity-90",
        destructive: "border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
        quiet: "text-subtle hover:bg-surface-2 hover:text-fg",
      },
      size: {
        xs: "h-6 px-2 text-micro [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 px-2.5 text-label [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-8 px-3 text-label [&_svg:not([class*='size-'])]:size-4",
        lg: "h-9 px-3.5 text-body [&_svg:not([class*='size-'])]:size-4",
        icon: "size-7 rounded-md",
        "icon-xs": "size-5 rounded-sm",
        "icon-sm": "size-6 rounded-sm",
        "icon-lg": "size-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

function Button({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
