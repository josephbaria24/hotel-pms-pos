"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Hash,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Pause,
  CreditCard,
  BedDouble,
  UserRound,
  X,
} from "lucide-react";
import { PosPageShell } from "@/components/pos/PosPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput, numberOrZero } from "@/components/ui/number-input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useGetSettings, useListReservations } from "@/lib/api-client";
import type { Reservation } from "@/lib/api-client/types";
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
  const { data: reservations = [] } = useListReservations();

  const uniqueTables = useMemo(() => {
    const seen = new Set<string>();
    return tables.filter((t) => {
      if (t.status === "inactive" || !t.id?.trim()) return false;
      const key = t.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [tables]);

  const inHouseStays = useMemo(
    () =>
      reservations
        .filter((r) => r.status === "checked_in")
        .sort(
          (a, b) =>
            a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }) ||
            a.guestName.localeCompare(b.guestName),
        ),
    [reservations],
  );

  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>();
    return categories.filter((c) => {
      if (!c.id?.trim() || !c.isActive) return false;
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categories]);
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
  const [guestId, setGuestId] = useState<string>("");
  const [reservationId, setReservationId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [guestQuery, setGuestQuery] = useState("");
  const [discount, setDiscount] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [chargeOpen, setChargeOpen] = useState(false);
  const [callTicket, setCallTicket] = useState<{
    callNumber: number;
    totalAmount: number;
    status: string;
    roomCharge: boolean;
  } | null>(null);
  const [settleMode, setSettleMode] = useState<"pay_now" | "room_charge">("pay_now");
  const [payMethod, setPayMethod] = useState<PosPaymentMethod>("cash");
  const [payRef, setPayRef] = useState("");
  const [cashTendered, setCashTendered] = useState("");

  const taxRate = Number(settings?.taxRate ?? 0);

  const selectedStay = useMemo(
    () => inHouseStays.find((r) => r.id === reservationId) ?? null,
    [inHouseStays, reservationId],
  );

  const filteredStays = useMemo(() => {
    const q = guestQuery.trim().toLowerCase();
    if (!q) return inHouseStays;
    return inHouseStays.filter(
      (r) =>
        r.guestName.toLowerCase().includes(q) ||
        String(r.roomNumber).toLowerCase().includes(q) ||
        r.reservationNumber.toLowerCase().includes(q),
    );
  }, [inHouseStays, guestQuery]);

  const linkStay = (res: Reservation) => {
    setReservationId(res.id);
    setGuestId(res.guestId);
    setRoomId(res.roomId);
    setCustomerName(res.guestName);
    setGuestQuery("");
    if (settleMode === "room_charge" || orderType === "room_charge") {
      setOrderType("room_charge");
      setSettleMode("room_charge");
      setPayMethod("room_charge");
    }
  };

  const clearStayLink = () => {
    setReservationId("");
    setGuestId("");
    setRoomId("");
    setGuestQuery("");
  };

  useEffect(() => {
    if (!resumeOrder) return;
    setOrderId(resumeOrder.id);
    setOrderType(resumeOrder.orderType);
    setTableId(resumeOrder.tableId ?? "");
    setRoomId(resumeOrder.roomId ?? "");
    setGuestId(resumeOrder.guestId ?? "");
    setReservationId(resumeOrder.reservationId ?? "");
    setCustomerName(resumeOrder.customerName ?? "");
    setDiscount(
      resumeOrder.discountAmount === 0 ? "" : resumeOrder.discountAmount,
    );
    setNotes(resumeOrder.notes ?? "");
    if (resumeOrder.orderType === "room_charge" || resumeOrder.reservationId) {
      setSettleMode(
        resumeOrder.orderType === "room_charge" ? "room_charge" : "pay_now",
      );
    }
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
    const selectedCategory = uniqueCategories.find((c) => c.id === categoryId);
    return products.filter((p) => {
      if (!p.isActive) return false;
      if (categoryId === "quick" && !p.isQuickSell) return false;
      if (categoryId !== "all" && categoryId !== "quick") {
        const sameId = p.categoryId === categoryId;
        const sameName =
          !!selectedCategory &&
          (p.categoryName ?? "").trim().toLowerCase() ===
            selectedCategory.name.trim().toLowerCase();
        if (!sameId && !sameName) return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, uniqueCategories, categoryId, query]);

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const discountValue = numberOrZero(discount);
  const discountClamped = Math.min(Math.max(0, discountValue), subtotal);
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
    setDiscount("");
    setNotes("");
    setCustomerName("");
    setGuestId("");
    setReservationId("");
    setRoomId("");
    setGuestQuery("");
    setSettleMode("pay_now");
    setPayMethod("cash");
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
    const chargingRoom =
      withPayment && (settleMode === "room_charge" || payMethod === "room_charge");
    if (chargingRoom && !reservationId) {
      toast({
        title: "Select an in-house guest",
        description: "Room charge posts to a checked-in reservation folio.",
        variant: "destructive",
      });
      return;
    }
    try {
      const effectiveType: PosOrderType = chargingRoom
        ? "room_charge"
        : orderType === "dine_in" && !tableId
          ? "walk_in"
          : orderType === "room_charge" && !reservationId
            ? "walk_in"
            : orderType;
      const result = await saveOrder.mutateAsync({
        orderId,
        orderType: effectiveType,
        tableId: tableId || null,
        roomId: roomId || null,
        guestId: guestId || null,
        reservationId: reservationId || null,
        customerName: customerName.trim() || null,
        notes: notes.trim() || null,
        discountAmount: discountClamped,
        taxRate,
        status,
        items: buildItems(),
        payment: withPayment
          ? {
              amount: total,
              method: chargingRoom ? "room_charge" : payMethod,
              referenceNo: payRef.trim() || null,
            }
          : null,
      });

      const callNo =
        result.callNumber != null && Number(result.callNumber) > 0
          ? Number(result.callNumber)
          : null;

      if (callNo != null && (status === "paid" || status === "held" || result.status === "pending")) {
        setChargeOpen(false);
        clearTicket();
        setCallTicket({
          callNumber: callNo,
          totalAmount: result.totalAmount,
          status: result.status,
          roomCharge: Boolean(result.roomCharge),
        });
      } else {
        toast({
          title: chargingRoom
            ? "Charged to room (pending)"
            : status === "paid"
              ? "Sale completed"
              : status === "held"
                ? "Order held"
                : "Order saved",
          description: chargingRoom
            ? `${formatPeso(result.totalAmount)} on guest folio — marked paid after PMS checkout`
            : formatPeso(result.totalAmount),
        });
        if (status === "paid" || status === "held" || result.status === "pending") {
          setChargeOpen(false);
          clearTicket();
          if (status === "held") router.push("/pos/orders");
        } else {
          setOrderId(result.orderId);
        }
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
      description="Ring up sales, assign a call number, and have customers pick up at the counter."
      icon={ShoppingCart}
    >
      <div className="grid gap-3 pb-20 xl:grid-cols-[1.55fr_1fr] xl:gap-4 xl:pb-0">
        <div className="space-y-2.5 sm:space-y-4">
          <div className="sticky top-0 z-10 -mx-1 space-y-2 rounded-xl bg-background/90 px-1 py-1.5 backdrop-blur-md sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9 sm:h-10"
                placeholder="Search products or SKU…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              {uniqueCategories.map((c) => (
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
            <Card className="border-dashed bg-muted/40">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No products match. Add items under Products.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
              {activeProducts.map((product) => {
                const out = product.trackStock && product.stockQty <= 0;
                return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className={cn(
                    "rounded-xl border px-2.5 py-2.5 text-left transition-all sm:px-3.5 sm:py-3.5",
                    "active:scale-[0.98] hover:brightness-[0.97] dark:hover:brightness-110",
                    productTileTone(product.categoryName),
                    out && "opacity-55",
                  )}
                >
                  {product.imageUrl ? (
                    <div className="-mx-0.5 mb-2 h-20 overflow-hidden rounded-lg border border-black/10 bg-white/50 sm:h-24">
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <div className="line-clamp-2 text-[13px] font-semibold leading-snug sm:text-sm">
                    {product.name}
                  </div>
                  <div className="mt-1 text-sm font-bold tabular-nums tracking-tight">
                    {formatPeso(product.price)}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] font-medium uppercase tracking-wide opacity-80">
                    {product.categoryName && <span>{product.categoryName}</span>}
                    {product.trackStock && (
                      <span
                        className={cn(
                          "rounded-full bg-black/10 px-1.5 py-0.5 dark:bg-white/10",
                          out && "bg-destructive/15 text-destructive opacity-100",
                        )}
                      >
                        {out ? "Out" : `Stock ${product.stockQty}`}
                      </span>
                    )}
                    {product.isQuickSell && (
                      <span className="rounded-full bg-black/10 px-1.5 py-0.5 dark:bg-white/10">
                        Quick
                      </span>
                    )}
                  </div>
                </button>
                );
              })}
            </div>
          )}
        </div>

        <Card
          id="pos-ticket"
          className="h-fit scroll-mt-3 border-teal-900/10 bg-gradient-to-b from-teal-50 to-emerald-50/80 dark:border-teal-500/20 dark:from-teal-950/50 dark:to-emerald-950/20 xl:sticky xl:top-2"
        >
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-3">
            <CardTitle className="flex items-center justify-between text-sm sm:text-base">
              <span>Current ticket</span>
              {orderId && (
                <span className="text-xs font-normal text-muted-foreground">
                  Editing order
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-3 pt-0 sm:space-y-4 sm:p-6 sm:pt-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Order type</Label>
                <Select
                  value={orderType}
                  onValueChange={(v) => {
                    const next = v as PosOrderType;
                    setOrderType(next);
                    if (next === "room_charge") {
                      setSettleMode("room_charge");
                      setPayMethod("room_charge");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select order type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk_in">Walk-in</SelectItem>
                    <SelectItem value="dine_in">Dine-in</SelectItem>
                    <SelectItem value="takeout">Takeout</SelectItem>
                    <SelectItem value="room_charge">Room charge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Guest / customer</Label>
                {selectedStay ? (
                  <div className="flex items-start gap-2 rounded-lg border border-teal-700/20 bg-teal-50/70 px-3 py-2 dark:bg-teal-950/40">
                    <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{selectedStay.guestName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Room {selectedStay.roomNumber} · {selectedStay.reservationNumber} · In-house
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => {
                        clearStayLink();
                        setCustomerName("");
                      }}
                      title="Clear guest"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={guestQuery || customerName}
                        onChange={(e) => {
                          const v = e.target.value;
                          setGuestQuery(v);
                          setCustomerName(v);
                          if (reservationId) clearStayLink();
                        }}
                        placeholder="Search in-house guest or type a name"
                        className="pl-8"
                      />
                    </div>
                    {inHouseStays.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        No checked-in guests right now. You can still enter a walk-in name.
                      </p>
                    ) : (
                      <div className="max-h-36 overflow-y-auto rounded-md border bg-background">
                        {filteredStays.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground">No matching in-house guests</p>
                        ) : (
                          filteredStays.slice(0, 12).map((res) => (
                            <button
                              key={res.id}
                              type="button"
                              className="flex w-full items-start gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
                              onClick={() => linkStay(res)}
                            >
                              <BedDouble className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">{res.guestName}</span>
                                <span className="block text-[11px] text-muted-foreground">
                                  Room {res.roomNumber} · {res.reservationNumber}
                                </span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {orderType === "dine_in" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Table</Label>
                  <Select value={tableId || "none"} onValueChange={(v) => setTableId(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select table" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <SelectItemText>No table</SelectItemText>
                      </SelectItem>
                      {uniqueTables.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <SelectItemText>
                            {t.name} · {t.zone} ({t.status})
                          </SelectItemText>
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
                    className="flex items-center gap-2 rounded-lg border border-teal-900/10 bg-white/70 px-2.5 py-2 dark:border-teal-500/20 dark:bg-teal-950/40"
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => setQty(line.key, line.quantity - 1)}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Decrease quantity</TooltipContent>
                      </Tooltip>
                      <span className="w-7 text-center text-sm font-semibold">
                        {line.quantity}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => setQty(line.key, line.quantity + 1)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Increase quantity</TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="w-16 text-right text-sm font-semibold">
                      {formatPeso(line.unitPrice * line.quantity)}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setQty(line.key, 0)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove item</TooltipContent>
                    </Tooltip>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Discount (₱)</Label>
              <NumberInput
                min={0}
                step="0.01"
                placeholder="0"
                value={discount}
                onValueChange={setDiscount}
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

            <div className="space-y-1.5 rounded-xl bg-white/70 px-3 py-2.5 text-sm dark:bg-teal-950/40">
              <Row label="Subtotal" value={formatPeso(subtotal)} />
              <Row label="Discount" value={`−${formatPeso(discountClamped)}`} />
              <Row label={`Tax (${taxRate}%)`} value={formatPeso(taxAmount)} />
              <div className="flex items-center justify-between pt-1 text-base font-semibold">
                <span>Total</span>
                <span>{formatPeso(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex w-full">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={!cart.length || saveOrder.isPending}
                      onClick={() => persist("held")}
                    >
                      <Pause className="mr-1.5 h-4 w-4" />
                      Hold
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Save this ticket as held so you can resume it later from Orders
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex w-full">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={!cart.length}
                      onClick={clearTicket}
                    >
                      Clear
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Discard the current ticket without saving
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="col-span-2 inline-flex w-full">
                    <Button
                      type="button"
                      className="w-full bg-teal-600 hover:bg-teal-700"
                      disabled={!cart.length || saveOrder.isPending}
                      onClick={() => {
                        if (orderType === "room_charge" || reservationId) {
                          // keep current settle mode; default room charge when type says so
                          if (orderType === "room_charge") {
                            setSettleMode("room_charge");
                            setPayMethod("room_charge");
                          }
                        }
                        setChargeOpen(true);
                      }}
                    >
                      <CreditCard className="mr-1.5 h-4 w-4" />
                      Charge {formatPeso(total)}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Pay now or charge to an in-house guest room
                </TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-teal-900/10 bg-teal-50/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(13,148,136,0.12)] backdrop-blur-md dark:border-teal-500/20 dark:bg-teal-950/90 xl:hidden">
        <div className="mx-auto flex max-w-7xl gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-w-0 flex-1 border-teal-700/20 bg-white/80 dark:bg-teal-900/40"
            onClick={() =>
              document.getElementById("pos-ticket")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            <ShoppingCart className="mr-1.5 h-4 w-4 shrink-0" />
            <span className="truncate">
              {cart.length} item{cart.length === 1 ? "" : "s"} · {formatPeso(total)}
            </span>
          </Button>
          <Button
            type="button"
            className="h-11 flex-1 bg-teal-600 hover:bg-teal-700"
            disabled={!cart.length || saveOrder.isPending}
            onClick={() => {
              if (orderType === "room_charge") {
                setSettleMode("room_charge");
                setPayMethod("room_charge");
              }
              setChargeOpen(true);
            }}
          >
            <CreditCard className="mr-1.5 h-4 w-4" />
            Charge
          </Button>
        </div>
      </div>

      <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Charge {formatPeso(total)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Settlement</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    settleMode === "pay_now"
                      ? "border-teal-600 bg-teal-50 dark:bg-teal-950/50"
                      : "border-border hover:bg-muted/40",
                  )}
                  onClick={() => {
                    setSettleMode("pay_now");
                    if (payMethod === "room_charge") setPayMethod("cash");
                  }}
                >
                  <span className="block font-semibold">Pay now</span>
                  <span className="block text-[11px] text-muted-foreground">Cash, card, e-wallet</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    settleMode === "room_charge"
                      ? "border-teal-600 bg-teal-50 dark:bg-teal-950/50"
                      : "border-border hover:bg-muted/40",
                  )}
                  onClick={() => {
                    setSettleMode("room_charge");
                    setPayMethod("room_charge");
                    setOrderType("room_charge");
                  }}
                >
                  <span className="block font-semibold">Room charge</span>
                  <span className="block text-[11px] text-muted-foreground">Pay at checkout</span>
                </button>
              </div>
            </div>

            {settleMode === "room_charge" && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                {selectedStay ? (
                  <>
                    Will post to <strong>{selectedStay.guestName}</strong> · Room{" "}
                    {selectedStay.roomNumber}. Appears on guest folio and billing balance until
                    checkout.
                  </>
                ) : (
                  <>Select an in-house guest on the ticket before confirming a room charge.</>
                )}
              </div>
            )}

            {settleMode === "pay_now" && (
              <>
                <div className="space-y-1.5">
                  <Label>Payment method</Label>
                  <Select
                    value={payMethod === "room_charge" ? "cash" : payMethod}
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
              </>
            )}
          </div>
          <DialogFooter className="flex-row justify-end gap-2 space-x-0 sm:space-x-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={() => setChargeOpen(false)}>
                  Cancel
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close without charging</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    disabled={
                      saveOrder.isPending ||
                      (settleMode === "room_charge" && !reservationId) ||
                      (settleMode === "pay_now" &&
                        payMethod === "cash" &&
                        cashTendered !== "" &&
                        tendered < total)
                    }
                    onClick={() => persist("paid", true)}
                  >
                    {saveOrder.isPending
                      ? "Processing…"
                      : settleMode === "room_charge"
                        ? "Charge to room"
                        : "Confirm payment"}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {settleMode === "room_charge"
                  ? "Post this sale to the guest folio for checkout"
                  : "Finalize payment and mark the order as paid"}
              </TooltipContent>
            </Tooltip>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={callTicket != null}
        onOpenChange={(open) => {
          if (!open) {
            const wasHeld = callTicket?.status === "held";
            setCallTicket(null);
            if (wasHeld) router.push("/pos/orders");
          }
        }}
      >
        <DialogContent className="max-w-sm text-center sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-base">
              <Hash className="h-4 w-4 text-teal-600" />
              Call number
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Give this number to the customer. Call it when their order is ready at
              the counter.
            </p>
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-teal-600/40 bg-teal-500/10 sm:h-32 sm:w-32">
              <span className="text-5xl font-bold tabular-nums tracking-tight text-teal-700 dark:text-teal-300 sm:text-6xl">
                {callTicket?.callNumber}
              </span>
            </div>
            <p className="text-sm font-medium tabular-nums">
              {callTicket ? formatPeso(callTicket.totalAmount) : null}
              {callTicket?.roomCharge ? " · Room charge" : null}
              {callTicket?.status === "held" ? " · Held / preparing" : null}
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button
              className="w-full bg-teal-600 hover:bg-teal-700 sm:w-auto"
              onClick={() => {
                const wasHeld = callTicket?.status === "held";
                setCallTicket(null);
                if (wasHeld) router.push("/pos/orders");
              }}
            >
              Next order
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
        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-xs",
        active
          ? "border-teal-700 bg-teal-600 text-white shadow-sm"
          : "border-teal-900/10 bg-teal-50 text-teal-900 hover:border-teal-500/40 hover:bg-teal-100 dark:border-teal-500/20 dark:bg-teal-950/40 dark:text-teal-100",
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

const PRODUCT_TONES = [
  "border-sky-300/80 bg-sky-100 text-sky-950 dark:border-sky-700/60 dark:bg-sky-950/55 dark:text-sky-50",
  "border-amber-300/80 bg-amber-100 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/55 dark:text-amber-50",
  "border-violet-300/80 bg-violet-100 text-violet-950 dark:border-violet-700/60 dark:bg-violet-950/50 dark:text-violet-50",
  "border-rose-300/80 bg-rose-100 text-rose-950 dark:border-rose-700/60 dark:bg-rose-950/50 dark:text-rose-50",
  "border-emerald-300/80 bg-emerald-100 text-emerald-950 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-50",
  "border-orange-300/80 bg-orange-100 text-orange-950 dark:border-orange-700/60 dark:bg-orange-950/50 dark:text-orange-50",
];

function productTileTone(categoryName?: string | null) {
  const key = (categoryName ?? "").trim().toLowerCase();
  if (key.includes("bever")) {
    return "border-sky-300/80 bg-sky-100 text-sky-950 dark:border-sky-700/60 dark:bg-sky-950/55 dark:text-sky-50";
  }
  if (key.includes("food") || key.includes("meal") || key.includes("snack")) {
    return "border-amber-300/80 bg-amber-100 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/55 dark:text-amber-50";
  }
  if (key.includes("service")) {
    return "border-violet-300/80 bg-violet-100 text-violet-950 dark:border-violet-700/60 dark:bg-violet-950/50 dark:text-violet-50";
  }
  if (!key) {
    return "border-teal-300/80 bg-teal-100 text-teal-950 dark:border-teal-700/60 dark:bg-teal-950/50 dark:text-teal-50";
  }
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PRODUCT_TONES[h % PRODUCT_TONES.length]!;
}
