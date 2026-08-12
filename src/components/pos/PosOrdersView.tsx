"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardList, RotateCcw } from "lucide-react";
import { PosPageShell } from "@/components/pos/PosPageShell";
import { PosOrderStatusBadge } from "@/components/pos/PosBadges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

const filters = [
  { id: "active", label: "Open / Held" },
  { id: "paid", label: "Paid" },
  { id: "void", label: "Void" },
  { id: "all", label: "All" },
] as const;

export function PosOrdersView() {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("active");
  const { data: orders = [], isLoading } = usePosOrders(filter);
  const voidOrder = useVoidPosOrder();
  const { toast } = useToast();
  const [voiding, setVoiding] = useState<PosOrder | null>(null);

  const sorted = useMemo(
    () =>
      [...orders].sort(
        (a, b) =>
          new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
      ),
    [orders],
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

  return (
    <PosPageShell
      title="Orders"
      description="Open tickets, held orders, and completed sales."
      icon={ClipboardList}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.id
                ? "border-teal-600 bg-teal-600 text-white"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading orders…</p>
      ) : sorted.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No orders in this view.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((order) => (
            <Card key={order.id} className="border-border/70">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold tracking-tight">
                      {order.orderNumber}
                    </span>
                    <PosOrderStatusBadge status={order.status} />
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {order.orderType.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(order.openedAt).toLocaleString()}
                    {order.tableName ? ` · Table ${order.tableName}` : ""}
                    {order.roomNumber ? ` · Room ${order.roomNumber}` : ""}
                    {order.customerName ? ` · ${order.customerName}` : ""}
                  </p>
                  <ul className="space-y-0.5 text-sm">
                    {order.items.slice(0, 4).map((item) => (
                      <li key={item.id} className="text-muted-foreground">
                        {item.quantity}× {item.productName} —{" "}
                        {formatPeso(item.lineTotal)}
                      </li>
                    ))}
                    {order.items.length > 4 && (
                      <li className="text-xs text-muted-foreground">
                        +{order.items.length - 4} more items
                      </li>
                    )}
                  </ul>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  <div className="text-right text-lg font-semibold">
                    {formatPeso(order.totalAmount)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(order.status === "open" || order.status === "held") && (
                      <>
                        <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700">
                          <Link href={`/pos?order=${order.id}`}>
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Resume
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => setVoiding(order)}
                        >
                          Void
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmVoid}>Void order</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PosPageShell>
  );
}
