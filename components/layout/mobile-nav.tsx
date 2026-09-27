"use client";

import { useState } from "react";
import { Menu, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { NavLinks } from "./nav-links";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@prisma/client";

export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const { direction, t } = useI18n();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          aria-label={t.menu}
          aria-expanded={open}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side={direction === "rtl" ? "right" : "left"} className="p-0">
        <SheetHeader className="flex-row items-center gap-2 border-b px-4 py-0">
          <div className="flex h-14 shrink-0 items-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="h-14 min-w-0 flex-1 py-3 text-start">
            <SheetTitle className="truncate text-sm font-semibold tracking-tight">
              IMS Manufacturing
            </SheetTitle>
            <SheetDescription className="truncate">{t.modules}</SheetDescription>
          </div>
        </SheetHeader>

        <NavLinks role={role} onNavigate={() => setOpen(false)} />

        <div className="border-t p-3 text-[11px] text-muted-foreground">
          {t.enterpriseEdition}
          <SheetClose asChild>
            <Button variant="ghost" size="sm" className="mt-2 w-full justify-start text-muted-foreground">
              {t.common.close}
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
