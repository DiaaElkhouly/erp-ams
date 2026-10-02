"use client";

import { Boxes } from "lucide-react";
import { NavLinks } from "./nav-links";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@prisma/client";

export function Sidebar({ role }: { role: Role }) {
  const { t } = useI18n();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex print:hidden">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Boxes className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">IMS Manufacturing</span>
      </div>
      <NavLinks role={role} />
      <div className="border-t p-3 text-[11px] text-muted-foreground">
        {t.enterpriseEdition}
      </div>
    </aside>
  );
}
