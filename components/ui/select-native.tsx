// Lightweight native select fallback for simple filter bars (avoids Radix overhead where not needed)
import * as React from "react";
import { cn } from "@/lib/utils";

const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn("h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring", className)}
      {...props}
    >
      {children}
    </select>
  )
);
NativeSelect.displayName = "NativeSelect";
export { NativeSelect };
