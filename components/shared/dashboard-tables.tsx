"use client";

import { useState } from "react";
import { Package, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/shared/data-table";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_CURRENCY, formatMoney, formatNumber, formatPercent } from "@/lib/utils";

const money = (value: number) => formatMoney(value, DEFAULT_CURRENCY);

function cnProfit(value: number) {
  return `tabular-nums font-medium ${value < 0 ? "text-destructive" : "text-success"}`;
}

function MarginBadge({ value }: { value: number }) {
  if (value >= 25) return <Badge variant="success">{formatPercent(value)}</Badge>;
  if (value >= 10) return <Badge variant="warning">{formatPercent(value)}</Badge>;
  if (value < 0) return <Badge variant="destructive">{formatPercent(value)}</Badge>;
  return <Badge variant="secondary">{formatPercent(value)}</Badge>;
}

function usePagination(total: number) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return { page, pageSize, pageCount, setPage, setPageSize };
}

export function ProductsTable({ products }: { products: any[] }) {
  const { t } = useI18n();
  const { page, pageSize, pageCount, setPage, setPageSize } = usePagination(products.length);
  const paged = products.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.item}</TableHead>
              <TableHead>{t.dashboard.units}</TableHead>
              <TableHead>{t.common.revenue}</TableHead>
              <TableHead>{t.common.cost}</TableHead>
              <TableHead>{t.dashboard.profit}</TableHead>
              <TableHead>{t.dashboard.margin}</TableHead>
              <TableHead>{t.dashboard.revenueShare}</TableHead>
              <TableHead>{t.dashboard.avgSellingPrice}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((product) => (
              <TableRow key={product.sku}>
                <TableCell>
                  <div className="font-medium">{product.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{product.sku}</div>
                </TableCell>
                <TableCell className="tabular-nums">{formatNumber(product.unitsSold, 0)} {product.unit}</TableCell>
                <TableCell className="tabular-nums font-medium">{money(product.revenue)}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{money(product.cogs)}</TableCell>
                <TableCell className={cnProfit(product.profit)}>{money(product.profit)}</TableCell>
                <TableCell>
                  <MarginBadge value={product.marginPct} />
                </TableCell>
                <TableCell className="tabular-nums">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, product.revenueSharePct)}%` }} />
                    </div>
                    <span className="tabular-nums text-xs">{formatPercent(product.revenueSharePct)}</span>
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">{money(product.avgSellingPrice)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        total={products.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
    </div>
  );
}

export function CustomersTable({ customers }: { customers: any[] }) {
  const { t } = useI18n();
  const { page, pageSize, pageCount, setPage, setPageSize } = usePagination(customers.length);
  const paged = customers.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.customer}</TableHead>
              <TableHead>{t.dashboard.orders}</TableHead>
              <TableHead>{t.common.revenue}</TableHead>
              <TableHead>{t.dashboard.profit}</TableHead>
              <TableHead>{t.dashboard.margin}</TableHead>
              <TableHead>{t.common.share}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((customer) => (
              <TableRow key={customer.name}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    {customer.name}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">{formatNumber(customer.orderCount, 0)}</TableCell>
                <TableCell className="tabular-nums">{money(customer.revenue)}</TableCell>
                <TableCell className={cnProfit(customer.profit)}>{money(customer.profit)}</TableCell>
                <TableCell><MarginBadge value={customer.marginPct} /></TableCell>
                <TableCell className="tabular-nums">{formatPercent(customer.revenueSharePct)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        total={customers.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
    </div>
  );
}

export function SuppliersTable({ suppliers }: { suppliers: any[] }) {
  const { t } = useI18n();
  const { page, pageSize, pageCount, setPage, setPageSize } = usePagination(suppliers.length);
  const paged = suppliers.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.supplier}</TableHead>
              <TableHead>{t.dashboard.orders}</TableHead>
              <TableHead>{t.dashboard.purchasesValue}</TableHead>
              <TableHead>{t.common.share}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((supplier) => (
              <TableRow key={supplier.name}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell className="tabular-nums">{formatNumber(supplier.orderCount, 0)}</TableCell>
                <TableCell className="tabular-nums">{money(supplier.purchases)}</TableCell>
                <TableCell className="tabular-nums">{formatPercent(supplier.sharePct)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        total={suppliers.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
    </div>
  );
}

export function InventoryTable({ rows }: { rows: any[] }) {
  const { t } = useI18n();
  const { page, pageSize, pageCount, setPage, setPageSize } = usePagination(rows.length);
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.item}</TableHead>
              <TableHead>{t.dashboard.inventoryQty}</TableHead>
              <TableHead>{t.dashboard.inventoryValue}</TableHead>
              <TableHead>{t.dashboard.inventoryShare}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((row) => (
              <TableRow key={row.sku}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{row.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.sku}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">{formatNumber(row.qty, 0)}</TableCell>
                <TableCell className="tabular-nums font-medium">{money(row.value)}</TableCell>
                <TableCell className="tabular-nums">{formatPercent(row.sharePct)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        total={rows.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
    </div>
  );
}
