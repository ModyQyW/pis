"use client";

import * as React from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";

/** Base UI menu with the small surface the session menu uses. */
export const Root = MenuPrimitive.Root;

export function Trigger({
  asChild,
  children,
  ...props
}: MenuPrimitive.Trigger.Props & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return <MenuPrimitive.Trigger {...props} render={children} />;
  }
  return <MenuPrimitive.Trigger {...props}>{children}</MenuPrimitive.Trigger>;
}

export const Portal = MenuPrimitive.Portal;

export function Content({
  className,
  align = "end",
  sideOffset = 6,
  children,
  ...props
}: MenuPrimitive.Popup.Props & {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner align={align} sideOffset={sideOffset} className="z-50">
        <MenuPrimitive.Popup data-slot="menu-popup" className={className} {...props}>
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export function Item({
  className,
  onSelect,
  children,
  ...props
}: MenuPrimitive.Item.Props & { onSelect?: () => void }) {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      className={className}
      onClick={() => onSelect?.()}
      {...props}
    >
      {children}
    </MenuPrimitive.Item>
  );
}

export const Separator = MenuPrimitive.Separator;
