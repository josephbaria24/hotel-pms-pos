"use client";

import { Button } from "@/components/ui/button";

export default function GuestsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-semibold tracking-tight">Guests &amp; Stays could not load</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "Something went wrong while opening this page."}
      </p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
