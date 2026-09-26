"use client";

import { ItemTable } from "@/features/inventory/components/item-table";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InventoryPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h1 className="text-xl font-semibold tracking-tight">{t.nav.inventory}</h1>
        <p className="text-sm text-muted-foreground">{t.localeName === "العربية" ? "إدارة الأصناف ومستويات المخزون وحدود إعادة الطلب." : "Manage items, stock levels, and reorder thresholds."}</p>
        </div>
        <Link href="/lab"><Button size="sm" variant="outline"><FlaskConical className="h-4 w-4" />{t.localeName === "العربية" ? "اختبارات الخامات" : "Material tests"}</Button></Link>
      </div>
      <ItemTable />
    </div>
  );
}
