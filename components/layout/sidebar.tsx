"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Warehouse, Factory, ListTree, CalendarClock,
  ShoppingCart, Truck, BarChart3, Boxes, FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { canAccess, type ModuleKey } from "@/lib/rbac";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@prisma/client";

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, Package, Warehouse, Factory, ListTree, CalendarClock, ShoppingCart, Truck, BarChart3, FlaskConical,
};

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = NAV_ITEMS.filter((item) => canAccess(role, item.module as ModuleKey));

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Boxes className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">IMS Manufacturing</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 no-scrollbar">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {t.nav[item.label as keyof typeof t.nav]}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3 text-[11px] text-muted-foreground">
        {t.enterpriseEdition}
      </div>
    </aside>
  );
}
