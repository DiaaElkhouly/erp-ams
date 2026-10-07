"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Warehouse, Factory, ListTree, CalendarClock,
  ShoppingCart, Truck, BarChart3, FlaskConical, Receipt, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { canAccess, type ModuleKey } from "@/lib/rbac";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@prisma/client";

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, Package, Warehouse, Factory, ListTree, CalendarClock, ShoppingCart, Truck,
  BarChart3, FlaskConical, Receipt, Users,
};

export function NavLinks({ role, onNavigate, collapsed }: { role: Role; onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = NAV_ITEMS.filter((item) => canAccess(role, item.module as ModuleKey));

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 no-scrollbar">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? t.nav[item.label as keyof typeof t.nav] : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              collapsed && "justify-center gap-0 px-2",
              active
                ? "bg-accent font-semibold text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {/* A quiet accent rail, inset from both corners, so the current
                section is legible even in a long list and even when colour
                perception is limited. */}
            {active ? (
              <span
                aria-hidden
                className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-primary"
              />
            ) : null}
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            {!collapsed && t.nav[item.label as keyof typeof t.nav]}
          </Link>
        );
      })}
    </nav>
  );
}
