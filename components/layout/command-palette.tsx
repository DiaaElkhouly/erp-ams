"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { NAV_ITEMS } from "./nav-items";
import { canAccess, type ModuleKey } from "@/lib/rbac";
import type { Role } from "@prisma/client";
import { useI18n } from "@/lib/i18n";

export function CommandPalette({
  open, onOpenChange, role,
}: { open: boolean; onOpenChange: (v: boolean) => void; role: Role }) {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  const items = NAV_ITEMS.filter((item) => canAccess(role, item.module as ModuleKey));

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 pt-32" onClick={() => onOpenChange(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-lg border bg-popover shadow-xl">
        <Command>
          <Command.Input
            autoFocus
            placeholder={t.localeName === "العربية" ? "انتقل إلى وحدة..." : "Jump to a module..."}
            className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="p-4 text-center text-sm text-muted-foreground">{t.common.noResults}</Command.Empty>
            {items.map((item) => (
              <Command.Item
                key={item.href}
                onSelect={() => {
                  router.push(item.href);
                  onOpenChange(false);
                }}
                className="cursor-pointer rounded-md px-3 py-2 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
              >
                {t.nav[item.label as keyof typeof t.nav]}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
