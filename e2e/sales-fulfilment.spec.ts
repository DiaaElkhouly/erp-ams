import "./env";
import { expect, test } from "@playwright/test";
import { db } from "@/lib/db";
import { LOCALE_COOKIE } from "@/lib/i18n-messages";
import { E2E_ADMIN, E2E_CUSTOMER, E2E_ORDER_QTY, ensureFixtures } from "./fixtures";

/**
 * The one path this suite covers, end to end: sign in, raise a sales order,
 * fulfil it, and prove the warehouse ledger heard about it.
 *
 * Fulfilment is where inventory used to be wrong - `FULFILLED` used to deduct
 * nothing at all, and a completed work order incremented raw material stock -
 * so the assertion is on the database rather than on the row turning green. A
 * green badge with no `stock_movements` row is exactly the bug this is here to
 * catch.
 */
test("fulfilling a sales order issues a stock movement", async ({ page, context }) => {
  const { item, warehouseId } = await ensureFixtures();

  // The catalog defaults to Arabic, so the locale is pinned to English before the
  // first paint. `I18nProvider` reads localStorage while server components read
  // the cookie it mirrors, so both are seeded here - otherwise every label below
  // is Arabic and the locators silently match nothing.
  await context.addInitScript((key) => {
    window.localStorage.setItem(key, "en");
    document.cookie = `${key}=en; path=/`;
  }, LOCALE_COOKIE);

  await test.step("sign in", async () => {
    await page.goto("/login");
    await page.locator("#email").fill(E2E_ADMIN.email);
    await page.locator("#password").fill(E2E_ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  const order = await test.step("raise a draft sales order", async () => {
    await page.goto("/sales");
    await page.getByRole("button", { name: "New Sales Order" }).click();

    // Radix renders the dialog in a portal, so it is addressed by role rather
    // than by anything inside the page's own subtree.
    const dialog = page.getByRole("dialog");
    await dialog.locator("#sales-order-customer").selectOption({ label: E2E_CUSTOMER.name });

    const itemSelect = dialog.getByLabel("Item 1", { exact: true });
    const option = itemSelect.locator("option", { hasText: item.sku });
    // The item picker is fed by `GET /api/items`, which the sales module key
    // alone would not be allowed to read. Asserting the option exists keeps a
    // permission regression from showing up as an empty dropdown.
    await expect(option).toHaveCount(1);
    // Options are rendered `${sku} - ${name}`. Read the text instead of retyping
    // it, so a formatting change in the picker is not a broken test.
    await itemSelect.selectOption({ label: (await option.textContent())?.trim() ?? "" });

    await dialog.getByLabel("Quantity 1", { exact: true }).fill(String(E2E_ORDER_QTY));
    // Choosing an item copies its sale price onto the line.
    await expect(dialog.getByLabel("Unit price 1", { exact: true })).toHaveValue(String(item.salePrice));

    const posted = page.waitForResponse(
      (response) => response.url().endsWith("/api/sales-orders") && response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Create order" }).click();

    const created = await posted;
    expect(created.status()).toBe(201);
    return (await created.json()) as { id: string; orderNumber: string };
  });

  await test.step("advance it to fulfilled", async () => {
    const row = page.getByRole("row").filter({ hasText: order.orderNumber });
    await expect(row.getByText("Draft", { exact: true })).toBeVisible();

    // The page walks the flow one status per click rather than through a select.
    for (const status of ["Confirmed", "Fulfilled"]) {
      const patched = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/sales-orders/${order.id}`) &&
          response.request().method() === "PATCH",
      );
      await row.getByRole("button", { name: `Move to ${status}` }).click();

      const response = await patched;
      expect(response.status()).toBe(200);
      await expect(row.getByText(status, { exact: true })).toBeVisible();
    }
  });

  await test.step("the warehouse ledger records the issue", async () => {
    const movements = await db.stockMovement.findMany({
      where: { refType: "SALES_ORDER", refId: order.id },
    });

    // One line was sold, so one signed movement - and it leaves stock, it does
    // not add to it.
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      itemId: item.id,
      warehouseId,
      reason: "SALES_ISSUE",
      qtyDelta: -E2E_ORDER_QTY,
    });

    // `stock_levels` is a projection of the ledger, so the two can only agree if
    // the movement and the on-hand update committed in the same transaction.
    const [level, ledger] = await Promise.all([
      db.stockLevel.findUnique({
        where: { itemId_warehouseId: { itemId: item.id, warehouseId } },
        select: { quantity: true },
      }),
      db.stockMovement.aggregate({
        where: { itemId: item.id, warehouseId },
        _sum: { qtyDelta: true },
      }),
    ]);

    expect(level?.quantity).toBe(ledger._sum.qtyDelta);
  });
});