import type { PosOrder } from "@/lib/api-client/pos-types";

export const POS_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  room_charge: "Room charge",
  other: "Other",
  unspecified: "Unspecified",
};

export const POS_ORDER_TYPE_LABELS: Record<string, string> = {
  walk_in: "Walk-in",
  dine_in: "Dine in",
  takeout: "Takeout",
  room_charge: "Room charge",
  other: "Other",
};

export type PosSalesSummary = {
  orders: PosOrder[];
  paid: PosOrder[];
  voided: PosOrder[];
  paidCount: number;
  voidCount: number;
  openCount: number;
  heldCount: number;
  refundedCount: number;
  gross: number;
  net: number;
  tax: number;
  discount: number;
  avgTicket: number;
  voidAmount: number;
  byMethod: Record<string, { amount: number; count: number }>;
  byHour: { hour: number; amount: number; count: number }[];
  byDay: { day: string; amount: number; count: number }[];
  topItems: { name: string; qty: number; amount: number }[];
};

function localYmd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inRange(iso: string | null | undefined, fromIso: string, toIso: string) {
  const stamp = localYmd(iso);
  if (!stamp) return false;
  return stamp >= fromIso && stamp <= toIso;
}

function eachDay(fromIso: string, toIso: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${fromIso}T00:00:00`);
  const last = new Date(`${toIso}T00:00:00`);
  while (cursor <= last) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function methodLabel(method: string) {
  return POS_METHOD_LABELS[method] ?? method.replaceAll("_", " ");
}

export function summarizePosOrders(
  orders: PosOrder[],
  fromIso: string,
  toIso: string,
): PosSalesSummary {
  const paid = orders.filter(
    (o) => o.status === "paid" && inRange(o.closedAt ?? o.openedAt, fromIso, toIso),
  );
  const voided = orders.filter(
    (o) => o.status === "void" && inRange(o.closedAt ?? o.openedAt, fromIso, toIso),
  );
  const openCount = orders.filter((o) => o.status === "open").length;
  const heldCount = orders.filter((o) => o.status === "held").length;
  const refundedCount = orders.filter((o) => o.status === "refunded").length;

  const byMethod: Record<string, { amount: number; count: number }> = {};
  let gross = 0;
  let net = 0;
  let tax = 0;
  let discount = 0;
  for (const o of paid) {
    gross += o.totalAmount;
    net += Math.max(0, o.subtotal - o.discountAmount);
    tax += o.taxAmount;
    discount += o.discountAmount;
    if (o.payments.length === 0) {
      byMethod.unspecified = byMethod.unspecified ?? { amount: 0, count: 0 };
      byMethod.unspecified.amount += o.totalAmount;
      byMethod.unspecified.count += 1;
    } else {
      for (const p of o.payments) {
        const key = p.method || "other";
        byMethod[key] = byMethod[key] ?? { amount: 0, count: 0 };
        byMethod[key].amount += p.amount;
        byMethod[key].count += 1;
      }
    }
  }

  const hourMap = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    amount: 0,
    count: 0,
  }));
  const dayMap = new Map(eachDay(fromIso, toIso).map((day) => [day, { day, amount: 0, count: 0 }]));
  const itemMap = new Map<string, { name: string; qty: number; amount: number }>();

  for (const o of paid) {
    const when = o.closedAt ?? o.openedAt;
    const d = new Date(when);
    if (!Number.isNaN(d.getTime())) {
      hourMap[d.getHours()]!.amount += o.totalAmount;
      hourMap[d.getHours()]!.count += 1;
      const stamp = localYmd(when);
      if (stamp && dayMap.has(stamp)) {
        const bucket = dayMap.get(stamp)!;
        bucket.amount += o.totalAmount;
        bucket.count += 1;
      }
    }
    for (const item of o.items) {
      const key = item.productName.trim() || "Item";
      const row = itemMap.get(key) ?? { name: key, qty: 0, amount: 0 };
      row.qty += item.quantity;
      row.amount += item.lineTotal;
      itemMap.set(key, row);
    }
  }

  return {
    orders,
    paid,
    voided,
    paidCount: paid.length,
    voidCount: voided.length,
    openCount,
    heldCount,
    refundedCount,
    gross,
    net,
    tax,
    discount,
    avgTicket: paid.length ? gross / paid.length : 0,
    voidAmount: voided.reduce((sum, o) => sum + o.totalAmount, 0),
    byMethod,
    byHour: hourMap,
    byDay: [...dayMap.values()],
    topItems: [...itemMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 12),
  };
}
