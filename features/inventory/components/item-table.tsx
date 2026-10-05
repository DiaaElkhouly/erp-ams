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
import { Search, Trash2, PackageX, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { SortableHead, TablePagination } from "@/components/shared/data-table";
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

const onHandOf = (item: Item) => item.stockLevels.reduce((sum, level) => sum + level.quantity, 0);

export function ItemTable() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search);
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: ITEMS_PAGE_SIZE });
  const [editing, setEditing] = useState<Item | null>(null);

  const sortBy = sorting[0]?.id as ItemSortField | undefined;
  const sortDir = sorting[0]?.desc ? "desc" : "asc";

  const { data, isLoading, isFetching } = useItems({
    q: query,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    sortBy,
    sortDir,
  });
  const { mutate: deleteItem } = useDeleteItem();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));

  // onHand is derived client-side for display but ordered by the server, which
  // sums StockLevel rows across warehouses. Both must agree or the arrows lie.
  const columns = useMemo<ColumnDef<Item>[]>(() => [
    {
      accessorKey: "sku",
      header: t.common.sku,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku}</span>,
    },
    { accessorKey: "name", header: t.common.name, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    {
      accessorKey: "type",
      header: t.common.type,
      cell: ({ row }) => {
        const type = row.original.type;
        const label =
          type === "RAW_MATERIAL" ? t.common.rawMaterial
          : type === "FINISHED_GOOD" ? t.common.finishedGood
          : type === "COMPONENT" ? t.common.component
          : t.common.consumable;
        return <Badge variant={TYPE_VARIANT[type]}>{label}</Badge>;
      },
    },
    {
      id: "onHand",
      accessorFn: onHandOf,
      header: t.common.onHand,
      cell: ({ row }) => {
        const onHand = onHandOf(row.original);
        const low = onHand <= row.original.reorderPoint;
        return (
          <span className={low ? "font-semibold text-destructive" : ""}>
            {onHand} {row.original.unit}
          </span>
        );
      },
    },
    {
      accessorKey: "reorderPoint",
      header: t.common.reorderPt,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.reorderPoint}</span>,
    },
    {
      accessorKey: "costPrice",
      header: t.common.cost,
      meta: { align: "end" },
      cell: ({ row }) => formatCurrency(row.original.costPrice),
    },
    {
      accessorKey: "salePrice",
      header: t.common.price,
      meta: { align: "end" },
      cell: ({ row }) => formatCurrency(row.original.salePrice),
    },
    {
      id: "actions",
      header: t.common.actions,
      enableSorting: false,
      meta: { align: "end" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => setEditing(row.original)} aria-label={t.common.edit}>
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => deleteItem(row.original.id)} aria-label={t.common.delete}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.common.search}
            aria-label={t.common.search}
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((current) => ({ ...current, pageIndex: 0 }));
            }}
          />
        </div>
        <ItemFormDialog />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return canSort ? (
                    <SortableHead key={header.id} column={header.column} align={header.column.columnDef.meta?.align}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </SortableHead>
                  ) : (
                    <TableHead key={header.id} className="text-right">
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
                  <TableCell key={column.id}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}

            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-muted-foreground">
                  <PackageX className="mx-auto mb-2 h-6 w-6" />
                  {query ? t.common.noResults : t.common.noItems}
                </TableCell>
              </TableRow>
            )}

            {!isLoading && table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={editing?.id === row.original.id ? "bg-muted/50" : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={pagination.pageIndex + 1}
        pageCount={pageCount}
        pageSize={pagination.pageSize}
        total={total}
        onPageChange={(page) => setPagination((current) => ({ ...current, pageIndex: page - 1 }))}
        onPageSizeChange={(pageSize) => setPagination({ pageIndex: 0, pageSize })}
      />

      {/* Dimmed while a page turn is in flight, so stale rows are not mistaken for fresh ones. */}
      {isFetching && !isLoading && (
        <p className="text-xs text-muted-foreground" role="status">{t.common.updating}</p>
      )}

      <ItemEditDialog item={editing} onOpenChange={(open) => !open && setEditing(null)} />
    </div>
  );
}