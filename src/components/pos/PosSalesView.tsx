"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Percent,
  Receipt,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";
import { PosPageShell } from "@/components/pos/PosPageShell";
import { PosOrderStatusBadge } from "@/components/pos/PosBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatPeso, usePosSalesSummary } from "@/lib/api-client/pos";
import type { PosOrder } from "@/lib/api-client/pos-types";
import { cn } from "@/lib/utils";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  room_charge: "Room charge",
  other: "Other",
  unspecified: "Unspecified",
};

const TX_FILTERS = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "void", label: "Void" },
  { id: "open", label: "Open / Held" },
] as const;

function todayLocalIso() {
  return toLocalDayIso(new Date());
}

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

function formatDayLabel(dayIso: string) {
  const d = new Date(`${dayIso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function methodLabel(method: string) {
  return METHOD_LABELS[method] ?? method.replaceAll("_", " ");
}

export function PosSalesView() {
  const [day, setDay] = useState(todayLocalIso);
  const [txFilter, setTxFilter] = useState<(typeof TX_FILTERS)[number]["id"]>("all");
  const { data, isLoading } = usePosSalesSummary(day);
  const isToday = day === todayLocalIso();

  const methodRows = useMemo(() => {
    const entries = Object.entries(data?.byMethod ?? {});
    return entries.sort((a, b) => b[1].amount - a[1].amount);
  }, [data?.byMethod]);

  const methodTotal = methodRows.reduce((sum, [, row]) => sum + row.amount, 0);

  const filteredOrders = useMemo(() => {
    const orders = data?.orders ?? [];
    if (txFilter === "paid") return orders.filter((o) => o.status === "paid");
    if (txFilter === "void") return orders.filter((o) => o.status === "void");
    if (txFilter === "open") {
      return orders.filter((o) => o.status === "open" || o.status === "held");
    }
    return orders;
  }, [data?.orders, txFilter]);

  return (
    <PosPageShell
      title="Sales"
      description="Daily sales totals, payment mix, and voided transactions."
      icon={Receipt}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 w-9"
                onClick={() => setDay((d) => shiftDay(d, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous business day</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Input
                type="date"
                className="w-[11.5rem]"
                value={day}
                max={todayLocalIso()}
                onChange={(e) => {
                  if (e.target.value) setDay(e.target.value);
                }}
              />
            </TooltipTrigger>
            <TooltipContent>Pick a business day to review</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9"
                  disabled={isToday}
                  onClick={() => setDay((d) => shiftDay(d, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {isToday ? "Already on today" : "Next business day"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isToday}
                  onClick={() => setDay(todayLocalIso())}
                >
                  Today
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Jump back to today’s sales</TooltipContent>
          </Tooltip>
        </div>
        <p className="text-sm text-muted-foreground">{formatDayLabel(day)}</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading sales…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Gross sales"
              value={formatPeso(data?.gross ?? 0)}
              hint="Total collected from paid tickets, including tax"
              icon={Banknote}
              accent="teal"
            />
            <StatCard
              label="Net sales"
              value={formatPeso(data?.net ?? 0)}
              hint="Paid ticket subtotal after discounts, before tax"
              icon={ShoppingBag}
              accent="sky"
            />
            <StatCard
              label="Paid tickets"
              value={String(data?.paidCount ?? 0)}
              hint={`Average ticket ${formatPeso(data?.avgTicket ?? 0)}`}
              icon={ReceiptText}
              accent="emerald"
            />
            <StatCard
              label="Tax collected"
              value={formatPeso(data?.tax ?? 0)}
              hint="VAT / tax included in paid tickets"
              icon={Percent}
              accent="amber"
            />
            <StatCard
              label="Discounts"
              value={formatPeso(data?.discount ?? 0)}
              hint="Total discounts given on paid tickets"
              icon={Percent}
              accent="violet"
            />
            <StatCard
              label="Voids"
              value={`${data?.voidCount ?? 0}`}
              hint={`${formatPeso(data?.voidAmount ?? 0)} in voided ticket value`}
              icon={RotateCcw}
              accent="rose"
            />
            <StatCard
              label="Open tickets"
              value={String(data?.openCount ?? 0)}
              hint="Still open and not yet charged"
              icon={Receipt}
              accent="sky"
            />
            <StatCard
              label="Held tickets"
              value={String(data?.heldCount ?? 0)}
              hint="Saved tickets waiting to be resumed"
              icon={ReceiptText}
              accent="amber"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Payment mix</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="rounded-full font-semibold tabular-nums">
                        {formatPeso(methodTotal)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Total payments recorded this day</TooltipContent>
                  </Tooltip>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {methodRows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No payments on this day.
                  </p>
                ) : (
                  methodRows.map(([method, row]) => {
                    const pct = methodTotal > 0 ? (row.amount / methodTotal) * 100 : 0;
                    return (
                      <Tooltip key={method}>
                        <TooltipTrigger asChild>
                          <div className="space-y-1.5 rounded-xl border border-border/60 px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className="font-medium">{methodLabel(method)}</span>
                              <span className="font-semibold tabular-nums">
                                {formatPeso(row.amount)}
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-teal-600"
                                style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] text-muted-foreground">
                              <span>
                                {row.count} {row.count === 1 ? "payment" : "payments"}
                              </span>
                              <span>{pct.toFixed(0)}%</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {row.count} {methodLabel(method).toLowerCase()} payment
                          {row.count === 1 ? "" : "s"} · {pct.toFixed(1)}% of the day’s mix
                        </TooltipContent>
                      </Tooltip>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="space-y-3 pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Transactions</span>
                  <Badge variant="outline" className="rounded-full tabular-nums">
                    {filteredOrders.length}
                  </Badge>
                </CardTitle>
                <div className="flex flex-wrap gap-1.5">
                  {TX_FILTERS.map((f) => (
                    <Tooltip key={f.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setTxFilter(f.id)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                            txFilter === f.id
                              ? "border-teal-600 bg-teal-600 text-white"
                              : "border-border bg-card text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {f.label}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {f.id === "all"
                          ? "Show every ticket for this day"
                          : f.id === "paid"
                            ? "Show completed paid tickets"
                            : f.id === "void"
                              ? "Show voided tickets"
                              : "Show open and held tickets"}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {filteredOrders.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No tickets in this view.
                  </p>
                ) : (
                  filteredOrders.map((order) => (
                    <TransactionRow key={order.id} order={order} />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PosPageShell>
  );
}

function TransactionRow({ order }: { order: PosOrder }) {
  const canResume = order.status === "open" || order.status === "held";
  const href = canResume ? `/pos?order=${order.id}` : "/pos/orders";
  const time = new Date(order.closedAt ?? order.openedAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const payMethod = order.payments[0]?.method;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          className="flex flex-col gap-2 rounded-xl border border-border/60 px-3 py-2.5 transition-colors hover:border-teal-500/40 hover:bg-teal-500/5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{order.orderNumber}</span>
              <PosOrderStatusBadge status={order.status} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {time}
              {payMethod ? ` · ${methodLabel(payMethod)}` : ""}
              {order.tableName ? ` · Table ${order.tableName}` : ""}
              {order.roomNumber ? ` · Room ${order.roomNumber}` : ""}
              {order.customerName ? ` · ${order.customerName}` : ""}
            </p>
          </div>
          <div className="font-semibold tabular-nums">{formatPeso(order.totalAmount)}</div>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        {canResume ? "Resume this ticket in the register" : "Open this ticket in Orders"}
      </TooltipContent>
    </Tooltip>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Banknote;
  accent: "teal" | "sky" | "emerald" | "amber" | "violet" | "rose";
}) {
  const accents = {
    teal: "bg-teal-500/12 text-teal-700 dark:text-teal-300",
    sky: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    emerald: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    amber: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
    violet: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
    rose: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="border-border/70">
          <CardContent className="flex items-start gap-3 p-4">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                accents[accent],
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-0.5 truncate text-2xl font-semibold tracking-tight tabular-nums">
                {value}
              </p>
            </div>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}
