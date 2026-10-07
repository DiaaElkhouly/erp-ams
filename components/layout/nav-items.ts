import type { NavItem } from "@/types";

/**
 * Sidebar order follows the shop floor's daily loop, not the alphabet:
 * stock on hand, then what we make, buy and sell, then the supporting
 * modules, then reporting and administration at the bottom.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "dashboard", href: "/dashboard", icon: "LayoutDashboard", module: "dashboard" },
  { label: "inventory", href: "/inventory", icon: "Package", module: "inventory" },
  { label: "production", href: "/production", icon: "Factory", module: "production" },
  { label: "bom", href: "/bom", icon: "ListTree", module: "bom" },
  { label: "mrp", href: "/mrp", icon: "CalendarClock", module: "mrp" },
  { label: "purchasing", href: "/purchasing", icon: "Truck", module: "purchasing" },
  { label: "sales", href: "/sales", icon: "ShoppingCart", module: "sales" },
  { label: "warehouse", href: "/warehouse", icon: "Warehouse", module: "warehouse" },
  { label: "lab", href: "/lab", icon: "FlaskConical", module: "lab" },
  { label: "finance", href: "/finance", icon: "Receipt", module: "finance" },
  { label: "hr", href: "/hr", icon: "Users", module: "hr" },
  { label: "reports", href: "/reports", icon: "BarChart3", module: "reports" },
];
