"use client";

import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import {
  useListPayments,
  type Guest,
  type Payment,
  type Reservation,
} from "@workspace/api-client-react";
import { usePosOrders } from "@/lib/api-client/pos";
import type { PosOrder } from "@/lib/api-client/pos-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatPhDate, formatPhDateTime } from "@/lib/datetime";
import {
  ArrowLeft,
  BedDouble,
  CreditCard,
  IdCard,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Receipt,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";

function formatPhp(n: number) {
  return `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function stayStatusClass(status: string) {
  switch (status) {
    case "checked_in":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
    case "checked_out":
      return "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300";
    case "reserved":
      return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300";
    case "cancelled":
    case "no_show":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

const AVATAR_PALETTE = [
  "bg-rose-500/85 text-white",
  "bg-amber-500/85 text-white",
  "bg-emerald-500/85 text-white",
  "bg-sky-500/85 text-white",
  "bg-violet-500/85 text-white",
  "bg-fuchsia-500/85 text-white",
  "bg-teal-500/85 text-white",
  "bg-indigo-500/85 text-white",
];

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "?"
  );
}

function isActiveStay(status: string) {
  return status !== "cancelled" && status !== "no_show";
}

function paxLabel(res: Reservation) {
  const adults = Number(res.adults || 0);
  const children = Number(res.children || 0);
  if (children > 0) return `${adults} adult${adults === 1 ? "" : "s"} · ${children} child${children === 1 ? "" : "ren"}`;
  return `${adults} guest${adults === 1 ? "" : "s"}`;
}

export type GuestFolioPanelProps = {
  guests: Guest[] | undefined;
  reservations: Reservation[] | undefined;
  isLoading: boolean;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  staysFilter: "all" | "has" | "none";
  onStaysFilterChange: (v: "all" | "has" | "none") => void;
  sort: "name" | "stays_desc" | "stays_asc";
  onSortChange: (v: "name" | "stays_desc" | "stays_asc") => void;
  selectedGuestId: string | null;
  onSelectGuest: (id: string | null) => void;
  onEditGuest: (guest: Guest) => void;
  onDeleteGuest: (guest: Guest) => void;
  /** Only auto-select a guest (and write the URL) while this tab is visible. */
  active?: boolean;
};

export function GuestFolioPanel({
  guests,
  reservations,
  isLoading,
  searchQuery,
  onSearchQueryChange,
  staysFilter,
  onStaysFilterChange,
  sort,
  onSortChange,
  selectedGuestId,
  onSelectGuest,
  onEditGuest,
  onDeleteGuest,
  active = false,
}: GuestFolioPanelProps) {
  const { data: payments = [], isLoading: paymentsLoading } = useListPayments();
  const { data: posOrders = [], isLoading: posLoading } = usePosOrders("all");

  const filtered = useMemo(() => {
    const list = guests ?? [];
    const q = searchQuery.trim().toLowerCase();
    let out = list.filter((g) => {
      const matchesQ =
        !q ||
        g.fullName.toLowerCase().includes(q) ||
        (g.contactNumber || "").toLowerCase().includes(q) ||
        (g.email || "").toLowerCase().includes(q) ||
        (g.address || "").toLowerCase().includes(q) ||
        (g.idNumber || "").toLowerCase().includes(q);
      if (!matchesQ) return false;
      if (staysFilter === "has") return g.totalStays > 0;
      if (staysFilter === "none") return g.totalStays === 0;
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sort === "name") return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
      if (sort === "stays_desc") return b.totalStays - a.totalStays || a.fullName.localeCompare(b.fullName);
      return a.totalStays - b.totalStays || a.fullName.localeCompare(b.fullName);
    });
    return out;
  }, [guests, searchQuery, staysFilter, sort]);

  const staysByGuest = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const res of reservations ?? []) {
      const list = map.get(res.guestId) ?? [];
      list.push(res);
      map.set(res.guestId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (b.createdAt || b.checkInDate).localeCompare(a.createdAt || a.checkInDate));
    }
    return map;
  }, [reservations]);

  const balanceByGuest = useMemo(() => {
    const map = new Map<string, number>();
    for (const res of reservations ?? []) {
      if (!isActiveStay(res.status)) continue;
      map.set(res.guestId, (map.get(res.guestId) ?? 0) + Number(res.balance || 0));
    }
    return map;
  }, [reservations]);

  const didAutoSelect = useRef(false);

  useEffect(() => {
    if (!active || isLoading) return;
    if (selectedGuestId && filtered.some((g) => g.id === selectedGuestId)) return;
    if (selectedGuestId && filtered.length > 0) {
      onSelectGuest(filtered[0]!.id);
      return;
    }
    if (!didAutoSelect.current && !selectedGuestId && filtered[0]) {
      didAutoSelect.current = true;
      onSelectGuest(filtered[0].id);
    }
  }, [active, filtered, isLoading, onSelectGuest, selectedGuestId]);

  const selected = filtered.find((g) => g.id === selectedGuestId) ?? null;
  const guestStays = selected ? staysByGuest.get(selected.id) ?? [] : [];
  const guestPayments = useMemo(
    () => payments.filter((p) => guestStays.some((s) => s.id === p.reservationId)),
    [payments, guestStays],
  );

  const guestPos = useMemo(
    () =>
      posOrders.filter(
        (o) =>
          o.status !== "void" &&
          (o.guestId === selected?.id ||
            Boolean(o.reservationId && guestStays.some((s) => s.id === o.reservationId))),
      ),
    [posOrders, selected?.id, guestStays],
  );

  const folio = useMemo(() => {
    const active = guestStays.filter((s) => isActiveStay(s.status));
    const roomCharges = active.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const roomPaid = active.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
    const posCharges = guestPos.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const posPaid = guestPos.reduce((sum, o) => sum + Number(o.paidAmount || 0), 0);
    return {
      stays: guestStays.length,
      activeStays: active.length,
      roomCharges,
      roomPaid,
      posCharges,
      posPaid,
      billed: roomCharges + posCharges,
      collected: roomPaid + posPaid,
      balance: Math.max(0, roomCharges - roomPaid) + Math.max(0, posCharges - posPaid),
    };
  }, [guestStays, guestPos]);

  const paymentsByStay = useMemo(() => {
    const map = new Map<string, Payment[]>();
    for (const p of guestPayments) {
      const list = map.get(p.reservationId) ?? [];
      list.push(p);
      map.set(p.reservationId, list);
    }
    return map;
  }, [guestPayments]);

  const posByStay = useMemo(() => {
    const stayIdSet = new Set(guestStays.map((s) => s.id));
    const map = new Map<string, PosOrder[]>();
    const unassigned: PosOrder[] = [];
    for (const o of guestPos) {
      if (o.reservationId && stayIdSet.has(o.reservationId)) {
        const list = map.get(o.reservationId) ?? [];
        list.push(o);
        map.set(o.reservationId, list);
      } else {
        unassigned.push(o);
      }
    }
    return { map, unassigned };
  }, [guestPos, guestStays]);

  const showListOnly = !selected;
  const showDetailOnly = Boolean(selected);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-card p-3 shadow-sm space-y-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
        <div className="relative max-w-md flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="tab-directory"
            placeholder="Search guests, phone, email, ID…"
            className="h-9 rounded-full border bg-card pl-9 text-xs"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={staysFilter} onValueChange={(v) => onStaysFilterChange(v as typeof staysFilter)}>
            <SelectTrigger className="h-9 w-[150px] rounded-full bg-card text-xs">
              <SelectValue placeholder="Stays" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <SelectItemText>All guests</SelectItemText>
              </SelectItem>
              <SelectItem value="has">
                <SelectItemText>With stays</SelectItemText>
              </SelectItem>
              <SelectItem value="none">
                <SelectItemText>No stays yet</SelectItemText>
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => onSortChange(v as typeof sort)}>
            <SelectTrigger className="h-9 w-[155px] rounded-full bg-card text-xs">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">
                <SelectItemText>Sort: Name (A–Z)</SelectItemText>
              </SelectItem>
              <SelectItem value="stays_desc">
                <SelectItemText>Sort: Most stays</SelectItemText>
              </SelectItem>
              <SelectItem value="stays_asc">
                <SelectItemText>Sort: Fewest stays</SelectItemText>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid min-h-[28rem] gap-3 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
        <aside
          className={cn(
            "flex min-h-0 flex-col rounded-xl border bg-muted/20",
            showDetailOnly && "hidden lg:flex",
            showListOnly && "flex",
          )}
        >
          <div className="border-b px-3 py-2 text-[11px] font-medium text-muted-foreground">
            {isLoading ? "Loading guests…" : `${filtered.length} guest${filtered.length === 1 ? "" : "s"}`}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="mb-1.5 rounded-xl border bg-card p-2.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-2 h-3 w-20" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <p className="px-3 py-10 text-center text-xs text-muted-foreground">
                {guests?.length === 0 ? "No guests yet." : "No guests match your filters."}
              </p>
            ) : (
              filtered.map((guest) => {
                const selectedRow = guest.id === selected?.id;
                const bal = balanceByGuest.get(guest.id) ?? 0;
                return (
                  <button
                    key={guest.id}
                    type="button"
                    onClick={() => onSelectGuest(guest.id)}
                    className={cn(
                      "mb-1.5 flex w-full items-start gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                      selectedRow
                        ? "border-foreground/20 bg-card shadow-sm ring-1 ring-foreground/10"
                        : "border-transparent bg-transparent hover:border-border hover:bg-card/80",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        avatarColor(guest.fullName),
                      )}
                    >
                      {getInitials(guest.fullName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{guest.fullName}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                        <span>{guest.totalStays} stay{guest.totalStays === 1 ? "" : "s"}</span>
                        {bal > 0 ? (
                          <span className="font-medium text-amber-700 dark:text-amber-400">{formatPhp(bal)} due</span>
                        ) : (
                          <span>Settled</span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section
          className={cn(
            "min-w-0 rounded-xl border bg-background",
            !selected && "hidden lg:block",
          )}
        >
          {!selected ? (
            <div className="flex h-full min-h-[24rem] items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Select a guest to open their folio.
            </div>
          ) : (
            <div className="flex min-h-0 flex-col">
              <header className="border-b px-4 py-4 sm:px-5">
                <div className="flex items-start gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-0.5 h-8 w-8 lg:hidden"
                    onClick={() => onSelectGuest(null)}
                    aria-label="Back to guest list"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span
                    className={cn(
                      "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold",
                      avatarColor(selected.fullName),
                    )}
                  >
                    {getInitials(selected.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold tracking-tight">{selected.fullName}</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Guest folio
                          {selected.createdAt ? ` · registered ${formatPhDate(selected.createdAt)}` : ""}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Folio actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => onEditGuest(selected)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit guest
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDeleteGuest(selected)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <FolioFact icon={Phone} label="Phone" value={selected.contactNumber} />
                      <FolioFact icon={Mail} label="Email" value={selected.email} />
                      <FolioFact icon={MapPin} label="Address" value={selected.address} />
                      <FolioFact
                        icon={IdCard}
                        label="ID"
                        value={
                          selected.idType || selected.idNumber
                            ? `${selected.idType || "ID"}${selected.idNumber ? ` · ${selected.idNumber}` : ""}`
                            : null
                        }
                      />
                      {selected.nationality ? (
                        <FolioFact icon={Wallet} label="Nationality" value={selected.nationality} />
                      ) : null}
                    </div>
                    {selected.notes ? (
                      <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        {selected.notes}
                      </p>
                    ) : null}
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-4 sm:px-5">
                <Kpi label="Stays" value={String(folio.stays)} />
                <Kpi label="Total billed" value={formatPhp(folio.billed)} />
                <Kpi label="Collected" value={formatPhp(folio.collected)} tone="good" />
                <Kpi label="Balance due" value={formatPhp(folio.balance)} tone={folio.balance > 0 ? "warn" : "good"} />
              </div>

              <div className="space-y-4 px-4 pb-5 sm:px-5">
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Stays &amp; bills
                  </h3>
                  {guestStays.length === 0 ? (
                    <p className="rounded-xl border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
                      No reservations on this folio yet.
                    </p>
                  ) : (
                    guestStays.map((stay) => (
                      <StayFolioCard
                        key={stay.id}
                        stay={stay}
                        payments={paymentsByStay.get(stay.id) ?? []}
                        posOrders={posByStay.map.get(stay.id) ?? []}
                        paymentsLoading={paymentsLoading}
                        posLoading={posLoading}
                      />
                    ))
                  )}
                </section>

                {posByStay.unassigned.length > 0 ? (
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Other POS charges
                    </h3>
                    <div className="rounded-xl border p-3 space-y-2">
                      {posByStay.unassigned.map((order) => (
                        <PosLine key={order.id} order={order} />
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    All payments
                  </h3>
                  {paymentsLoading ? (
                    <Skeleton className="h-16 w-full rounded-xl" />
                  ) : guestPayments.length === 0 && guestPos.every((o) => o.payments.length === 0) ? (
                    <p className="rounded-xl border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
                      No payments recorded for this guest.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-xl border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/70 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">When</th>
                            <th className="px-3 py-2 text-left font-medium">Ref</th>
                            <th className="px-3 py-2 text-left font-medium">Method</th>
                            <th className="px-3 py-2 text-right font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {guestPayments.map((p) => (
                            <tr key={p.id} className="border-t">
                              <td className="px-3 py-2 whitespace-nowrap">{formatPhDateTime(p.createdAt)}</td>
                              <td className="px-3 py-2">
                                <span className="font-mono">{p.receiptNumber}</span>
                                <span className="ml-1.5 text-muted-foreground">
                                  {p.reservationNumber || "Stay"}
                                </span>
                              </td>
                              <td className="px-3 py-2 capitalize">{p.paymentMethod || p.method}</td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatPhp(p.amount)}</td>
                            </tr>
                          ))}
                          {guestPos.flatMap((o) =>
                            o.payments.map((p) => (
                              <tr key={p.id} className="border-t">
                                <td className="px-3 py-2 whitespace-nowrap">{formatPhDateTime(p.createdAt)}</td>
                                <td className="px-3 py-2">
                                  <span className="font-mono">{o.orderNumber}</span>
                                  <span className="ml-1.5 text-muted-foreground">POS</span>
                                </td>
                                <td className="px-3 py-2 capitalize">{p.method.replace(/_/g, " ")}</td>
                                <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatPhp(p.amount)}</td>
                              </tr>
                            )),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FolioFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value?.trim() || "—"}</p>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="rounded-xl border bg-muted/30 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-bold tabular-nums sm:text-base",
          tone === "good" && "text-emerald-700 dark:text-emerald-400",
          tone === "warn" && "text-amber-700 dark:text-amber-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StayFolioCard({
  stay,
  payments,
  posOrders,
  paymentsLoading,
  posLoading,
}: {
  stay: Reservation;
  payments: Payment[];
  posOrders: PosOrder[];
  paymentsLoading: boolean;
  posLoading: boolean;
}) {
  const [, setLocation] = useLocation();
  const extras = posOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const billed = Number(stay.totalAmount || 0) + extras;
  const collected = Number(stay.paidAmount || 0) + posOrders.reduce((sum, o) => sum + Number(o.paidAmount || 0), 0);
  const due = Math.max(0, billed - collected);

  return (
    <article className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs font-semibold">{stay.reservationNumber}</p>
            <Badge variant="outline" className={cn("h-5 capitalize px-1.5 text-[10px]", stayStatusClass(stay.status))}>
              {statusLabel(stay.status)}
            </Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {stay.roomNumber ? (
              <button
                type="button"
                title={`View room ${stay.roomNumber}`}
                onClick={() =>
                  setLocation(`/rooms?room=${encodeURIComponent(stay.roomId || stay.roomNumber)}`)
                }
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 -ml-1.5 font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
              >
                <BedDouble className="h-3 w-3" />
                Room {stay.roomNumber}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1">
                <BedDouble className="h-3 w-3" />
                Room —
              </span>
            )}
            <span>{paxLabel(stay)}</span>
            {stay.createdAt ? <span>Booked {formatPhDateTime(stay.createdAt)}</span> : null}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Stay balance</p>
          <p className={cn("text-sm font-bold tabular-nums", due > 0 ? "text-amber-700" : "text-emerald-700")}>
            {formatPhp(due)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
        <div className="rounded-xl bg-muted/40 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            <LogIn className="h-3 w-3" />
            Arrival
          </p>
          <p className="mt-1 text-sm font-medium">{formatPhDate(stay.checkInDate)}</p>
          <p className="text-[11px] text-muted-foreground">
            Actual: {stay.actualCheckInAt ? formatPhDateTime(stay.actualCheckInAt) : "Not checked in"}
          </p>
        </div>
        <div className="rounded-xl bg-muted/40 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
            <LogOut className="h-3 w-3" />
            Checkout
          </p>
          <p className="mt-1 text-sm font-medium">{formatPhDate(stay.checkOutDate)}</p>
          <p className="text-[11px] text-muted-foreground">
            Actual: {stay.actualCheckOutAt ? formatPhDateTime(stay.actualCheckOutAt) : "Not checked out"}
          </p>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="overflow-hidden rounded-xl border">
          <div className="flex items-center justify-between gap-2 bg-muted/60 px-3 py-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Receipt className="h-3 w-3" />
              Charges
            </div>
            <button
              type="button"
              title="Edit charges in billing"
              aria-label="Edit charges in billing"
              onClick={() =>
                setLocation(`/billing?reservation=${encodeURIComponent(stay.id)}`)
              }
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          <dl className="divide-y text-xs">
            <ChargeRow label="Room / stay" value={formatPhp(stay.totalAmount)} />
            <ChargeRow label="POS / extras" value={formatPhp(extras)} muted={extras === 0} />
            <ChargeRow label="Total billed" value={formatPhp(billed)} strong />
            <ChargeRow label="Paid on stay" value={formatPhp(stay.paidAmount)} />
            <ChargeRow label="Balance" value={formatPhp(due)} strong warn={due > 0} />
          </dl>
        </div>
        {stay.notes ? (
          <p className="mt-2 text-[11px] text-muted-foreground">Notes: {stay.notes}</p>
        ) : null}
      </div>

      {posLoading ? null : posOrders.length > 0 ? (
        <div className="border-t px-4 py-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">POS bills</p>
          {posOrders.map((order) => (
            <PosLine key={order.id} order={order} />
          ))}
        </div>
      ) : null}

      <div className="border-t px-4 py-3">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <CreditCard className="h-3 w-3" />
          Payments on this stay
        </p>
        {paymentsLoading ? (
          <Skeleton className="h-8 w-full" />
        ) : payments.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No front-office payments yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{formatPhDateTime(p.createdAt)}</span>
                  <span className="ml-2 capitalize text-muted-foreground">{p.paymentMethod || p.method}</span>
                  {p.referenceNo ? (
                    <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{p.referenceNo}</span>
                  ) : null}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatPhp(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

function ChargeRow({
  label,
  value,
  strong,
  muted,
  warn,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5">
      <dt className={cn("text-muted-foreground", strong && "font-medium text-foreground")}>{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          strong && "font-semibold",
          muted && "text-muted-foreground",
          warn && "font-semibold text-amber-700",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function PosLine({ order }: { order: PosOrder }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold">{order.orderNumber}</p>
          <p className="text-[11px] capitalize text-muted-foreground">
            {order.orderType.replace(/_/g, " ")} · {order.status}
            {order.roomNumber ? ` · Room ${order.roomNumber}` : ""}
          </p>
        </div>
        <p className="shrink-0 text-xs font-semibold tabular-nums">{formatPhp(order.totalAmount)}</p>
      </div>
      {order.items.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-2">
              <span className="truncate">
                {item.quantity}× {item.productName}
              </span>
              <span className="tabular-nums">{formatPhp(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
