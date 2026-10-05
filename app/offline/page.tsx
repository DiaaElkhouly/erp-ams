import React from "react";

export default function OfflineFallback() {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center p-4 text-center">
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page requires an internet connection and couldn&apos;t be loaded.
      </p>
    </div>
  );
}
