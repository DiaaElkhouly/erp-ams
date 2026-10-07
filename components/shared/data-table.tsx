"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { Column, RowData } from "@tanstack/react-table";
import { TableHead } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select-native";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Passed through to SortableHead so numeric columns can right-align. */
    align?: "start" | "end" | "center";
    /** Right-aligns and uses tabular figures so digit columns line up. */
    numeric?: boolean;
    /** Hides the column below this Tailwind breakpoint (e.g. "md"). */
    hideBelow?: "sm" | "md" | "lg" | "xl";
  }
}

/**
 * A table header cell that toggles its column's sort.
 *
 * `aria-sort` is what a screen reader announces, and it belongs on the `th`, not
 * on the button inside it. Arrow direction follows the document: in RTL a
 * descending sort reads right-to-left, so the icons are mirrored by CSS rather
 * than hard-coded here.
 */
export function SortableHead<TData>({
  column,
  className,
  align = "start",
  children,
}: {
  column: Column<TData, unknown>;
  className?: string;
  align?: "start" | "end" | "center";
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const sorted = column.getIsSorted();
  const label = String(children);

  return (
    <TableHead
      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
      className={cn("p-0", align !== "start" && "text-right", className)}
    >
      <button
        type="button"
        onClick={column.getToggleSortingHandler()}
        title={t.common.sortBy.replace("{column}", label)}
        className={cn(
          "flex h-10 w-full items-center gap-1 px-2 transition-colors hover:text-foreground",
          align === "end" && "justify-end",
          align === "center" && "justify-center",
          !sorted && "text-muted-foreground"
        )}
      >
        {children}
        {sorted === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5 shrink-0 text-foreground rtl:rotate-180" />
        ) : sorted === "desc" ? (
          <ArrowDown className="h-3.5 w-3.5 shrink-0 text-foreground rtl:rotate-180" />
        ) : null}
      </button>
    </TableHead>
  );
}

/**
 * Server-driven page controls.
 *
 * `pageCount` and `total` come from the response rather than from the row count,
 * because the table is in manual mode: the rows on screen are one page of the
 * whole result set, not all of it.
 */
export function TablePagination({
  page,
  pageCount,
  pageSize,
  total,
  pageSizeOptions = [10, 20, 50, 100],
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const { t } = useI18n();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground tabular-nums">
        {t.common.rowsShown.replace("{from}", String(from)).replace("{to}", String(to)).replace("{total}", String(total))}
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t.common.rowsPerPage}
          <NativeSelect
            aria-label={t.common.rowsPerPage}
            className="h-8 w-20"
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={String(option)}>{option}</option>
            ))}
          </NativeSelect>
        </label>

        <span className="text-xs text-muted-foreground tabular-nums">
          {t.common.pageOf.replace("{page}", String(page)).replace("{pageCount}", String(Math.max(pageCount, 1)))}
        </span>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPageChange(1)} aria-label={t.common.firstPage}>
            <ChevronsLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={t.common.previousPage}>
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} aria-label={t.common.nextPage}>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pageCount} onClick={() => onPageChange(pageCount)} aria-label={t.common.lastPage}>
            <ChevronsRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
}