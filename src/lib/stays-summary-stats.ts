import type { Reservation } from "@/lib/api-client/types";
import { staysOverlap } from "@/lib/datetime";

export function ymd(value: string): string {
  return value.slice(0, 10);
}

export function dayAfter(date: string): string {
  const [y, m, d] = ymd(date).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + 1));
  return dt.toISOString().slice(0, 10);
}

export function stayOverlapsRange(res: Reservation, from: string, to: string): boolean {
  return staysOverlap(ymd(res.checkInDate), ymd(res.checkOutDate), from, dayAfter(to));
}

export function dateInRange(iso: string, from: string, to: string): boolean {
  const day = ymd(iso);
  return day >= from && day <= to;
}

export function isCancelled(status: string): boolean {
  return status === "cancelled" || status === "no_show";
}

export function countStaySummary(reservations: Reservation[], from: string, to: string) {
  const list = reservations.filter((r) => stayOverlapsRange(r, from, to));
  const active = list.filter((r) => !isCancelled(r.status));
  const checkIns = reservations.filter(
    (r) => !isCancelled(r.status) && dateInRange(r.checkInDate, from, to),
  );
  const checkOuts = reservations.filter(
    (r) => !isCancelled(r.status) && dateInRange(r.checkOutDate, from, to),
  );
  const occupiedRooms = new Set(active.map((r) => r.roomNumber)).size;
  return {
    reservations: list.length,
    checkIns: checkIns.length,
    checkOuts: checkOuts.length,
    occupiedRooms,
  };
}
