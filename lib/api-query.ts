/**
 * Query-string parsing for the list endpoints: page, pageSize, sortBy, sortDir.
 *
 * Kept out of the route handlers so it can be unit tested without a database,
 * and so every list endpoint clamps the same way. An unbounded pageSize is a
 * denial-of-service lever: one request could ask for every row in the table.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

export type SortDirection = "asc" | "desc";

export type Paging = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

/**
 * Reads `page` / `pageSize` and clamps both. Junk falls back to the defaults
 * rather than 400-ing: a bookmarked URL with `?page=abc` should still render.
 */
export function parsePaging(
  searchParams: URLSearchParams,
  { defaultPageSize = DEFAULT_PAGE_SIZE, maxPageSize = MAX_PAGE_SIZE } = {}
): Paging {
  const rawPage = Number.parseInt(searchParams.get("page") ?? "", 10);
  const rawPageSize = Number.parseInt(searchParams.get("pageSize") ?? "", 10);

  const pageSize = Number.isFinite(rawPageSize)
    ? Math.min(Math.max(rawPageSize, 1), maxPageSize)
    : Math.min(Math.max(defaultPageSize, 1), maxPageSize);
  const page = Number.isFinite(rawPage) ? Math.max(rawPage, 1) : 1;

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export type Sort<T extends string = string> = { sortBy: T | null; sortDir: SortDirection };

/**
 * Resolves `sortBy` against a caller-supplied allowlist.
 *
 * `sortBy` is interpolated into `orderBy`, so it is never trusted from the
 * request: an unknown key silently falls back to `null` and the route's default
 * ordering applies. Returning null rather than throwing keeps a stale bookmark
 * or a renamed column from turning into a 500.
 */
export function parseSort<T extends string>(
  searchParams: URLSearchParams,
  allowed: readonly T[],
  { defaultSortBy = null as T | null, defaultSortDir = "asc" as SortDirection } = {}
): Sort<T> {
  const requested = searchParams.get("sortBy");
  const sortBy = requested && (allowed as readonly string[]).includes(requested) ? (requested as T) : defaultSortBy;

  const requestedDir = searchParams.get("sortDir")?.toLowerCase();
  const sortDir: SortDirection = requestedDir === "desc" || requestedDir === "asc" ? requestedDir : defaultSortDir;

  return { sortBy, sortDir };
}

/**
 * Page count for a `total` that the client cannot trust to be in sync.
 *
 * `useReactTable` clamps its own index into the last page, but it needs a
 * pageCount up front; a stale cached page 5 of a now-3-page list would render
 * blank if we trusted the request's page number.
 */
export function clampPage(page: number, total: number, pageSize: number): number {
  const pageCount = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  if (pageCount === 0) return 1;
  return Math.min(Math.max(page, 1), pageCount);
}