import "./env";
import bcrypt from "bcryptjs";
import { ItemType, Role, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { applyMovement, defaultWarehouseId } from "@/lib/inventory/stock-service";

/**
 * The single happy path this suite covers: a sales order created in the browser,
 * advanced to FULFILLED in the browser, and the stock movement that fulfilment
 * owes the warehouse. Everything here exists to feed that one flow.
 *
 * These are dedicated rows rather than the demo seed's, for two reasons. The
 * suite then runs off a bare `prisma migrate deploy` instead of a 425-day
 * history seed, and nothing the test writes can collide with data a developer is
 * looking at. Every field is addressed by a unique key, so `ensureFixtures` is
 * safe to call before every run.
 */
export const E2E_ADMIN = { email: "e2e-admin@ims.local", password: "E2e-Admin-123!" } as const;

export const E2E_CUSTOMER = { name: "E2E Retailer" } as const;

export const E2E_ITEM = {
  sku: "FG-E2E-0001",
  name: "E2E Calibration Widget",
  type: ItemType.FINISHED_GOOD,
  unit: "pcs",
  costPrice: 40,
  salePrice: 100,
  reorderPoint: 5,
  reorderQty: 50,
} as const;

/** Units the test orders. Small, so repeated runs never drain the bin. */
export const E2E_ORDER_QTY = 3;

/** The fixture tops the bin back up to this, so a re-run after a failure still passes. */
const TARGET_ON_HAND = 500;

/**
 * `refType` on the fixture's own ledger rows. A sales order is referenced as
 * "SALES_ORDER", so setup movements can never be mistaken for a real document's.
 */
const SETUP_REF_TYPE = "E2E_SETUP";

export type E2eFixtures = {
  admin: { id: string; email: string; password: string };
  customerId: string;
  item: { id: string; sku: string; name: string; salePrice: number };
  /** The bin the fulfilment route will actually draw from. */
  warehouseId: string;
};

/**
 * Brings the fixture rows up to date and returns their identifiers.
 *
 * Idempotent by construction, not by a "has this run before" flag: the user is
 * re-upserted with a fresh hash, the stock bin is topped up only when it has
 * fallen below target, and the customer is matched on name because `Customer`
 * has no unique constraint to upsert against.
 */
export async function ensureFixtures(): Promise<E2eFixtures> {
  const passwordHash = await bcrypt.hash(E2E_ADMIN.password, 10);

  const admin = await db.user.upsert({
    where: { email: E2E_ADMIN.email },
    // Rewritten rather than left alone: a stale hash or an `isActive` flag
    // cleared by some other test would fail the login for reasons that have
    // nothing to do with the application.
    update: { passwordHash, role: Role.ADMINISTRATOR, isActive: true },
    create: {
      name: "E2E Administrator",
      email: E2E_ADMIN.email,
      passwordHash,
      role: Role.ADMINISTRATOR,
    },
    select: { id: true },
  });

  const customer =
    (await db.customer.findFirst({ where: { name: E2E_CUSTOMER.name }, select: { id: true } })) ??
    (await db.customer.create({
      data: { name: E2E_CUSTOMER.name, email: "e2e-buyer@example.test" },
      select: { id: true },
    }));

  const item = await db.item.upsert({
    where: { sku: E2E_ITEM.sku },
    update: {},
    create: { ...E2E_ITEM },
    select: { id: true, sku: true, name: true, salePrice: true },
  });

  const warehouseId = await db.$transaction(async (tx) => {
    // Resolved with the same helper the fulfilment route uses. A sales order
    // names no warehouse, so stock has to sit in the one that route will pick -
    // the oldest active one - or the fulfilment 409s on insufficient stock.
    const resolved = await defaultWarehouseId(tx);
    await ensureOnHand(tx, item.id, resolved);
    return resolved;
  });

  return {
    admin: { id: admin.id, email: E2E_ADMIN.email, password: E2E_ADMIN.password },
    customerId: customer.id,
    item: { id: item.id, sku: item.sku, name: item.name, salePrice: Number(item.salePrice) },
    warehouseId,
  };
}

/**
 * Writes the opening balance through `applyMovement` rather than upserting
 * `stock_levels` directly. The projection is supposed to be the running sum of
 * the ledger, and a fixture that edits it behind the service's back would let a
 * real reconciliation bug pass this suite.
 */
async function ensureOnHand(tx: Prisma.TransactionClient, itemId: string, warehouseId: string) {
  const level = await tx.stockLevel.findUnique({
    where: { itemId_warehouseId: { itemId, warehouseId } },
    select: { quantity: true },
  });

  const onHand = level?.quantity ?? 0;
  if (onHand >= TARGET_ON_HAND) return;

  await applyMovement(tx, {
    itemId,
    warehouseId,
    qtyDelta: TARGET_ON_HAND - onHand,
    reason: "OPENING_BALANCE",
    refType: SETUP_REF_TYPE,
    refId: E2E_ITEM.sku,
    note: "E2E fixture opening balance",
  });
}