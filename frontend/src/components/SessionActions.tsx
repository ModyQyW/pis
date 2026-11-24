import * as DropdownMenu from "@/components/ui/menu-compat";
import {
  CircleEllipsis,
  Minimize2,
  Download,
  FolderOpen,
  GitBranch,
  ListTree,
  Pencil,
  Trash2,
} from "lucide-react";

import { t } from "../lib/i18n";

export function SessionActions({
  onRename,
  onClone,
  onTree,
  onCompact,
  onExport,
  onReveal,
  onClose,
  onDelete,
}: {
  onRename: () => void;
  onClone: () => void;
  onTree: () => void;
  onCompact: () => void;
  onExport: () => void;
  onReveal: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label={t("Session actions")}
          title={t("Session actions")}
        >
          <CircleEllipsis size={15} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[190px] rounded-lg border border-border-strong bg-surface p-1 shadow-xl"
        >
          <Item icon={Pencil} onSelect={onRename}>
            {t("Rename session…")}
          </Item>
          <Item icon={GitBranch} onSelect={onClone}>
            {t("Clone branch")}
          </Item>
          <Item icon={ListTree} onSelect={onTree}>
            {t("Session tree…")}
          </Item>
          <Item icon={Minimize2} onSelect={onCompact}>
            {t("Compact context")}
          </Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <Item icon={Download} onSelect={onExport}>
            {t("Export as HTML…")}
          </Item>
          <Item icon={FolderOpen} onSelect={onReveal}>
            {t("Reveal session file")}
          </Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <Item icon={Trash2} onSelect={onClose} danger>
            {t("Close session")}
          </Item>
          <Item icon={Trash2} onSelect={onDelete} danger>
            {t("Delete session…")}
          </Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Item({
  icon: Icon,
  onSelect,
  children,
  danger,
}: {
  icon: typeof Pencil;
  onSelect: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={`flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] outline-none data-[highlighted]:bg-surface-2 ${
        danger
          ? "text-danger data-[highlighted]:text-danger"
          : "text-subtle data-[highlighted]:text-fg"
      }`}
    >
      <Icon size={12} />
      {children}
    </DropdownMenu.Item>
  );
}
