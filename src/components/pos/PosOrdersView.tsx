"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ClipboardList,
  RotateCcw,
  Search,
  Store,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PosPageShell } from "@/components/pos/PosPageShell";
import { PosOrderStatusBadge } from "@/components/pos/PosBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  formatPeso,
  usePosOrders,
  useVoidPosOrder,
} from "@/lib/api-client/pos";
import type { PosOrder } from "@/lib/api-client/pos-types";
import { methodLabel } from "@/lib/pos-sales-stats";
import { cn } from "@/lib/utils";

const filters = [
  { id: "active", label: "Open / Held", shortLabel: "Open" },
  { id: "paid", label: "Paid", shortLabel: "Paid" },
  { id: "void", label: "Void", shortLabel: "Void" },
  { id: "all", label: "All", shortLabel: "All" },
] as const;

const filterBadgeClass: Record<string, { idle: string; selected: string }> = {
  active: {
    idle: "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    selected: "border-white/30 bg-white/20 text-white",
  },
  paid: {
    idle: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    selected: "border-white/30 bg-white/20 text-white",
  },
  void: {
    idle: "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    selected: "border-white/30 bg-white/20 text-white",
  },
  all: {
    idle: "border-teal-500/40 bg-teal-500/15 text-teal-700 dark:text-teal-300",
    selected: "border-white/30 bg-white/20 text-white",
  },
};

const DATE_OPTIONS = [
  { id: "all", label: "All dates" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "Last 7 days" },
] as const;

const TYPE_OPTIONS = [
  { id: "all", label: "All types" },
  { id: "walk_in", label: "Walk-in" },
  { id: "dine_in", label: "Dine-in" },
  { id: "takeout", label: "Takeout" },
  { id: "room_charge", label: "Room charge" },
  { id: "other", label: "Other" },
] as const;

const PAY_OPTIONS = [
  { id: "all", label: "All payments" },
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "gcash", label: "GCash" },
  { id: "maya", label: "Maya" },
  { id: "bank_transfer", label: "Bank transfer" },
  { id: "room_charge", label: "Room charge" },
  { id: "other", label: "Other" },
] as const;

function toLocalDayIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDay(dayIso: string, delta: number) {
  const d = new Date(`${dayIso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return toLocalDayIso(d);
}

function orderDay(iso: string) {
  return toLocalDayIso(new Date(iso));
}

function matchesDate(iso: string, range: (typeof DATE_OPTIONS)[number]["id"]) {
  if (range === "all") return true;
  const day = orderDay(iso);
  const today = toLocalDayIso(new Date());
  if (range === "today") return day === today;
  if (range === "yesterday") return day === shiftDay(today, -1);
  const start = shiftDay(today, -6);
  return day >= start && day <= today;
}

function formatOrderWhen(iso: string) {
  const d = new Date(iso);
  const includeYear = d.getFullYear() !== new Date().getFullYear();
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" as const } : {}),
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PosOrdersView() {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("active");
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] =
    useState<(typeof DATE_OPTIONS)[number]["id"]>("all");
  const [typeFilter, setTypeFilter] =
    useState<(typeof TYPE_OPTIONS)[number]["id"]>("all");
  const [payFilter, setPayFilter] =
    useState<(typeof PAY_OPTIONS)[number]["id"]>("all");
  const { data: orders = [], isLoading } = usePosOrders(filter);
  const { data: allOrders = [] } = usePosOrders("all");
  const voidOrder = useVoidPosOrder();
  const { toast } = useToast();
  const [voiding, setVoiding] = useState<PosOrder | null>(null);

  const hasExtraFilters =
    Boolean(query.trim()) ||
    dateFilter !== "all" ||
    typeFilter !== "all" ||
    payFilter !== "all";

  const matchesExtra = (order: PosOrder) => {
    if (!matchesDate(order.openedAt, dateFilter)) return false;
    if (typeFilter !== "all" && order.orderType !== typeFilter) return false;
    if (payFilter !== "all") {
      const paidWith = order.payments.some((p) => p.method === payFilter);
      if (!paidWith) return false;
    }
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      order.orderNumber,
      order.customerName,
      order.tableName,
      order.roomNumber,
      order.notes,
      ...order.items.map((item) => item.productName),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  };

  const filterCounts = useMemo(() => {
    const scoped = allOrders.filter(matchesExtra);
    let paid = 0;
    let voided = 0;
    let active = 0;
    for (const order of scoped) {
      if (order.status === "paid") paid += 1;
      else if (order.status === "void") voided += 1;
      else if (order.status === "open" || order.status === "held") active += 1;
    }
    return {
      active,
      paid,
      void: voided,
      all: scoped.length,
    } as const;
  }, [allOrders, query, dateFilter, typeFilter, payFilter]);

  const sorted = useMemo(
    () =>
      [...orders]
        .filter(matchesExtra)
        .sort(
          (a, b) =>
            new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
        ),
    [orders, query, dateFilter, typeFilter, payFilter],
  );

  const confirmVoid = async () => {
    if (!voiding) return;
    try {
      await voidOrder.mutateAsync(voiding.id);
      toast({ title: "Order voided", description: voiding.orderNumber });
      setVoiding(null);
    } catch (err) {
      toast({
        title: "Could not void order",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const clearExtraFilters = () => {
    setQuery("");
    setDateFilter("all");
    setTypeFilter("all");
    setPayFilter("all");
  };

  return (
    <PosPageShell
      title="Orders"
      description="Open tickets, held orders, and completed sales."
      icon={ClipboardList}
    >
      <div className="space-y-2 sm:space-y-3">
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
          {filters.map((f) => {
            const selected = filter === f.id;
            const count = filterCounts[f.id];
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "inline-flex items-center justify-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors sm:justify-start sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs",
                  selected
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="sm:hidden">{f.shortLabel}</span>
                <span className="hidden sm:inline">{f.label}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4 min-w-4 justify-center rounded-full px-1 text-[9px] font-bold tabular-nums sm:h-5 sm:min-w-5 sm:px-1.5 sm:text-[10px]",
                    selected
                      ? filterBadgeClass[f.id]?.selected
                      : filterBadgeClass[f.id]?.idle,
                  )}
                >
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5 rounded-xl border border-border/70 bg-muted/30 p-2 sm:rounded-2xl sm:bg-card sm:p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:left-3 sm:h-4 sm:w-4" />
            <Input
              className="h-8 bg-background pl-8 text-xs shadow-none sm:h-9 sm:pl-9 sm:text-sm"
              placeholder="Search ticket, guest, table, or item…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            <FilterSelect
              icon={CalendarDays}
              value={dateFilter}
              onValueChange={(v) =>
                setDateFilter(v as (typeof DATE_OPTIONS)[number]["id"])
              }
              placeholder="Date"
              triggerClassName="sm:w-[150px]"
            >
              {DATE_OPTIONS.map((opt) => (
                <FilterItem key={opt.id} value={opt.id} icon={CalendarDays}>
                  {opt.label}
                </FilterItem>
              ))}
            </FilterSelect>
            <FilterSelect
              icon={Store}
              value={typeFilter}
              onValueChange={(v) =>
                setTypeFilter(v as (typeof TYPE_OPTIONS)[number]["id"])
              }
              placeholder="Type"
              triggerClassName="sm:w-[150px]"
            >
              {TYPE_OPTIONS.map((opt) => (
                <FilterItem key={opt.id} value={opt.id} icon={Store}>
                  {opt.label}
                </FilterItem>
              ))}
            </FilterSelect>
            <FilterSelect
              icon={Wallet}
              value={payFilter}
              onValueChange={(v) =>
                setPayFilter(v as (typeof PAY_OPTIONS)[number]["id"])
              }
              placeholder="Payment"
              triggerClassName="sm:w-[160px]"
            >
              {PAY_OPTIONS.map((opt) => (
                <FilterItem key={opt.id} value={opt.id} icon={Wallet}>
                  {opt.id === "all" ? opt.label : methodLabel(opt.id)}
                </FilterItem>
              ))}
            </FilterSelect>
            {hasExtraFilters ? (
              <Button
                type="button"
                variant="ghost"
                className="col-span-2 h-8 text-xs text-muted-foreground hover:text-foreground sm:col-auto sm:h-9 sm:w-auto sm:px-3"
                onClick={clearExtraFilters}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground sm:text-sm">Loading orders…</p>
      ) : sorted.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-xs text-muted-foreground sm:py-10 sm:text-sm">
            {hasExtraFilters
              ? "No orders match these filters."
              : "No orders in this view."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5 sm:space-y-3">
          {sorted.map((order) => {
            const canResume =
              order.status === "open" || order.status === "held";
            return (
              <Card key={order.id} className="border-border/70">
                <CardContent className="p-2.5 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5 sm:space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <span className="truncate text-xs font-semibold tracking-tight sm:text-sm">
                          {order.orderNumber}
                        </span>
                        <PosOrderStatusBadge status={order.status} />
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                          {order.orderType.replace("_", " ")}
                        </span>
                      </div>
                      <p className="truncate text-[10px] text-muted-foreground sm:text-sm">
                        {formatOrderWhen(order.openedAt)}
                        {order.tableName ? ` · Table ${order.tableName}` : ""}
                        {order.roomNumber ? ` · Room ${order.roomNumber}` : ""}
                        {order.customerName ? ` · ${order.customerName}` : ""}
                      </p>
                      <ul className="space-y-0 text-[11px] sm:space-y-0.5 sm:text-sm">
                        {order.items.slice(0, 4).map((item, index) => (
                          <li
                            key={item.id}
                            className={cn(
                              "truncate text-muted-foreground",
                              index >= 2 && "hidden sm:list-item",
                            )}
                          >
                            {item.quantity}× {item.productName} —{" "}
                            {formatPeso(item.lineTotal)}
                          </li>
                        ))}
                        {order.items.length > 2 && (
                          <li className="text-[10px] text-muted-foreground sm:hidden">
                            +{order.items.length - 2} more
                          </li>
                        )}
                        {order.items.length > 4 && (
                          <li className="hidden text-xs text-muted-foreground sm:list-item">
                            +{order.items.length - 4} more
                          </li>
                        )}
                      </ul>
                    </div>
                    <div className="shrink-0 text-right text-sm font-semibold tabular-nums sm:text-lg">
                      {formatPeso(order.totalAmount)}
                    </div>
                  </div>
                  {canResume ? (
                    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:mt-3 sm:flex sm:justify-end">
                      <Button
                        asChild
                        size="sm"
                        className="h-8 bg-teal-600 px-2 text-xs hover:bg-teal-700 sm:h-9 sm:px-3"
                      >
                        <Link href={`/pos?order=${order.id}`}>
                          <RotateCcw className="mr-1 h-3.5 w-3.5" />
                          Resume
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs text-destructive sm:h-9 sm:px-3"
                        onClick={() => setVoiding(order)}
                      >
                        Void
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={Boolean(voiding)} onOpenChange={(o) => !o && setVoiding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void {voiding?.orderNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cancels the open ticket. Stock is not adjusted for unpaid
              voids.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2 space-x-0 sm:space-x-0">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmVoid}>Void order</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PosPageShell>
  );
}

function FilterSelect({
  icon: Icon,
  value,
  onValueChange,
  placeholder,
  triggerClassName,
  children,
}: {
  icon: LucideIcon;
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  triggerClassName?: string;
  children: ReactNode;
}) {
  const active = value !== "all";
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          "h-8 min-w-0 gap-1.5 rounded-lg bg-background px-2 text-xs shadow-none sm:h-9 sm:px-3 sm:text-sm",
          active && "border-teal-500/40 bg-teal-500/5",
          triggerClassName,
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            active ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground",
          )}
        />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function FilterItem({
  value,
  icon: Icon,
  children,
}: {
  value: string;
  icon: LucideIcon;
  children: string;
}) {
  return (
    <SelectItem value={value}>
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <SelectItemText>{children}</SelectItemText>
      </span>
    </SelectItem>
  );
}
