import { ensureFixtures } from "./fixtures";

/**
 * Runs once, before the suite.
 *
 * The fixtures are ensured here rather than in the app's own seed so the E2E
 * needs only `prisma migrate deploy` - the seed builds months of demo history
 * that this one happy path has no use for.
 */
export default async function globalSetup() {
  const { item, warehouseId } = await ensureFixtures();
  console.log(`e2e fixtures ready: ${item.sku} in warehouse ${warehouseId}`);
}