import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  clampPage,
  parsePaging,
  parseSort,
} from "@/lib/api-query";
import { assertUploadAllowed, buildObjectKey, isUploadKind } from "@/lib/storage/s3";

const params = (query: string) => new URLSearchParams(query);

describe("parsePaging", () => {
  it("falls back to defaults when nothing is supplied", () => {
    expect(parsePaging(params(""))).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, skip: 0, take: DEFAULT_PAGE_SIZE });
  });

  it("computes skip from the requested page", () => {
    expect(parsePaging(params("page=3&pageSize=25"))).toEqual({ page: 3, pageSize: 25, skip: 50, take: 25 });
  });

  it("caps pageSize so one request cannot ask for the whole table", () => {
    expect(parsePaging(params("pageSize=100000")).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it("treats zero and negative values as out of range rather than skipping rows", () => {
    const zero = parsePaging(params("page=0&pageSize=0"));
    expect(zero).toMatchObject({ page: 1, pageSize: 1, skip: 0 });

    const negative = parsePaging(params("page=-5&pageSize=-10"));
    expect(negative).toMatchObject({ page: 1, pageSize: 1 });
  });

  it("renders a bookmarked URL with junk params instead of throwing", () => {
    expect(parsePaging(params("page=abc&pageSize=abc"))).toMatchObject({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it("honours a route-specific maximum page size", () => {
    expect(parsePaging(params("pageSize=500"), { defaultPageSize: 10, maxPageSize: 50 })).toMatchObject({
      pageSize: 50,
      take: 50,
    });
  });
});

describe("parseSort", () => {
  const allowed = ["sku", "name", "costPrice"] as const;

  it("accepts an allowlisted column", () => {
    expect(parseSort(params("sortBy=costPrice&sortDir=desc"), allowed)).toEqual({ sortBy: "costPrice", sortDir: "desc" });
  });

  it("drops a column that is not on the allowlist", () => {
    // sortBy is interpolated into orderBy, so an unknown key must never reach it.
    expect(parseSort(params("sortBy=drop%20table"), allowed).sortBy).toBeNull();
  });

  it("falls back to null for an unknown direction", () => {
    expect(parseSort(params("sortDir=sideways"), allowed).sortDir).toBe("asc");
  });

  it("applies the caller's default when no column was requested", () => {
    expect(parseSort(params(""), allowed, { defaultSortBy: "sku", defaultSortDir: "desc" })).toEqual({
      sortBy: "sku",
      sortDir: "desc",
    });
  });
});

describe("clampPage", () => {
  it("keeps a page inside the available range", () => {
    expect(clampPage(2, 95, 20)).toBe(2);
    expect(clampPage(9, 95, 20)).toBe(5);
    expect(clampPage(0, 95, 20)).toBe(1);
  });

  it("returns page 1 for an empty result rather than page 0", () => {
    expect(clampPage(3, 0, 20)).toBe(1);
  });

  it("survives a zero page size without dividing by it", () => {
    expect(clampPage(4, 100, 0)).toBe(1);
  });
});

describe("upload kinds", () => {
  it("recognises only the configured kinds", () => {
    expect(isUploadKind("item-photo")).toBe(true);
    expect(isUploadKind("po-document")).toBe(true);
    expect(isUploadKind("../../../etc/passwd")).toBe(false);
    expect(isUploadKind(null)).toBe(false);
  });
});

describe("buildObjectKey", () => {
  it("never carries the caller's filename into the key", () => {
    const key = buildObjectKey("item-photo", "../../../etc/passwd");
    expect(key.startsWith("item-photo/")).toBe(true);
    expect(key).not.toContain("..");
    expect(key).not.toContain("passwd");
  });

  it("keeps a real extension and normalises it", () => {
    expect(buildObjectKey("po-document", "quote.PDF")).toMatch(/^po-document\/\d{4}\/\d{2}\/[a-z0-9]+-[a-z0-9]+\.pdf$/);
  });

  it("falls back when the filename has no usable extension", () => {
    expect(buildObjectKey("lab-attachment", "scan")).toMatch(/\.bin$/);
    expect(buildObjectKey("lab-attachment", "archive.php")).toMatch(/\.php$/);
  });

  it("gives every upload its own key", () => {
    expect(buildObjectKey("item-photo", "a.png")).not.toBe(buildObjectKey("item-photo", "a.png"));
  });
});

describe("assertUploadAllowed", () => {
  it("rejects a content type outside the kind's allowlist", () => {
    expect(() => assertUploadAllowed("item-photo", "application/x-msdownload", 1024)).toThrow(/Unsupported/);
  });

  it("rejects an empty file", () => {
    expect(() => assertUploadAllowed("po-document", "application/pdf", 0)).toThrow(/empty/);
  });

  it("rejects a file over the kind's size limit", () => {
    expect(() => assertUploadAllowed("item-photo", "image/png", 5 * 1024 * 1024)).toThrow(/larger than/);
    expect(() => assertUploadAllowed("po-document", "application/pdf", 5 * 1024 * 1024)).not.toThrow();
  });

  it("accepts a normal photo and a normal PDF", () => {
    expect(() => assertUploadAllowed("item-photo", "image/png", 1024)).not.toThrow();
    expect(() => assertUploadAllowed("po-document", "application/pdf", 1024 * 1024)).not.toThrow();
  });
});