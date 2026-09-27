"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { Search, Bell, Moon, Sun, LogOut, User as UserIcon, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CommandPalette } from "./command-palette";
import { MobileNav } from "./mobile-nav";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@prisma/client";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export function Topbar({ name, role }: { name: string; role: Role }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const [paletteOpen, setPaletteOpen] = useState(false);

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
    reports: t.nav.reports,
  };

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b bg-card px-3 sm:gap-4 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground sm:gap-3">
        <MobileNav role={role} />
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
          <span className="hidden sm:inline">{locale === "en" ? "عربي" : "EN"}</span>
        </Button>

        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -right-0.5 -top-0.5 h-4 w-4 justify-center rounded-full p-0 text-[9px]">3</Badge>
        </Button>

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
