import { Role } from "@prisma/client";

// Central permission matrix. Each module lists the roles allowed to write to it.
// ADMINISTRATOR always has full access.
export const MODULE_PERMISSIONS = {
  dashboard: [
    Role.ADMINISTRATOR, Role.PRODUCTION_MANAGER, Role.WAREHOUSE_MANAGER,
    Role.PURCHASING_OFFICER, Role.SALES_STAFF, Role.FINANCE, Role.HR, Role.QA, Role.EMPLOYEE,
  ],
  inventory: [Role.ADMINISTRATOR, Role.WAREHOUSE_MANAGER, Role.PRODUCTION_MANAGER],
  warehouse: [Role.ADMINISTRATOR, Role.WAREHOUSE_MANAGER],
  production: [Role.ADMINISTRATOR, Role.PRODUCTION_MANAGER, Role.QA],
  lab: [Role.ADMINISTRATOR, Role.QA, Role.PRODUCTION_MANAGER],
  bom: [Role.ADMINISTRATOR, Role.PRODUCTION_MANAGER],
  mrp: [Role.ADMINISTRATOR, Role.PRODUCTION_MANAGER, Role.PURCHASING_OFFICER],
  sales: [Role.ADMINISTRATOR, Role.SALES_STAFF],
  purchasing: [Role.ADMINISTRATOR, Role.PURCHASING_OFFICER],
  reports: [Role.ADMINISTRATOR, Role.FINANCE, Role.PRODUCTION_MANAGER, Role.SALES_STAFF],
} as const;

export type ModuleKey = keyof typeof MODULE_PERMISSIONS;

export function canAccess(role: Role | undefined, module: ModuleKey): boolean {
  if (!role) return false;
  if (role === Role.ADMINISTRATOR) return true;
  return (MODULE_PERMISSIONS[module] as readonly Role[]).includes(role);
}

