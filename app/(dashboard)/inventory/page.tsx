"use client";

import { ItemTable } from "@/features/inventory/components/item-table";
import { PageHeader } from "@/components/shared/page-header";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InventoryPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t.nav.inventory}
        description={t.pages.inventoryDescription}
        actions={
          <Link href="/lab">
            <Button size="sm" variant="outline">
              <FlaskConical className="h-4 w-4" />
              {t.pages.materialTests}
            </Button>
          </Link>
        }
      />
      <ItemTable />
    </div>
  );
}
