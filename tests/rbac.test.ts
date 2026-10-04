import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { MODULE_PERMISSIONS, canAccess, type ModuleKey } from "@/lib/rbac";

/**
 * The full matrix is written out literally rather than derived from
 * MODULE_PERMISSIONS, so widening a permission is a failing test and not a
 * silent diff. Rows are roles, columns are modules.
 */
const EXPECTED: Record<Role, Record<ModuleKey, boolean>> = {
  ADMINISTRATOR: {
    dashboard: true, inventory: true, warehouse: true, production: true, lab: true,
    bom: true, mrp: true, sales: true, purchasing: true, reports: true,
  },
  PRODUCTION_MANAGER: {
    dashboard: true, inventory: true, warehouse: false, production: true, lab: true,
    bom: true, mrp: true, sales: false, purchasing: false, reports: true,
  },
  WAREHOUSE_MANAGER: {
    dashboard: true, inventory: true, warehouse: true, production: false, lab: false,
    bom: false, mrp: false, sales: false, purchasing: false, reports: false,
  },
  PURCHASING_OFFICER: {
    dashboard: true, inventory: false, warehouse: false, production: false, lab: false,
    bom: false, mrp: true, sales: false, purchasing: true, reports: false,
  },
  SALES_STAFF: {
    dashboard: true, inventory: false, warehouse: false, production: false, lab: false,
    bom: false, mrp: false, sales: true, purchasing: false, reports: true,
  },
  FINANCE: {
    dashboard: true, inventory: false, warehouse: false, production: false, lab: false,
    bom: false, mrp: false, sales: false, purchasing: false, reports: true,
  },
  HR: {
    dashboard: true, inventory: false, warehouse: false, production: false, lab: false,
    bom: false, mrp: false, sales: false, purchasing: false, reports: false,
  },
  QA: {
    dashboard: true, inventory: false, warehouse: false, production: true, lab: true,
    bom: false, mrp: false, sales: false, purchasing: false, reports: false,
  },
  EMPLOYEE: {
    dashboard: true, inventory: false, warehouse: false, production: false, lab: false,
    bom: false, mrp: false, sales: false, purchasing: false, reports: false,
  },
};

const ALL_ROLES = Object.values(Role);
const ALL_MODULES = Object.keys(MODULE_PERMISSIONS) as ModuleKey[];

describe("rbac matrix shape", () => {
  it("covers all 9 roles", () => {
    expect(ALL_ROLES).toHaveLength(9);
  });

  it("exposes a predictable set of modules", () => {
    expect(ALL_MODULES).toEqual([
      "dashboard", "inventory", "warehouse", "production", "lab",
      "bom", "mrp", "sales", "purchasing", "reports",
    ]);
  });

  it("never lists a role the enum does not define", () => {
    for (const [module, roles] of Object.entries(MODULE_PERMISSIONS)) {
      for (const role of roles as readonly string[]) {
        expect(ALL_ROLES, `${module} lists unknown role ${role}`).toContain(role as Role);
      }
    }
  });

  it("lists no duplicate roles within a module", () => {
    for (const [module, roles] of Object.entries(MODULE_PERMISSIONS)) {
      expect(new Set(roles as readonly string[]).size, `${module} has duplicates`).toBe((roles as readonly unknown[]).length);
    }
  });
});

describe("canAccess", () => {
  it.each(ALL_ROLES)("%s matches the expected matrix across every module", (role) => {
    for (const module of ALL_MODULES) {
      expect(canAccess(role, module), `${role} -> ${module}`).toBe(EXPECTED[role][module]);
    }
  });

  it("grants ADMINISTRATOR every module", () => {
    for (const module of ALL_MODULES) {
      expect(canAccess(Role.ADMINISTRATOR, module)).toBe(true);
    }
  });

  it("denies an undefined role (signed-out session)", () => {
    for (const module of ALL_MODULES) {
      expect(canAccess(undefined, module)).toBe(false);
    }
  });

  it("grants every role dashboard access", () => {
    for (const role of ALL_ROLES) {
      expect(canAccess(role, "dashboard")).toBe(true);
    }
  });

  it("locks stock-writing modules down to warehouse and production", () => {
    for (const role of [Role.PRODUCTION_MANAGER, Role.WAREHOUSE_MANAGER]) {
      expect(canAccess(role, "inventory")).toBe(true);
      expect(canAccess(role, "warehouse")).toBe(role === Role.WAREHOUSE_MANAGER);
    }
    for (const role of [Role.SALES_STAFF, Role.FINANCE, Role.HR, Role.QA, Role.EMPLOYEE]) {
      expect(canAccess(role, "inventory")).toBe(false);
      expect(canAccess(role, "warehouse")).toBe(false);
    }
  });

  it("keeps BOM authoring to administrators and production managers", () => {
    const allowed = ALL_ROLES.filter((role) => canAccess(role, "bom"));
    expect(allowed).toEqual([Role.ADMINISTRATOR, Role.PRODUCTION_MANAGER]);
  });
});