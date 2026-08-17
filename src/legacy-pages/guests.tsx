"use client";

import { useMemo, useCallback, useState, useEffect, startTransition } from "react";
import dynamic from "next/dynamic";
import { useSearch, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListGuests,
  useListReservations,
  useUpdateGuest,
  useDeleteGuest,
  getListGuestsQueryKey,
  prefetchGuestHubBookingsData,
  prefetchGuestHubStaysData,
  prefetchGuestHubDirectoryData,
  type Guest,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  CalendarDays,
  ArrowLeftRight,
  Loader2,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { GuestFolioPanel } from "@/components/guests/GuestFolioPanel";

function HubPanelFallback({ label }: { label: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

const Reservations = dynamic(() => import("@/legacy-pages/reservations"), {
  ssr: false,
  loading: () => <HubPanelFallback label="Preparing bookings…" />,
});

const CheckInOut = dynamic(() => import("@/legacy-pages/checkin"), {
  ssr: false,
  loading: () => <HubPanelFallback label="Preparing check-ins…" />,
});

type GuestTab = "directory" | "bookings" | "stays";

/** Visual order in the hub: arrivals & departures first, then bookings, directory last. */
const GUEST_HUB_TAB_ORDER: GuestTab[] = ["stays", "bookings", "directory"];

function parseGuestHubSearch(search: string): { tab: GuestTab; params: URLSearchParams } {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const t = params.get("tab");
  let tab: GuestTab = "stays";
  if (t === "directory" || t === "bookings") tab = t;
  return { tab, params };
}

function guestNameParts(g: Guest): { firstName: string; lastName: string } {
  if (g.firstName?.trim() || g.lastName?.trim()) {
    return { firstName: (g.firstName ?? "").trim(), lastName: (g.lastName ?? "").trim() };
  }
  const parts = g.fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const TAB_META: Record<
  GuestTab,
  {
    label: string;
    shortLabel: string;
    hint: string;
    icon: typeof ArrowLeftRight;
    activeClass: string;
    badgeClass: string;
  }
> = {
  stays: {
    label: "Check-ins & outs",
    shortLabel: "Stays",
    hint: "Today’s arrivals and departures",
    icon: ArrowLeftRight,
    activeClass: "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-600/30",
    badgeClass: "bg-white/20 text-white border-white/30",
  },
  bookings: {
    label: "Bookings",
    shortLabel: "Bookings",
    hint: "Reservations & new booking",
    icon: CalendarDays,
    activeClass: "bg-sky-600 text-white shadow-sm ring-1 ring-sky-600/30",
    badgeClass: "bg-white/20 text-white border-white/30",
  },
  directory: {
    label: "Guest Folio",
    shortLabel: "Folio",
    hint: "Stays, bills, and payments",
    icon: Wallet,
    activeClass: "bg-foreground text-background shadow-sm",
    badgeClass: "bg-background/20 text-background border-background/30",
  },
};

export default function Guests() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    data: guests,
    isLoading,
    isFetching: guestsFetching,
    isError: guestsError,
    error: guestsErr,
    refetch: refetchGuests,
  } = useListGuests();
  const {
    data: reservations,
    isLoading: reservationsLoading,
    isFetching: reservationsFetching,
    isError: reservationsError,
    error: reservationsErr,
    refetch: refetchReservations,
  } = useListReservations();
  const updateGuestMutation = useUpdateGuest();
  const deleteGuestMutation = useDeleteGuest();

  const { tab: activeTab, params: urlParams } = useMemo(() => parseGuestHubSearch(search), [search]);
  const directoryQuery = urlParams.get("q") ?? "";
  const selectedGuestId = urlParams.get("guest");

  // Warm directory cache; heavy tabs prefetch their own data when opened or hovered.
  useEffect(() => {
    void prefetchGuestHubDirectoryData(queryClient);
  }, [queryClient]);

  const tabLoading = useMemo(
    () =>
      ({
        directory: isLoading || (guestsFetching && !guests),
        bookings: reservationsLoading || (reservationsFetching && !reservations),
        stays: reservationsLoading || (reservationsFetching && !reservations),
      }) as Record<GuestTab, boolean>,
    [
      isLoading,
      guestsFetching,
      guests,
      reservationsLoading,
      reservationsFetching,
      reservations,
    ],
  );

  const tabRefreshing = useMemo(
    () =>
      ({
        directory: Boolean(guests && guestsFetching),
        bookings: Boolean(reservations && reservationsFetching),
        stays: Boolean(reservations && reservationsFetching),
      }) as Record<GuestTab, boolean>,
    [guests, guestsFetching, reservations, reservationsFetching],
  );
  const tabBadges = useMemo(() => {
    const list = reservations ?? [];
    const today = todayYmd();
    const arrivalsToday = list.filter(
      (r) => r.status === "reserved" && r.checkInDate.slice(0, 10) === today,
    ).length;
    const departuresToday = list.filter(
      (r) => r.status === "checked_in" && r.checkOutDate.slice(0, 10) === today,
    ).length;
    const reservedBookings = list.filter((r) => r.status === "reserved").length;
    const outstandingFolios = (guests ?? []).filter((g) => {
      const due = (reservations ?? [])
        .filter((r) => r.guestId === g.id && r.status !== "cancelled" && r.status !== "no_show")
        .reduce((sum, r) => sum + Number(r.balance || 0), 0);
      return due > 0;
    }).length;

    return {
      stays: arrivalsToday + departuresToday,
      bookings: reservedBookings,
      directory: outstandingFolios,
    } as Record<GuestTab, number>;
  }, [reservations, guests]);

  const [directoryStaysFilter, setDirectoryStaysFilter] = useState<"all" | "has" | "none">("all");
  const [directorySort, setDirectorySort] = useState<"name" | "stays_desc" | "stays_asc">("name");

  const [editGuest, setEditGuest] = useState<Guest | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", contactNumber: "", email: "" });
  const [deleteGuest, setDeleteGuest] = useState<Guest | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    if (!editGuest) return;
    const { firstName, lastName } = guestNameParts(editGuest);
    setEditForm({
      firstName,
      lastName,
      contactNumber: editGuest.contactNumber ?? "",
      email: editGuest.email ?? "",
    });
  }, [editGuest]);

  useEffect(() => {
    if (!deleteGuest) setDeleteConfirmText("");
  }, [deleteGuest]);

  /** Once a heavy tab is opened, keep it mounted and only toggle visibility (avoids remount cost). */
  const [heavyPanelsMounted, setHeavyPanelsMounted] = useState(() => {
    const t = parseGuestHubSearch(search).tab;
    return { bookings: t === "bookings", stays: t === "stays" };
  });
  useEffect(() => {
    if (activeTab === "bookings" || activeTab === "stays") {
      setHeavyPanelsMounted((m) => (m[activeTab] ? m : { ...m, [activeTab]: true }));
    }
  }, [activeTab]);

  const setHubTab = useCallback(
    (next: GuestTab) => {
      // Mount target panel before navigating so content is ready.
      if (next === "bookings" || next === "stays") {
        setHeavyPanelsMounted((m) => (m[next] ? m : { ...m, [next]: true }));
      }
      startTransition(() => {
        const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
        p.set("tab", next);
        if (next !== "directory") {
          p.delete("q");
          p.delete("guest");
        }
        if (next !== "bookings") p.delete("search");
        const qs = p.toString();
        setLocation(qs ? `/guests?${qs}` : "/guests");
      });
    },
    [search, setLocation],
  );

  const setDirectoryQuery = useCallback(
    (q: string) => {
      startTransition(() => {
        const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
        p.set("tab", "directory");
        p.delete("search");
        if (q.trim()) p.set("q", q.trim());
        else p.delete("q");
        const qs = p.toString();
        setLocation(qs ? `/guests?${qs}` : "/guests");
      });
    },
    [search, setLocation],
  );

  const setSelectedGuest = useCallback(
    (id: string | null) => {
      startTransition(() => {
        const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
        p.set("tab", "directory");
        p.delete("search");
        if (id) p.set("guest", id);
        else p.delete("guest");
        const qs = p.toString();
        setLocation(qs ? `/guests?${qs}` : "/guests");
      });
    },
    [search, setLocation],
  );

  const prefetchTab = useCallback(
    (id: GuestTab) => {
      if (id === "directory") void prefetchGuestHubDirectoryData(queryClient);
      if (id === "bookings") {
        void import("@/legacy-pages/reservations");
        void prefetchGuestHubBookingsData(queryClient);
      }
      if (id === "stays") {
        void import("@/legacy-pages/checkin");
        void prefetchGuestHubStaysData(queryClient);
      }
    },
    [queryClient],
  );

  const saveGuestEdit = async () => {
    if (!editGuest) return;
    try {
      await updateGuestMutation.mutateAsync({
        id: editGuest.id,
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        contactNumber: editForm.contactNumber.trim(),
        email: editForm.email.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey() });
      toast({ title: "Guest updated" });
      setEditGuest(null);
    } catch (e) {
      toast({
        title: "Could not save guest",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteGuest = async () => {
    if (!deleteGuest) return;
    try {
      await deleteGuestMutation.mutateAsync(deleteGuest.id);
      await queryClient.invalidateQueries({ queryKey: getListGuestsQueryKey() });
      toast({ title: "Guest removed" });
      setDeleteGuest(null);
    } catch (e) {
      toast({
        title: "Could not delete guest",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const deleteOk = deleteGuest && deleteConfirmText.trim() === deleteGuest.fullName.trim();

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-zinc-200/70 dark:bg-zinc-600/10 border-0 p-3 space-y-3">
        {/* Header Block */}
        <div className="px-2 pt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Guests &amp; Stays</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage guest folios, check-ins, check-outs, and bookings.
            </p>
          </div>

          {/* Hub tabs */}
          <div
            role="tablist"
            aria-label="Guests and stays sections"
            className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end"
          >
            {GUEST_HUB_TAB_ORDER.map((id) => {
              const meta = TAB_META[id];
              const Icon = meta.icon;
              const selected = activeTab === id;
              const count = tabBadges[id];
              const showBadge = count > 0 && !tabLoading[id];
              const loading = tabLoading[id];
              const refreshing = selected && tabRefreshing[id];
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-busy={loading || refreshing}
                  title={meta.hint}
                  onClick={() => setHubTab(id)}
                  onPointerEnter={() => prefetchTab(id)}
                  onFocus={() => prefetchTab(id)}
                  className={cn(
                    "group relative flex min-h-[3.25rem] items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition-all outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? meta.activeClass
                      : "border-border/80 bg-card text-foreground hover:border-foreground/20 hover:bg-muted/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      selected ? "bg-white/15" : "bg-muted text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    {loading || refreshing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold leading-tight">
                        <span className="sm:hidden">{meta.shortLabel}</span>
                        <span className="hidden sm:inline">{meta.label}</span>
                      </span>
                      {loading ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 rounded-full px-1.5 text-[10px] font-semibold",
                            selected
                              ? "border-white/30 bg-white/15 text-white"
                              : "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          Loading
                        </Badge>
                      ) : showBadge ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                            selected
                              ? meta.badgeClass
                              : id === "stays"
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : id === "bookings"
                                  ? "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                  : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
                          )}
                        >
                          {count > 99 ? "99+" : count}
                        </Badge>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-[11px] leading-tight",
                        selected ? "text-white/80" : "text-muted-foreground",
                      )}
                    >
                      {loading ? "Fetching latest…" : meta.hint}
                    </span>
                  </span>
                  {showBadge && !selected ? (
                    <span
                      className={cn(
                        "absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-background",
                        id === "stays"
                          ? "bg-emerald-500"
                          : id === "bookings"
                            ? "bg-sky-500"
                            : "bg-amber-500",
                      )}
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {guestsError || reservationsError ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="text-destructive">
              {(guestsErr instanceof Error && guestsErr.message) ||
                (reservationsErr instanceof Error && reservationsErr.message) ||
                "Could not load guest or booking data."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0"
              onClick={() => {
                void refetchGuests();
                void refetchReservations();
              }}
            >
              Retry
            </Button>
          </div>
        ) : null}

        {tabLoading[activeTab] ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/80 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading {TAB_META[activeTab].label.toLowerCase()}…
          </div>
        ) : null}

        {/* Folio Panel: always mounted; hidden when another tab is active. */}
        <section
          role="tabpanel"
          id="guests-panel-directory"
          hidden={activeTab !== "directory"}
          className={cn("space-y-3", activeTab !== "directory" && "hidden")}
          aria-hidden={activeTab !== "directory"}
        >
          <GuestFolioPanel
            guests={guests}
            reservations={reservations}
            isLoading={isLoading}
            searchQuery={directoryQuery}
            onSearchQueryChange={setDirectoryQuery}
            staysFilter={directoryStaysFilter}
            onStaysFilterChange={setDirectoryStaysFilter}
            sort={directorySort}
            onSortChange={setDirectorySort}
            selectedGuestId={selectedGuestId}
            onSelectGuest={setSelectedGuest}
            onEditGuest={setEditGuest}
            onDeleteGuest={setDeleteGuest}
            active={activeTab === "directory"}
          />
        </section>

        {heavyPanelsMounted.bookings ? (
          <section
            role="tabpanel"
            id="guests-panel-bookings"
            hidden={activeTab !== "bookings"}
            className={cn("min-w-0", activeTab !== "bookings" && "hidden")}
            aria-hidden={activeTab !== "bookings"}
          >
            <Reservations embedded />
          </section>
        ) : activeTab === "bookings" ? (
          <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing bookings…
          </div>
        ) : null}

        {heavyPanelsMounted.stays ? (
          <section
            role="tabpanel"
            id="guests-panel-stays"
            hidden={activeTab !== "stays"}
            className={cn("min-w-0", activeTab !== "stays" && "hidden")}
            aria-hidden={activeTab !== "stays"}
          >
            <CheckInOut embedded />
          </section>
        ) : activeTab === "stays" ? (
          <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing check-ins…
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(editGuest)} onOpenChange={(o) => !o && setEditGuest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit guest</DialogTitle>
            <DialogDescription>Update name and contact information.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="eg-fn">First name</Label>
              <Input
                id="eg-fn"
                value={editForm.firstName}
                onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eg-ln">Last name</Label>
              <Input
                id="eg-ln"
                value={editForm.lastName}
                onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="eg-ph">Phone</Label>
              <Input
                id="eg-ph"
                value={editForm.contactNumber}
                onChange={(e) => setEditForm((f) => ({ ...f, contactNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="eg-em">Email</Label>
              <Input
                id="eg-em"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGuest(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveGuestEdit()} disabled={updateGuestMutation.isPending}>
              {updateGuestMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteGuest)} onOpenChange={(o) => !o && setDeleteGuest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this guest?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Guests with any reservation history cannot be deleted. Type the full name{" "}
              <span className="font-semibold text-foreground">{deleteGuest?.fullName}</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={deleteGuest?.fullName ?? ""}
            autoComplete="off"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!deleteOk || deleteGuestMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteGuest();
              }}
            >
              {deleteGuestMutation.isPending ? "Deleting…" : "Delete guest"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
