import { useMemo, useCallback, useState, useEffect, startTransition } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  BookUser,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  CalendarDays,
  ArrowLeftRight,
  Loader2,
} from "lucide-react";
import { ScrollableTablePane } from "@/components/layout/ScrollableTablePane";
import { cn } from "@/lib/utils";
import Reservations from "@/legacy-pages/reservations";
import CheckInOut from "@/legacy-pages/checkin";
import { useToast } from "@/hooks/use-toast";

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
    label: "Guest directory",
    shortLabel: "Directory",
    hint: "Names, contacts, stay counts",
    icon: BookUser,
    activeClass: "bg-foreground text-background shadow-sm",
    badgeClass: "bg-background/20 text-background border-background/30",
  },
};

export default function Guests() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: guests, isLoading, isFetching: guestsFetching } = useListGuests();
  const {
    data: reservations,
    isLoading: reservationsLoading,
    isFetching: reservationsFetching,
  } = useListReservations();
  const updateGuestMutation = useUpdateGuest();
  const deleteGuestMutation = useDeleteGuest();

  const { tab: activeTab, params: urlParams } = useMemo(() => parseGuestHubSearch(search), [search]);
  const directoryQuery = urlParams.get("q") ?? "";

  // Warm cache once so tab switches do not wait on first fetch.
  useEffect(() => {
    void prefetchGuestHubDirectoryData(queryClient);
    void prefetchGuestHubBookingsData(queryClient);
    void prefetchGuestHubStaysData(queryClient);
  }, [queryClient]);

  // Keep all hub panels mounted after first visit to this page (instant tab switches).
  const [panelsReady, setPanelsReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setPanelsReady(true), 0);
    return () => window.clearTimeout(id);
  }, []);

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
    const newDirectory = (guests ?? []).filter((g) => (g.totalStays ?? 0) === 0).length;

    return {
      stays: arrivalsToday + departuresToday,
      bookings: reservedBookings,
      directory: newDirectory,
    } as Record<GuestTab, number>;
  }, [reservations, guests]);

  const [directoryStaysFilter, setDirectoryStaysFilter] = useState<"all" | "has" | "none">("all");
  const [directorySort, setDirectorySort] = useState<"name" | "stays_desc" | "stays_asc">("name");

  const [viewGuest, setViewGuest] = useState<Guest | null>(null);
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

  // Also mount the other heavy panels in the background after paint.
  useEffect(() => {
    if (!panelsReady) return;
    setHeavyPanelsMounted({ bookings: true, stays: true });
  }, [panelsReady]);

  const setHubTab = useCallback(
    (next: GuestTab) => {
      // Mount target panel before navigating so content is ready.
      if (next === "bookings" || next === "stays") {
        setHeavyPanelsMounted((m) => (m[next] ? m : { ...m, [next]: true }));
      }
      startTransition(() => {
        const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
        p.set("tab", next);
        if (next !== "directory") p.delete("q");
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

  const prefetchTab = useCallback(
    (id: GuestTab) => {
      if (id === "directory") void prefetchGuestHubDirectoryData(queryClient);
      if (id === "bookings") void prefetchGuestHubBookingsData(queryClient);
      if (id === "stays") void prefetchGuestHubStaysData(queryClient);
    },
    [queryClient],
  );

  const filtered = useMemo(() => {
    const list = guests ?? [];
    const q = directoryQuery.trim().toLowerCase();
    let out = list.filter((g) => {
      const matchesQ =
        !q ||
        g.fullName.toLowerCase().includes(q) ||
        (g.contactNumber || "").toLowerCase().includes(q) ||
        (g.email || "").toLowerCase().includes(q);
      if (!matchesQ) return false;
      if (directoryStaysFilter === "has") return g.totalStays > 0;
      if (directoryStaysFilter === "none") return g.totalStays === 0;
      return true;
    });
    out = [...out].sort((a, b) => {
      if (directorySort === "name") return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
      if (directorySort === "stays_desc") return b.totalStays - a.totalStays || a.fullName.localeCompare(b.fullName);
      return a.totalStays - b.totalStays || a.fullName.localeCompare(b.fullName);
    });
    return out;
  }, [guests, directoryQuery, directoryStaysFilter, directorySort]);

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
              Manage hostel resident directory, check-ins, check-outs, and bookings.
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

        {tabLoading[activeTab] ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/80 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading {TAB_META[activeTab].label.toLowerCase()}…
          </div>
        ) : null}

        {/* Directory Panel: always mounted; hidden when another tab is active (cheap vs heavy tabs). */}
        <section
          role="tabpanel"
          id="guests-panel-directory"
          hidden={activeTab !== "directory"}
          className={cn("space-y-3", activeTab !== "directory" && "hidden")}
          aria-hidden={activeTab !== "directory"}
        >
          <div className="rounded-2xl border border-slate-200/80 bg-card p-3 shadow-sm space-y-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
              <div className="relative max-w-md flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="tab-directory"
                  placeholder="Search by name, phone, or email…"
                  className="h-9 rounded-full border bg-card pl-9 text-xs"
                  value={directoryQuery}
                  onChange={(e) => setDirectoryQuery(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={directoryStaysFilter} onValueChange={(v) => setDirectoryStaysFilter(v as typeof directoryStaysFilter)}>
                  <SelectTrigger className="h-9 w-[150px] rounded-full bg-card text-xs">
                    <SelectValue placeholder="Stays" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <SelectItemText>All residents</SelectItemText>
                    </SelectItem>
                    <SelectItem value="has">
                      <SelectItemText>With past stays</SelectItemText>
                    </SelectItem>
                    <SelectItem value="none">
                      <SelectItemText>No completed stays</SelectItemText>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select value={directorySort} onValueChange={(v) => setDirectorySort(v as typeof directorySort)}>
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
                <Button type="button" className="h-9 shrink-0 rounded-full text-xs" variant="secondary">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Resident
                </Button>
              </div>
            </div>

            <ScrollableTablePane offsetRem={14} minVh={28} className="rounded-xl border">
              <Table>
                <TableHeader className="sticky top-0 z-[1] bg-muted/90 shadow-sm">
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Contact</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Total stays</TableHead>
                    <TableHead className="text-right w-[100px] text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-[150px]" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-[100px]" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-[150px]" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-[50px]" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="ml-auto h-8 w-[80px]" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground text-xs">
                        {guests?.length === 0
                          ? "No residents yet. Add a resident profile to begin."
                          : "No residents match your filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((guest) => (
                      <TableRow key={guest.id} className="hover:bg-muted/40">
                        <TableCell className="font-semibold text-xs py-2.5">{guest.fullName}</TableCell>
                        <TableCell className="text-xs py-2.5">{guest.contactNumber || "—"}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs py-2.5">{guest.email || "—"}</TableCell>
                        <TableCell className="text-xs py-2.5">{guest.totalStays}</TableCell>
                        <TableCell className="text-right py-2.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Guest actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => setViewGuest(guest)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditGuest(guest)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteGuest(guest)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollableTablePane>
          </div>
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

      <Dialog open={Boolean(viewGuest)} onOpenChange={(o) => !o && setViewGuest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guest profile</DialogTitle>
            <DialogDescription>Read-only details from your directory.</DialogDescription>
          </DialogHeader>
          {viewGuest ? (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Name</span>
                <p className="font-medium">{viewGuest.fullName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Phone</span>
                <p>{viewGuest.contactNumber || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Email</span>
                <p className="break-all">{viewGuest.email || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Completed stays</span>
                <p>{viewGuest.totalStays}</p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewGuest(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
