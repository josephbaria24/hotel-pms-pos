"use client";

import { useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { PosPageShell } from "@/components/pos/PosPageShell";
import { PosOrderStatusBadge } from "@/components/pos/PosBadges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPeso, usePosSalesSummary } from "@/lib/api-client/pos";

function todayLocalIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function PosSalesView() {
  const [day, setDay] = useState(todayLocalIso);
  const { data, isLoading } = usePosSalesSummary(day);

  const methodRows = useMemo(() => {
    const entries = Object.entries(data?.byMethod ?? {});
    return entries.sort((a, b) => b[1] - a[1]);
  }, [data?.byMethod]);

  return (
    <PosPageShell
      title="Sales"
      description="Daily sales totals, payment mix, and voided transactions."
      icon={Receipt}
    >
      <div className="mb-4 max-w-xs space-y-1.5">
        <Label>Business day</Label>
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading sales…</p>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Gross sales" value={formatPeso(data?.gross ?? 0)} />
            <StatCard label="Paid tickets" value={String(data?.paidCount ?? 0)} />
            <StatCard label="Tax collected" value={formatPeso(data?.tax ?? 0)} />
            <StatCard label="Discounts" value={formatPeso(data?.discount ?? 0)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-base">Payment mix</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {methodRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments today.</p>
                ) : (
                  methodRows.map(([method, amount]) => (
                    <div
                      key={method}
                      className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                    >
                      <span className="capitalize">{method.replace("_", " ")}</span>
                      <span className="font-semibold">{formatPeso(amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex items-center justify-between border-t pt-3 text-sm">
                  <span className="text-muted-foreground">Voids</span>
                  <span className="font-medium">{data?.voidCount ?? 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-base">Transactions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.orders ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders for this day.</p>
                ) : (
                  (data?.orders ?? []).map((order) => (
                    <div
                      key={order.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{order.orderNumber}</span>
                          <PosOrderStatusBadge status={order.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.openedAt).toLocaleTimeString()}
                          {order.payments[0]
                            ? ` · ${order.payments[0].method.replace("_", " ")}`
                            : ""}
                        </p>
                      </div>
                      <div className="font-semibold">{formatPeso(order.totalAmount)}</div>
                    </div>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border/70">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
