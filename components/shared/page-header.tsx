"use client";

import { cn } from "@/lib/utils";

/**
 * The one page-title block used by every dashboard route.
 *
 * Before this there were three spellings of the same idea (a bare `h1` here, a
 * `flex items-center` there, a `flex-wrap items-start` somewhere else), so two
 * pages a click apart had different title sizes and different gaps to their
 * actions. Title size, weight, tracking and the spacing down to the content are
 * fixed here; pages only choose their description and their actions.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
