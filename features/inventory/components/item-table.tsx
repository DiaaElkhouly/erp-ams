"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { Trash2, PackageX, Pencil, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/select-native";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { SortableHead, TablePagination } from "@/components/shared/data-table";
import { Toolbar, ToolbarSearch } from "@/components/shared/toolbar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ITEMS_PAGE_SIZE, useDeleteItem, useItems } from "../hooks/use-items";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import type { Item, ItemSortField } from "../services/item-service";
import { formatCurrency } from "@/lib/utils";
import { ItemFormDialog } from "./item-form-dialog";
import { ItemEditDialog } from "./item-edit-dialog";
import { useI18n } from "@/lib/i18n";

const TYPE_VARIANT: Record<string, "default" | "secondary" | "success" | "warning"> = {
  RAW_MATERIAL: "secondary",
  COMPONENT: "default",
  FINISHED_GOOD: "success",
  CONSUMABLE: "warning",
};

const ITEM_TYPES = ["RAW_MATERIAL", "COMPONENT", "FINISHED_GOOD", "CONSUMABLE"] as const;

const onHandOf = (item: Item) => item.stockLevels.reduce((sum, level) => sum + level.quantity, 0);

export function ItemTable() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search);
  const [typeFilter, setTypeFilter] = useState<"" | Item["type"]>("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: ITEMS_PAGE_SIZE });
  const [editing, setEditing] = useState<Item | null>(null);

  const sortBy = sorting[0]?.id as ItemSortField | undefined;
  const sortDir = sorting[0]?.desc ? "desc" : "asc";

  const { data, isLoading, isFetching, isError, error, refetch } = useItems({
    q: query,
    type: typeFilter || undefined,
    isActive: statusFilter === "" ? undefined : statusFilter === "active",
    lowStock: lowStockOnly || undefined,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortDir,
  });
  const { mutate: deleteItem } = useDeleteItem();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));

  const hasFilters = typeFilter !== "" || statusFilter !== "" || lowStockOnly || search !== "";
  const activeFilterCount = [typeFilter !== "", statusFilter !== "", lowStockOnly, search !== ""].filter(Boolean).length;

  // Any filter change invalidates the current slice: page 4 of the old filter is
  // an arbitrary page of the new one. Reset to the first page in one place.
  function resetToFirstPage() {
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setLowStockOnly(false);
    resetToFirstPage();
  }

  const typeLabel = (type: Item["type"]) =>
    type === "RAW_MATERIAL" ? t.common.rawMaterial
    : type === "FINISHED_GOOD" ? t.common.finishedGood
    : type === "COMPONENT" ? t.common.component
    : t.common.consumable;

  // onHand is derived client-side for display but ordered by the server, which
  // sums StockLevel rows across warehouses. Both must agree or the arrows lie.
  const columns = useMemo<ColumnDef<Item>[]>(() => [
    {
      accessorKey: "sku",
      header: t.common.sku,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku}</span>,
    },
    { accessorKey: "name", header: t.common.name, cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{row.original.name}</span>
        {/* The type badge is the only other cell that fits under the name on a
            phone, so it is repeated here and hidden once the column returns. */}
        <span className="sm:hidden">
          <Badge variant={TYPE_VARIANT[row.original.type]}>{typeLabel(row.original.type)}</Badge>
        </span>
      </div>
    ) },
    {
      accessorKey: "type",
      header: t.common.type,
      meta: { align: "start", hideBelow: "sm" },
      cell: ({ row }) => <Badge variant={TYPE_VARIANT[row.original.type]}>{typeLabel(row.original.type)}</Badge>,
    },
    {
      id: "onHand",
      accessorFn: onHandOf,
      header: t.common.onHand,
      meta: { align: "end", numeric: true },
      cell: ({ row }) => {
        const onHand = onHandOf(row.original);
        const low = onHand <= row.original.reorderPoint;
        return (
          <span
            className={
              low
                ? "inline-flex items-center gap-1 font-semibold tabular-nums text-destructive"
                : "tabular-nums"
            }
            title={low ? t.common.lowStock : undefined}
          >
            {low && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
            {onHand} {row.original.unit}
          </span>
        );
      },
    },
    {
      accessorKey: "reorderPoint",
      header: t.common.reorderPt,
      meta: { align: "end", hideBelow: "md", numeric: true },
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.reorderPoint}</span>,
    },
    {
      accessorKey: "costPrice",
      header: t.common.cost,
      meta: { align: "end", hideBelow: "lg", numeric: true },
      cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.costPrice)}</span>,
    },
    {
      accessorKey: "salePrice",
      header: t.common.price,
      meta: { align: "end", hideBelow: "lg", numeric: true },
      cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.salePrice)}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t.common.actions}</span>,
      enableSorting: false,
      meta: { align: "end" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => setEditing(row.original)} aria-label={t.common.edit}>
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </Button>
          <ConfirmDialog
            title={t.common.confirmDeleteTitle.replace("{entity}", row.original.name)}
            description={t.common.confirmDeleteBody}
            confirmLabel={t.common.confirmDeleteConfirm}
            cancelLabel={t.common.confirmDeleteCancel}
            onConfirm={() => deleteItem(row.original.id)}
          >
            <Button variant="ghost" size="icon" aria-label={t.common.delete}>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </ConfirmDialog>
        </div>
      ),
    },
  ], [t, deleteItem]);

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, pagination },
    // Both are the server's job: the rows on screen are one page, and the
    // server knows the real row count and the real sort order.
    manualPagination: true,
    manualSorting: true,
    pageCount,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: (updater) => {
      setSorting((current) => (typeof updater === "function" ? updater(current) : updater));
      // A sorted list is re-read from offset 0; staying on page 5 of a new order
      // would show an arbitrary slice.
      setPagination((current) => ({ ...current, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
  });

  const colSpan = table.getVisibleLeafColumns().length;

  return (
    <div className="space-y-4">
      <Toolbar
        actions={
          <>
            {hasFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                {t.common.clearFilters}
              </Button>
            ) : null}
            <ItemFormDialog />
          </>
        }
      >
        <ToolbarSearch
          value={search}
          onChange={(value) => {
            setSearch(value);
            resetToFirstPage();
          }}
          placeholder={t.common.search}
        />

        <NativeSelect
          aria-label={t.common.type}
          className="w-full sm:w-40"
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(event.target.value as Item["type"] | "");
            resetToFirstPage();
          }}
        >
          <option value="">{t.common.allTypes}</option>
          {ITEM_TYPES.map((type) => (
            <option key={type} value={type}>{typeLabel(type)}</option>
          ))}
        </NativeSelect>

        <NativeSelect
          aria-label={t.common.status}
          className="w-full sm:w-36"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as "" | "active" | "inactive");
            resetToFirstPage();
          }}
        >
          <option value="">{t.common.allStatus}</option>
          <option value="active">{t.common.activeOnly}</option>
          <option value="inactive">{t.common.inactiveOnly}</option>
        </NativeSelect>

        <Button
          type="button"
          variant={lowStockOnly ? "secondary" : "outline"}
          size="sm"
          aria-pressed={lowStockOnly}
          onClick={() => {
            setLowStockOnly((current) => !current);
            resetToFirstPage();
          }}
        >
          <AlertTriangle className="h-4 w-4" />
          {t.common.lowStockOnly}
        </Button>
      </Toolbar>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const hideBelow = header.column.columnDef.meta?.hideBelow;
                  const hideClass = hideBelow ? `hidden ${hideBelow}:table-cell` : undefined;
                  return canSort ? (
                    <SortableHead
                      key={header.id}
                      column={header.column}
                      align={header.column.columnDef.meta?.align}
                      className={hideClass}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </SortableHead>
                  ) : (
                    <TableHead key={header.id} className={hideClass ? `${hideClass} text-end` : "text-end"}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {table.getVisibleLeafColumns().map((column) => (
                  <TableCell key={column.id} className="py-3"><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}

            {!isLoading && isError && (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
                  <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive" />
                  <p>{error instanceof Error ? error.message : t.common.noData}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
                    {t.common.resetFilters}
                  </Button>
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
                  <PackageX className="mx-auto mb-2 h-6 w-6" />
                  {hasFilters ? t.common.noResults : t.common.noItems}
                  {hasFilters ? (
                    <div className="mt-3">
                      <Button variant="outline" size="sm" onClick={clearFilters}>{t.common.clearFilters}</Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={editing?.id === row.original.id ? "bg-muted/50" : undefined}>
                {row.getVisibleCells().map((cell) => {
                  const hideBelow = cell.column.columnDef.meta?.hideBelow;
                  const hideClass = hideBelow ? `hidden ${hideBelow}:table-cell` : undefined;
                  return (
                    <TableCell key={cell.id} className={hideClass}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Filter feedback doubles as the "stale rows" hint: rows are dimmed, not
          replaced, while a fetch is in flight, and this says why. */}
      <div className="flex items-center gap-2">
        {isFetching && !isLoading && (
          <span className="text-xs text-muted-foreground" role="status">{t.common.updating}</span>
        )}
        {activeFilterCount > 0 && !isFetching && (
          <span className="text-xs text-muted-foreground">
            {t.common.resultsCount.replace("{count}", String(total))}
          </span>
        )}
      </div>

      <TablePagination
        page={pagination.pageIndex + 1}
        pageCount={pageCount}
        pageSize={pagination.pageSize}
        total={total}
        onPageChange={(page) => setPagination((current) => ({ ...current, pageIndex: page - 1 }))}
        onPageSizeChange={(pageSize) => setPagination({ pageIndex: 0, pageSize })}
      />

      <ItemEditDialog item={editing} onOpenChange={(open) => !open && setEditing(null)} />
    </div>
  );
}