"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The filter/tool strip that sits directly above a table.
 *
 * `start` holds search and filters (they wrap on narrow screens), `end` holds
 * the primary action. Keeping this in one place is what stops the search input
 * from being a different height than the select next to it — both are pinned to
 * the same `h-8` control size via the `[&_input]:h-8` / `[&_select]:h-8` child
 * rules, so a caller cannot accidentally reintroduce the mismatch.
 */
export function Toolbar({
  children,
  actions,
  className,
}: {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 [&_input]:h-8 [&_select]:h-8",
        className,
      )}
    >
      {children}
      {actions ? (
        <div className="ms-auto flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/**
 * The search box used inside a Toolbar. The label is visually hidden but real,
 * so the field is announced rather than being an unlabelled text box.
 */
export function ToolbarSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        className="ps-8"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
