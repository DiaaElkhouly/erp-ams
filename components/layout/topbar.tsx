"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Search, LogOut, User as UserIcon, Languages, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { NotificationBell } from "@/components/shared/notification-bell";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CommandPalette } from "./command-palette";
import { MobileNav } from "./mobile-nav";
import { useI18n } from "@/lib/i18n";
import { useSidebarStore } from "@/lib/sidebar-store";
import type { Role } from "@prisma/client";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export function Topbar({ name, role }: { name: string; role: Role }) {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const toggleSidebar = useSidebarStore((s) => s.toggle);

  const crumb = pathname.split("/").filter(Boolean);
  const crumbLabels: Record<string, string> = {
    dashboard: t.nav.dashboard,
    inventory: t.nav.inventory,
    warehouse: t.nav.warehouse,
    production: t.nav.production,
    lab: t.nav.lab,
    bom: t.nav.bom,
    mrp: t.nav.mrp,
    sales: t.nav.sales,
    purchasing: t.nav.purchasing,
    finance: t.nav.finance,
    hr: t.nav.hr,
    reports: t.nav.reports,
  };

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b bg-background px-3 sm:gap-4 sm:px-4 print:hidden">
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground sm:gap-3">
        <MobileNav role={role} />
        <Button
          variant="outline"
          size="sm"
          className="hidden px-2 md:flex"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="hidden shrink-0 sm:inline">{t.home}</span>
        {crumb.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-2 sm:gap-3">
            {i > 0 && <span className="shrink-0">/</span>}
            <span className="truncate capitalize text-foreground">{crumbLabels[c] ?? c.replace(/-/g, " ")}</span>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="hidden gap-2 text-muted-foreground md:flex"
          onClick={() => setPaletteOpen(true)}
        >
          <Search className="h-3.5 w-3.5" />
          {t.search}
          <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="gap-2 px-2 sm:px-3"
          onClick={() => setLocale(locale === "en" ? "ar" : "en")}
          aria-label={t.language}
        >
          <Languages className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{locale === "en" ? t.arabic : t.englishShort}</span>
        </Button>

        <ThemeToggle />

        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md p-1 pr-2 hover:bg-muted">
              <Avatar>
                <AvatarFallback>{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left md:block">
                <div className="text-xs font-medium leading-tight">{name}</div>
                <div className="text-[11px] text-muted-foreground leading-tight">{t.roles[role]}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t.myAccount}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <UserIcon className="mr-2 h-4 w-4" /> {t.profile}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" /> {t.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} role={role} />
    </header>
  );
}
