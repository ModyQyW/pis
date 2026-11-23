"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

/** Base UI dialog with the small surface the app's dialogs use. */
export const Root = DialogPrimitive.Root;
export const Portal = DialogPrimitive.Portal;
export const Title = DialogPrimitive.Title;
export const Description = DialogPrimitive.Description;

export function Overlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return <DialogPrimitive.Backdrop data-slot="dialog-backdrop" className={className} {...props} />;
}

export function Content({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Popup data-slot="dialog-popup" className={className} {...props}>
      {children}
    </DialogPrimitive.Popup>
  );
}

export function Close({
  asChild,
  children,
  ...props
}: DialogPrimitive.Close.Props & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return <DialogPrimitive.Close {...props} render={children} />;
  }
  return <DialogPrimitive.Close {...props}>{children}</DialogPrimitive.Close>;
}
