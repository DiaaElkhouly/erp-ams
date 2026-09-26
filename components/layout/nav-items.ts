import type { NavItem } from "@/types";

export const NAV_ITEMS: NavItem[] = [
  { label: "dashboard", href: "/dashboard", icon: "LayoutDashboard", module: "dashboard" },
  { label: "inventory", href: "/inventory", icon: "Package", module: "inventory" },
  { label: "warehouse", href: "/warehouse", icon: "Warehouse", module: "warehouse" },
  { label: "production", href: "/production", icon: "Factory", module: "production" },
  { label: "lab", href: "/lab", icon: "FlaskConical", module: "lab" },
  { label: "bom", href: "/bom", icon: "ListTree", module: "bom" },
  { label: "mrp", href: "/mrp", icon: "CalendarClock", module: "mrp" },
  { label: "sales", href: "/sales", icon: "ShoppingCart", module: "sales" },
  { label: "purchasing", href: "/purchasing", icon: "Truck", module: "purchasing" },
  { label: "reports", href: "/reports", icon: "BarChart3", module: "reports" },
];
