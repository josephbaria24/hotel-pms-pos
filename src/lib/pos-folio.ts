import type { PosOrder } from "@/lib/api-client/pos-types";
import { peso } from "@/lib/reservation-payment";

/** POS sale posted to a guest room folio (due at checkout via stay balance). */
export function isPosRoomCharge(order: PosOrder) {
  return (
    order.orderType === "room_charge" ||
    order.payments.some((p) => String(p.method).toLowerCase() === "room_charge")
  );
}

export function posOrdersForReservation(orders: PosOrder[], reservationId: string) {
  return orders.filter(
    (o) =>
      o.status !== "void" &&
      o.reservationId === reservationId,
  );
}

/** Amounts already folded into reservation.total_amount — don't add again in folio math. */
export function posExtrasNotOnStay(orders: PosOrder[]) {
  return orders.filter((o) => o.status !== "void" && !isPosRoomCharge(o));
}

export function formatPosChargeSummary(orders: PosOrder[]) {
  const roomCharges = orders.filter(isPosRoomCharge);
  if (roomCharges.length === 0) return "";
  const total = roomCharges.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const due = roomCharges.reduce(
    (sum, o) => sum + Math.max(0, Number(o.totalAmount || 0) - Number(o.paidAmount || 0)),
    0,
  );
  const nums = roomCharges.map((o) => o.orderNumber).slice(0, 4).join(", ");
  const more = roomCharges.length > 4 ? ` +${roomCharges.length - 4}` : "";
  return `POS room charge ${peso(total)}${due > 0 ? ` (due ${peso(due)})` : ""} · ${nums}${more}`;
}

export function appendPosToPaymentDetails(
  base: string,
  orders: PosOrder[],
) {
  const note = formatPosChargeSummary(orders);
  if (!note) return base;
  if (!base || base === "—") return note;
  return `${base} · ${note}`;
}
