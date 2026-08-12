"use client";

import { cn } from "@/lib/utils";
import type { PosOrderStatus, PosTableStatus } from "@/lib/api-client/pos-types";

const orderStatusClass: Record<PosOrderStatus, string> = {
  open: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  held: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  void: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  refunded: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
};

const tableStatusClass: Record<PosTableStatus, string> = {
  available: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35",
  occupied: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/35",
  reserved: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/35",
  dirty: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35",
  inactive: "bg-muted text-muted-foreground border-border",
};

export function PosStatusPill({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function PosOrderStatusBadge({ status }: { status: PosOrderStatus }) {
  return (
    <PosStatusPill
      label={status.replace("_", " ")}
      className={orderStatusClass[status] ?? orderStatusClass.open}
    />
  );
}

export function PosTableStatusBadge({ status }: { status: PosTableStatus }) {
  return (
    <PosStatusPill
      label={status}
      className={tableStatusClass[status] ?? tableStatusClass.available}
    />
  );
}
