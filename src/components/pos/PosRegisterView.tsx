"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Pause,
  CreditCard,
} from "lucide-react";
import { PosPageShell } from "@/components/pos/PosPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useGetSettings, useListRooms } from "@/lib/api-client";
import {
  formatPeso,
  usePosCategories,
  usePosOrder,
  usePosProducts,
  usePosTables,
  useSavePosOrder,
} from "@/lib/api-client/pos";
import type {
  PosCartLine,
  PosOrderType,
  PosPaymentMethod,
  PosProduct,
} from "@/lib/api-client/pos-types";
import { cn } from "@/lib/utils";

function lineKey(productId: string | null, name: string) {
  return `${productId ?? "custom"}:${name}`;
}

export function PosRegisterView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("order");
  const tableParam = searchParams.get("table");

  const { toast } = useToast();
  const { data: products = [], isLoading: productsLoading } = usePosProducts();
  const { data: categories = [] } = usePosCategories();
  const { data: tables = [] } = usePosTables();
  const { data: rooms = [] } = useListRooms();
  const { data: settings } = useGetSettings();
  const { data: resumeOrder } = usePosOrder(resumeId);
  const saveOrder = useSavePosOrder();

  const [categoryId, setCategoryId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<PosOrderType>("walk_in");
  const [tableId, setTableId] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [chargeOpen, setChargeOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PosPaymentMethod>("cash");
  const [payRef, setPayRef] = useState("");
  const [cashTendered, setCashTendered] = useState("");

  const taxRate = Number(settings?.taxRate ?? 0);

  useEffect(() => {
    if (!resumeOrder) return;
    setOrderId(resumeOrder.id);
    setOrderType(resumeOrder.orderType);
    setTableId(resumeOrder.tableId ?? "");
    setRoomId(resumeOrder.roomId ?? "");
    setCustomerName(resumeOrder.customerName ?? "");
    setDiscount(resumeOrder.discountAmount);
    setNotes(resumeOrder.notes ?? "");
    setCart(
      resumeOrder.items.map((item) => ({
        key: lineKey(item.productId, item.productName),
        productId: item.productId,
        productName: item.productName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        notes: item.notes ?? undefined,
      })),
    );
  }, [resumeOrder]);

  useEffect(() => {
    if (!tableParam || resumeId) return;
    setTableId(tableParam);
    setOrderType("dine_in");
  }, [tableParam, resumeId]);

  const activeProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (!p.isActive) return false;
      if (categoryId === "quick" && !p.isQuickSell) return false;
      if (categoryId !== "all" && categoryId !== "quick" && p.categoryId !== categoryId)
        return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, categoryId, query]);

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const discountClamped = Math.min(Math.max(0, discount), subtotal);
  const taxable = Math.max(0, subtotal - discountClamped);
  const taxAmount = Math.round(taxable * (taxRate / 100) * 100) / 100;
  const total = Math.round((taxable + taxAmount) * 100) / 100;
  const tendered = Number(cashTendered || 0);
  const change = Math.max(0, tendered - total);

  const addProduct = (product: PosProduct) => {
    if (product.trackStock && product.stockQty <= 0) {
      toast({
        title: "Out of stock",
        description: product.name,
        variant: "destructive",
      });
      return;
    }
    setCart((prev) => {
      const key = lineKey(product.id, product.name);
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity: 1,
          trackStock: product.trackStock,
          stockQty: product.stockQty,
        },
      ];
    });
  };

  const setQty = (key: string, quantity: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity } : l))
        .filter((l) => l.quantity > 0),
    );
  };

  const clearTicket = () => {
    setCart([]);
    setOrderId(null);
    setDiscount(0);
    setNotes("");
    setCustomerName("");
    setCashTendered("");
    setPayRef("");
    if (resumeId || tableParam) router.replace("/pos");
  };

  const buildItems = () =>
    cart.map((l) => ({
      productId: l.productId,
      productName: l.productName,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      notes: l.notes ?? null,
    }));

  const persist = async (status: "open" | "held" | "paid", withPayment = false) => {
    if (!cart.length) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }
    try {
      const result = await saveOrder.mutateAsync({
        orderId,
        orderType:
          orderType === "dine_in" && !tableId
            ? "walk_in"
            : orderType === "room_charge" && !roomId
              ? "walk_in"
              : orderType,
        tableId: tableId || null,
        roomId: roomId || null,
        customerName: customerName.trim() || null,
        notes: notes.trim() || null,
        discountAmount: discountClamped,
        taxRate,
        status,
        items: buildItems(),
        payment: withPayment
          ? {
              amount: total,
              method: payMethod,
              referenceNo: payRef.trim() || null,
            }
          : null,
      });
      toast({
        title:
          status === "paid"
            ? "Sale completed"
            : status === "held"
              ? "Order held"
              : "Order saved",
        description: formatPeso(result.totalAmount),
      });
      if (status === "paid" || status === "held") {
        setChargeOpen(false);
        clearTicket();
        if (status === "held") router.push("/pos/orders");
      } else {
        setOrderId(result.orderId);
      }
    } catch (err) {
      toast({
        title: "Could not save order",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <PosPageShell
      title="Register"
      description="Ring up walk-in sales, room charges, and F&B orders."
      icon={ShoppingCart}
    >
      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search products or SKU…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <FilterChip
                active={categoryId === "all"}
                onClick={() => setCategoryId("all")}
                label="All"
              />
              <FilterChip
                active={categoryId === "quick"}
                onClick={() => setCategoryId("quick")}
                label="Quick"
              />
              {categories
                .filter((c) => c.isActive)
                .map((c) => (
                  <FilterChip
                    key={c.id}
                    active={categoryId === c.id}
                    onClick={() => setCategoryId(c.id)}
                    label={c.name}
                  />
                ))}
            </div>
          </div>

          {productsLoading ? (
            <p className="text-sm text-muted-foreground">Loading catalog…</p>
          ) : activeProducts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No products match. Add items under Products.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="rounded-xl border border-border/80 bg-card px-4 py-4 text-left transition-colors hover:border-teal-500/40 hover:bg-teal-500/5"
                >
                  <div className="font-medium leading-snug">{product.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {formatPeso(product.price)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {product.categoryName && <span>{product.categoryName}</span>}
                    {product.trackStock && (
                      <span
                        className={cn(
                          product.stockQty <= 0 && "text-destructive font-medium",
                        )}
                      >
                        Stock {product.stockQty}
                      </span>
                    )}
                    {product.isQuickSell && (
                      <span className="text-teal-600 dark:text-teal-400">Quick</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <Card className="border-border/70 h-fit xl:sticky xl:top-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Current ticket</span>
              {orderId && (
                <span className="text-xs font-normal text-muted-foreground">
                  Editing order
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Order type</Label>
                <Select
                  value={orderType}
                  onValueChange={(v) => setOrderType(v as PosOrderType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk_in">Walk-in</SelectItem>
                    <SelectItem value="dine_in">Dine-in</SelectItem>
                    <SelectItem value="takeout">Takeout</SelectItem>
                    <SelectItem value="room_charge">Room charge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Customer</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Optional name"
                />
              </div>
              {orderType === "dine_in" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Table</Label>
                  <Select value={tableId || "none"} onValueChange={(v) => setTableId(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No table</SelectItem>
                      {tables
                        .filter((t) => t.status !== "inactive")
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} · {t.zone} ({t.status})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {orderType === "room_charge" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Room</Label>
                  <Select value={roomId || "none"} onValueChange={(v) => setRoomId(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select room" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No room</SelectItem>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          Room {r.roomNumber} · {r.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No items yet. Tap a product to add it.
                </p>
              ) : (
                cart.map((line) => (
                  <div
                    key={line.key}
                    className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {line.productName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatPeso(line.unitPrice)} each
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => setQty(line.key, line.quantity - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-7 text-center text-sm font-semibold">
                        {line.quantity}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => setQty(line.key, line.quantity + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="w-16 text-right text-sm font-semibold">
                      {formatPeso(line.unitPrice * line.quantity)}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setQty(line.key, 0)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Discount (₱)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions"
              />
            </div>

            <div className="space-y-1.5 border-t pt-3 text-sm">
              <Row label="Subtotal" value={formatPeso(subtotal)} />
              <Row label="Discount" value={`−${formatPeso(discountClamped)}`} />
              <Row label={`Tax (${taxRate}%)`} value={formatPeso(taxAmount)} />
              <div className="flex items-center justify-between pt-1 text-base font-semibold">
                <span>Total</span>
                <span>{formatPeso(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!cart.length || saveOrder.isPending}
                onClick={() => persist("held")}
              >
                <Pause className="mr-1.5 h-4 w-4" />
                Hold
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!cart.length}
                onClick={clearTicket}
              >
                Clear
              </Button>
              <Button
                type="button"
                className="col-span-2 bg-teal-600 hover:bg-teal-700"
                disabled={!cart.length || saveOrder.isPending}
                onClick={() => {
                  if (orderType === "room_charge") {
                    setPayMethod("room_charge");
                  }
                  setChargeOpen(true);
                }}
              >
                <CreditCard className="mr-1.5 h-4 w-4" />
                Charge {formatPeso(total)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Charge {formatPeso(total)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <Select
                value={payMethod}
                onValueChange={(v) => setPayMethod(v as PosPaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="gcash">GCash</SelectItem>
                  <SelectItem value="maya">Maya</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="room_charge">Room charge</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payMethod === "cash" && (
              <div className="space-y-1.5">
                <Label>Cash tendered</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={String(total)}
                />
                <p className="text-xs text-muted-foreground">
                  Change: {formatPeso(change)}
                </p>
              </div>
            )}
            {payMethod !== "cash" && (
              <div className="space-y-1.5">
                <Label>Reference no.</Label>
                <Input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              disabled={
                saveOrder.isPending ||
                (payMethod === "cash" && cashTendered !== "" && tendered < total)
              }
              onClick={() => persist("paid", true)}
            >
              {saveOrder.isPending ? "Processing…" : "Confirm payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PosPageShell>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-teal-600 bg-teal-600 text-white"
          : "border-border bg-card text-muted-foreground hover:border-teal-500/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
