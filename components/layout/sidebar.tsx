"use client";

import { useRef, useState } from "react";
import { Boxes } from "lucide-react";
import { NavLinks } from "./nav-links";
import { useI18n } from "@/lib/i18n";
import { useSidebarStore } from "@/lib/sidebar-store";
import type { Role } from "@prisma/client";

const FULL_WIDTH = 240;
const ICON_WIDTH = 64;
/** Below this while dragging, release snaps the sidebar to icon-only. */
const SNAP_THRESHOLD = 160;

export function Sidebar({ role }: { role: Role }) {
  const { t } = useI18n();
  const collapsed = useSidebarStore((s) => s.collapsed);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const asideRef = useRef<HTMLElement>(null);

  function startResize(event: React.MouseEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = asideRef.current?.offsetWidth ?? (collapsed ? ICON_WIDTH : FULL_WIDTH);
    const sign = typeof document !== "undefined" && document.documentElement.dir === "rtl" ? -1 : 1;

    function onMove(e: MouseEvent) {
      const next = Math.min(280, Math.max(48, startWidth + (e.clientX - startX) * sign));
      setDragWidth(next);
    }
    function onUp(e: MouseEvent) {
      const finalWidth = startWidth + (e.clientX - startX) * sign;
      setCollapsed(finalWidth < SNAP_THRESHOLD);
      setDragWidth(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <aside
      ref={asideRef}
      style={{ width: dragWidth ?? (collapsed ? ICON_WIDTH : "max-content") }}
      className={`relative hidden shrink-0 flex-col border-e border-foreground/15 bg-background shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.7)] [dir=rtl]:shadow-[inset_1px_0_0_0_rgba(255,255,255,0.7)] dark:border-foreground/20 dark:shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.06)] dark:[dir=rtl]:shadow-[inset_1px_0_0_0_rgba(255,255,255,0.06)] md:flex print:hidden ${dragWidth === null ? "transition-[width]" : ""}`}
    >
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Boxes className="h-4 w-4" />
        </div>
        {!collapsed && <span className="truncate text-sm font-semibold tracking-tight">IMS Manufacturing</span>}
      </div>
      <NavLinks role={role} collapsed={collapsed} />
      {!collapsed && (
        <div className="border-t p-3 text-[11px] text-muted-foreground">
          {t.enterpriseEdition}
        </div>
      )}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onMouseDown={startResize}
        className="absolute inset-y-0 end-0 w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60"
      />
    </aside>
  );
}
