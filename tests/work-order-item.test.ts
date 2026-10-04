import { describe, expect, it } from "vitest";
import { resolveWorkOrderItem } from "@/lib/work-order-item";

/**
 * Regression cover for the T0.1 corruption: the production dialog used to send
 * `Bom.components[0].item.id`, so completing the order credited cement stock
 * instead of the finished good.
 *
 * Since T1.3 the finished good is `Bom.finishedItemId` rather than a sku string,
 * so the rule no longer performs a lookup - it only has to decide whether to
 * trust what the client sent.
 */

const CEMENT_ID = "item-cement";
const BLOCK_ID = "item-block-20";

/** The BOM's first component, i.e. what the broken dialog sent. */
const FIRST_COMPONENT_ID = CEMENT_ID;

describe("resolveWorkOrderItem", () => {
  it("resolves the finished good when the client sends no itemId", () => {
    expect(resolveWorkOrderItem(BLOCK_ID, undefined)).toEqual({
      status: "resolved",
      itemId: BLOCK_ID,
    });
  });

  it("accepts a client itemId that is already the finished good", () => {
    expect(resolveWorkOrderItem(BLOCK_ID, BLOCK_ID)).toEqual({
      status: "resolved",
      itemId: BLOCK_ID,
    });
  });

  it("rejects a raw material itemId rather than trusting it", () => {
    expect(resolveWorkOrderItem(BLOCK_ID, FIRST_COMPONENT_ID)).toEqual({
      status: "item-id-mismatch",
      finishedItemId: BLOCK_ID,
    });
  });

  it("rejects any itemId that is not the finished good", () => {
    expect(resolveWorkOrderItem(BLOCK_ID, "item-sand").status).toBe("item-id-mismatch");
  });

  it("treats an empty itemId as unspecified rather than as a mismatch", () => {
    expect(resolveWorkOrderItem(BLOCK_ID, "").status).toBe("resolved");
  });

  it("reports an unknown finished item before it reports a mismatch", () => {
    // Unreachable through the FK, which cannot be null; guarded so a bad query in a
    // future caller degrades into an explicit error instead of a null itemId.
    expect(resolveWorkOrderItem(undefined, FIRST_COMPONENT_ID)).toEqual({
      status: "unknown-finished-item",
      finishedItemId: "",
    });
    expect(resolveWorkOrderItem(null, undefined).status).toBe("unknown-finished-item");
  });

  it("never returns a BOM component as the item to produce", () => {
    const resolved = resolveWorkOrderItem(BLOCK_ID, FIRST_COMPONENT_ID);
    expect(resolved.status).not.toBe("resolved");
    expect(JSON.stringify(resolved)).not.toContain(CEMENT_ID);
  });
});