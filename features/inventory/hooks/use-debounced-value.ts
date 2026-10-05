"use client";

import { useEffect, useState } from "react";

/**
 * Trails `value` by `delay` ms.
 *
 * The item list sends the search term as a query key, so without this every
 * keystroke is a request and the server's result arrives out of order.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}