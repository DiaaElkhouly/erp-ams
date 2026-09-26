export type { Role, ItemType, WorkOrderStatus, SalesOrderStatus, PurchaseOrderStatus } from "@prisma/client";

export interface KpiCard {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  module: string;
}
