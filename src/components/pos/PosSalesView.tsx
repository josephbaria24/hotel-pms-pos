"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGetSettings } from "@/lib/api-client";
import { formatPeso, usePosSalesSummary } from "@/lib/api-client/pos";
import type { PosOrder } from "@/lib/api-client/pos-types";
import { methodLabel } from "@/lib/pos-sales-stats";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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

export function PosSalesView() {
  const [day, setDay] = useState(todayLocalIso);
  const [txFilter, setTxFilter] = useState<(typeof TX_FILTERS)[number]["id"]>("all");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFrom, setReportFrom] = useState(todayLocalIso);
  const [reportTo, setReportTo] = useState(todayLocalIso);
  const [reportBusy, setReportBusy] = useState(false);
  const { toast } = useToast();
  const { data: settings } = useGetSettings();
  const { data, isLoading } = usePosSalesSummary(day);
  const { data: reportData, isLoading: reportLoading } = usePosSalesSummary(
    reportFrom,
    reportTo,
    reportOpen,
  );
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
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
              onClick={() => setDay((d) => shiftDay(d, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous business day</TooltipContent>
        </Tooltip>
        <div className="min-w-0 flex-1">
          <Input
            type="date"
            className="h-8 w-full min-w-0 bg-background text-xs shadow-none sm:h-9 sm:max-w-[11.5rem] sm:text-sm"
            value={day}
            max={todayLocalIso()}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value);
            }}
            aria-label="Business day"
          />
          <p className="mt-0.5 truncate px-0.5 text-[10px] text-muted-foreground sm:hidden">
            {formatDayLabel(day)}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
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
                className="h-8 rounded-full px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
                disabled={isToday}
                onClick={() => setDay(todayLocalIso())}
              >
                Today
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Jump back to today’s sales</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              className="h-8 shrink-0 rounded-full bg-teal-600 px-2.5 text-xs hover:bg-teal-700 sm:h-9 sm:px-3 sm:text-sm"
              onClick={() => {
                setReportFrom(day);
                setReportTo(day);
                setReportOpen(true);
              }}
            >
              <Download className="h-3.5 w-3.5 sm:mr-1.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download a POS sales PDF</TooltipContent>
        </Tooltip>
        <p className="hidden text-sm text-muted-foreground lg:block">{formatDayLabel(day)}</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading sales…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            <StatCard
              label="Gross sales"
              value={formatPeso(data?.gross ?? 0)}
              hint="Total collected from paid tickets, including tax"
              icon={Banknote}
              accent="teal"
              featured
            />
            <StatCard
              label="Net sales"
              value={formatPeso(data?.net ?? 0)}
              hint="Paid ticket subtotal after discounts, before tax"
              icon={ShoppingBag}
              accent="sky"
              featured
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

          <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:gap-4">
            <Card className="border-border/70">
              <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-3">
                <CardTitle className="flex items-center justify-between text-sm sm:text-base">
                  <span>Payment mix</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="h-5 rounded-full px-2 text-[10px] font-semibold tabular-nums sm:h-6 sm:text-xs"
                      >
                        {formatPeso(methodTotal)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Total payments recorded this day</TooltipContent>
                  </Tooltip>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0 sm:space-y-3 sm:p-6 sm:pt-0">
                {methodRows.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground sm:py-6 sm:text-sm">
                    No payments on this day.
                  </p>
                ) : (
                  methodRows.map(([method, row]) => {
                    const pct = methodTotal > 0 ? (row.amount / methodTotal) * 100 : 0;
                    return (
                      <Tooltip key={method}>
                        <TooltipTrigger asChild>
                          <div className="space-y-1 rounded-lg border border-border/60 px-2.5 py-2 sm:space-y-1.5 sm:rounded-xl sm:px-3 sm:py-2.5">
                            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                              <span className="font-medium">{methodLabel(method)}</span>
                              <span className="font-semibold tabular-nums">
                                {formatPeso(row.amount)}
                              </span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-muted sm:h-1.5">
                              <div
                                className="h-full rounded-full bg-teal-600"
                                style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground sm:text-[11px]">
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
              <CardHeader className="space-y-2 p-3 pb-2 sm:space-y-3 sm:p-6 sm:pb-3">
                <CardTitle className="flex items-center justify-between text-sm sm:text-base">
                  <span>Transactions</span>
                  <Badge
                    variant="outline"
                    className="h-5 rounded-full px-2 text-[10px] tabular-nums sm:h-6 sm:text-xs"
                  >
                    {filteredOrders.length}
                  </Badge>
                </CardTitle>
                <div className="flex flex-wrap gap-1 sm:gap-1.5">
                  {TX_FILTERS.map((f) => (
                    <Tooltip key={f.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setTxFilter(f.id)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors sm:px-2.5 sm:py-1 sm:text-[11px]",
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
              <CardContent className="space-y-1.5 p-3 pt-0 sm:space-y-2 sm:p-6 sm:pt-0">
                {filteredOrders.length === 0 ? (
                  <p className="py-5 text-center text-xs text-muted-foreground sm:py-8 sm:text-sm">
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

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Download sales report</DialogTitle>
            <DialogDescription>
              Choose a from and to date. The PDF includes totals, payment mix, charts, top items, and tickets.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pos-sales-from">From</Label>
                <Input
                  id="pos-sales-from"
                  type="date"
                  value={reportFrom}
                  max={reportTo || todayLocalIso()}
                  onChange={(e) => setReportFrom(e.target.value)}
                  className="h-9 cursor-pointer"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pos-sales-to">To</Label>
                <Input
                  id="pos-sales-to"
                  type="date"
                  value={reportTo}
                  min={reportFrom || undefined}
                  max={todayLocalIso()}
                  onChange={(e) => setReportTo(e.target.value)}
                  className="h-9 cursor-pointer"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Gross
                </p>
                <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-teal-800 dark:text-teal-300">
                  {reportLoading ? "…" : formatPeso(reportData?.gross ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Net
                </p>
                <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-teal-800 dark:text-teal-300">
                  {reportLoading ? "…" : formatPeso(reportData?.net ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/30 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Paid
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">
                  {reportLoading ? "…" : reportData?.paidCount ?? 0}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/30 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Voids
                </p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">
                  {reportLoading ? "…" : reportData?.voidCount ?? 0}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReportOpen(false)}
              disabled={reportBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-teal-600 hover:bg-teal-700"
              disabled={reportBusy || reportLoading || !reportData}
              onClick={async () => {
                if (!reportFrom || !reportTo) {
                  toast({
                    title: "Choose both dates",
                    description: "Pick a from and to date for the report.",
                    variant: "destructive",
                  });
                  return;
                }
                if (reportFrom > reportTo) {
                  toast({
                    title: "Invalid date range",
                    description: "The from date must be on or before the to date.",
                    variant: "destructive",
                  });
                  return;
                }
                if (!reportData) return;
                setReportBusy(true);
                try {
                  const { downloadPosSalesPdf } = await import("@/lib/pos-sales-pdf");
                  downloadPosSalesPdf({
                    hotel: {
                      hotelName: settings?.hotelName || "PalawanSU Hotel",
                      address: settings?.address,
                      contactNumber: settings?.contactNumber,
                      email: settings?.email,
                    },
                    from: reportFrom,
                    to: reportTo,
                    summary: reportData,
                  });
                  toast({
                    title: "Sales report downloaded",
                    description:
                      reportFrom === reportTo
                        ? `PDF saved for ${formatDayLabel(reportFrom)}.`
                        : `PDF saved for ${formatDayLabel(reportFrom)} – ${formatDayLabel(reportTo)}.`,
                  });
                  setReportOpen(false);
                } catch (error) {
                  toast({
                    title: "Could not create PDF",
                    description:
                      error instanceof Error ? error.message : "Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setReportBusy(false);
                }
              }}
            >
              {reportBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {reportBusy ? "Preparing…" : "Download PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-2 transition-colors hover:border-teal-500/40 hover:bg-teal-500/5 sm:rounded-xl sm:px-3 sm:py-2.5"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium sm:text-sm">{order.orderNumber}</span>
              <PosOrderStatusBadge status={order.status} />
            </div>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-xs">
              {time}
              {payMethod ? ` · ${methodLabel(payMethod)}` : ""}
              {order.tableName ? ` · Table ${order.tableName}` : ""}
              {order.roomNumber ? ` · Room ${order.roomNumber}` : ""}
              {order.customerName ? ` · ${order.customerName}` : ""}
            </p>
          </div>
          <div className="shrink-0 text-xs font-semibold tabular-nums sm:text-sm">
            {formatPeso(order.totalAmount)}
          </div>
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
  featured = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Banknote;
  accent: "teal" | "sky" | "emerald" | "amber" | "violet" | "rose";
  featured?: boolean;
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
          <CardContent className="flex items-start gap-2 p-2.5 sm:gap-3 sm:p-4">
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-lg sm:rounded-xl",
                "h-7 w-7 sm:h-10 sm:w-10",
                accents[accent],
              )}
            >
              <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                {label}
              </p>
              <p
                className={cn(
                  "mt-0.5 truncate font-semibold tracking-tight tabular-nums",
                  featured ? "text-base sm:text-2xl" : "text-sm sm:text-2xl",
                )}
              >
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
