import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetOccupancyOverview,
  useListReservations,
  useListRooms,
  useListPayments,
  useGetRevenueReport,
  type ActivityItem,
  type Reservation,
  type Room,
} from "@workspace/api-client-react";
import {
  Bell,
  SlidersHorizontal,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  CreditCard,
  CalendarDays,
  CalendarRange,
  Ban,
  ChevronDown,
  ChevronRight,
  Bed,
  Sparkles,
  Check,
  TrendingUp,
  TrendingDown,
  CalendarClock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatPhDate, formatPhTime } from "@/lib/datetime";
import { format, isSameMonth, parseISO, subMonths, startOfMonth } from "date-fns";
import { useAuth } from "@/components/auth/AuthProvider";

/* ───────── activity helpers ───────── */

function getActivityLabel(type: ActivityItem["type"]): string {
  switch (type) {
    case "check_in":
      return "Checked in";
    case "check_out":
      return "Checked out";
    case "payment":
      return "Payment";
    case "reservation":
      return "Reservation created";
    case "cancellation":
      return "Reservation cancelled";
    default:
      return "Activity";
  }
}

function activityChip(type: ActivityItem["type"]) {
  switch (type) {
    case "check_in":
      return { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" };
    case "check_out":
      return { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" };
    case "reservation":
      return { bg: "bg-blue-500/10", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" };
    case "cancellation":
      return { bg: "bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" };
    case "payment":
      return { bg: "bg-indigo-500/10", text: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500" };
    default:
      return { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" };
  }
}

function ActivityTypeIcon({ type, className }: { type: ActivityItem["type"]; className?: string }) {
  const cn2 = className ?? "h-4 w-4";
  switch (type) {
    case "check_in":
      return <ArrowDownRight className={cn2} />;
    case "check_out":
      return <ArrowUpRight className={cn2} />;
    case "payment":
      return <CreditCard className={cn2} />;
    case "reservation":
      return <CalendarDays className={cn2} />;
    case "cancellation":
      return <Ban className={cn2} />;
    default:
      return <Activity className={cn2} />;
  }
}

/* ───────── avatar + format helpers ───────── */

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

function GuestAvatar({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-card",
        avatarColor(name),
      )}
      style={{ width: size, height: size }}
      title={name}
    >
      {getInitials(name)}
    </span>
  );
}

function formatPhp(value: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    if (value >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `₱${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
    return `₱${value.toFixed(0)}`;
  }
  return `₱${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/* ───────── period options ───────── */

const BOOKING_PERIODS = [
  { id: 3, label: "Last 3 months" },
  { id: 6, label: "Last 6 months" },
  { id: 12, label: "Last 12 months" },
] as const;

const CALENDAR_PERIODS = [
  { id: 5, label: "Next 5 days" },
  { id: 14, label: "Next 14 days" },
  { id: 30, label: "Next 30 days" },
] as const;

const REVENUE_RANGES = [
  { id: "today", label: "Today" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
] as const;
type RevenueRangeId = (typeof REVENUE_RANGES)[number]["id"];

/* ───────── component ───────── */

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const firstName = (user?.fullName ?? user?.username ?? "there").split(/\s+/)[0]!;

  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: occupancy, isLoading: isOccupancyLoading } = useGetOccupancyOverview();
  const { data: reservations = [], isLoading: isResLoading } = useListReservations();
  const { data: rooms = [] } = useListRooms();
  const { data: payments = [] } = useListPayments();
  const { data: revenue, isLoading: isRevenueLoading } = useGetRevenueReport();
  const { data: activity, isLoading: isActivityLoading } = useGetRecentActivity();

  /* ───────── filter state ───────── */

  const [bookingMonths, setBookingMonths] = useState<number>(6);
  const [calendarDays, setCalendarDays] = useState<number>(5);
  const [calendarTypes, setCalendarTypes] = useState<string[]>([]);
  const [revenueRange, setRevenueRange] = useState<RevenueRangeId>("month");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const todayYmd = format(new Date(), "yyyy-MM-dd");
  const todayCheckIns = summary?.todayCheckIns ?? 0;
  const todayCheckOuts = summary?.todayCheckOuts ?? 0;

  /* ───────── derived sets ───────── */

  // roomNumber → Room
  const roomByNumber = useMemo(() => {
    const m = new Map<string, Room>();
    for (const r of rooms) m.set(r.roomNumber, r);
    return m;
  }, [rooms]);

  const upcomingReservations = useMemo(
    () =>
      reservations.filter(
        (r) => r.status === "reserved" && r.checkInDate.slice(0, 10) >= todayYmd,
      ),
    [reservations, todayYmd],
  );

  const upcomingCount = upcomingReservations.length;

  const rentedDirty = useMemo(
    () => (occupancy?.rooms ?? []).filter((r) => r.status === "occupied").length,
    [occupancy],
  );
  const vacantDirty = useMemo(
    () =>
      (occupancy?.rooms ?? []).filter(
        (r) => r.status === "cleaning" || r.status === "maintenance",
      ).length,
    [occupancy],
  );

  /* ───────── occupancy donut (Vacant / Occupied / Reserved) ───────── */

  const donutData = useMemo(() => {
    const ovr = occupancy?.rooms ?? [];
    const total = summary?.totalRooms ?? ovr.length ?? rooms.length ?? 0;

    const occupied = ovr.filter((r) => r.status === "occupied").length;

    // "Reserved" = distinct rooms that have an upcoming reservation but aren't currently occupied
    const occupiedRoomNumbers = new Set(
      ovr.filter((r) => r.status === "occupied").map((r) => r.roomNumber),
    );
    const reservedRoomNumbers = new Set<string>();
    for (const r of upcomingReservations) {
      if (!occupiedRoomNumbers.has(r.roomNumber)) reservedRoomNumbers.add(r.roomNumber);
    }
    const reserved = reservedRoomNumbers.size;
    const vacant = Math.max(0, total - occupied - reserved);

    return {
      total,
      occupied,
      vacant,
      reserved,
      pieData: [
        { name: "Vacant", value: vacant, fill: "#86efac" },
        { name: "Occupied", value: occupied, fill: "#a78bfa" },
        { name: "Reserved", value: reserved, fill: "#67e8f9" },
      ],
    };
  }, [occupancy, summary, rooms, upcomingReservations]);

  /* ───────── monthly bookings (filtered period) ───────── */

  const bookingByMonth = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; date: Date; count: number }[] = [];
    for (let i = bookingMonths - 1; i >= 0; i--) {
      const d = startOfMonth(subMonths(now, i));
      buckets.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM"), date: d, count: 0 });
    }
    for (const r of reservations) {
      if (r.status === "cancelled" || r.status === "no_show") continue;
      const k = r.checkInDate.slice(0, 7);
      const bucket = buckets.find((b) => b.key === k);
      if (bucket) bucket.count += 1;
    }
    return buckets;
  }, [reservations, bookingMonths]);

  const activeMonth = useMemo(() => {
    const now = new Date();
    return (
      bookingByMonth.find((b) => isSameMonth(b.date, now)) ??
      bookingByMonth[bookingByMonth.length - 1]
    );
  }, [bookingByMonth]);

  /* ───────── rooms-per-type (chart) ───────── */

  const roomsPerType = useMemo(() => {
    const map = new Map<string, { type: string; bookings: number; revenue: number }>();
    for (const r of rooms) {
      if (!map.has(r.type)) map.set(r.type, { type: r.type, bookings: 0, revenue: 0 });
    }
    const since = startOfMonth(subMonths(new Date(), 1));
    for (const r of reservations) {
      if (r.status === "cancelled" || r.status === "no_show") continue;
      const d = parseISO(r.checkInDate);
      if (d < since) continue;
      const room = roomByNumber.get(r.roomNumber);
      const type = room?.type ?? "Other";
      if (!map.has(type)) map.set(type, { type, bookings: 0, revenue: 0 });
      const bucket = map.get(type)!;
      bucket.bookings += 1;
      bucket.revenue += r.paidAmount ?? 0;
    }
    return Array.from(map.values()).sort((a, b) => b.bookings - a.bookings);
  }, [rooms, reservations, roomByNumber]);

  const totalBookingsInRange = roomsPerType.reduce((a, b) => a + b.bookings, 0);

  /* ───────── revenue trend (last 7 days area chart) ───────── */

  const trend = useMemo(() => {
    return (revenue?.dailyRevenue ?? []).map((d) => ({
      day: d.date ? format(parseISO(d.date), "MMM d") : "",
      amount: d.amount,
    }));
  }, [revenue]);

  /* ───────── month-over-month deltas ───────── */

  const { bookingsLastMonth, bookingsPrevMonth, revenueThisMonth, revenuePrevMonth } = useMemo(() => {
    const now = new Date();
    const thisKey = format(now, "yyyy-MM");
    const prevKey = format(subMonths(now, 1), "yyyy-MM");
    let bThis = 0;
    let bPrev = 0;
    for (const r of reservations) {
      if (r.status === "cancelled" || r.status === "no_show") continue;
      const k = r.checkInDate.slice(0, 7);
      if (k === thisKey) bThis += 1;
      else if (k === prevKey) bPrev += 1;
    }
    let revThis = 0;
    let revPrev = 0;
    for (const p of payments) {
      const k = (p.createdAt ?? "").slice(0, 7);
      if (k === thisKey) revThis += p.amount ?? 0;
      else if (k === prevKey) revPrev += p.amount ?? 0;
    }
    return {
      bookingsLastMonth: bThis,
      bookingsPrevMonth: bPrev,
      revenueThisMonth: revThis || (revenue?.monthRevenue ?? 0),
      revenuePrevMonth: revPrev,
    };
  }, [reservations, payments, revenue]);

  const bookingsDelta = bookingsLastMonth - bookingsPrevMonth;
  const revenueDelta = revenueThisMonth - revenuePrevMonth;

  /* ───────── payment-method breakdown ───────── */

  const paymentBreakdown = useMemo(() => {
    const now = new Date();
    const thisMonth = format(now, "yyyy-MM");
    const byMethod = new Map<string, number>();
    let total = 0;
    for (const p of payments) {
      if ((p.createdAt ?? "").slice(0, 7) !== thisMonth) continue;
      const m = (p.paymentMethod ?? "other").toLowerCase();
      byMethod.set(m, (byMethod.get(m) ?? 0) + (p.amount ?? 0));
      total += p.amount ?? 0;
    }
    const pretty = (m: string) => {
      switch (m) {
        case "cash":
          return "Cash";
        case "card":
          return "Card";
        case "gcash":
          return "GCash";
        case "bank_transfer":
          return "Transfer";
        default:
          return m[0]?.toUpperCase() + m.slice(1);
      }
    };
    const tints: Record<string, string> = {
      cash: "bg-cyan-500/20 text-cyan-200",
      card: "bg-emerald-500/20 text-emerald-200",
      gcash: "bg-rose-500/20 text-rose-200",
      bank_transfer: "bg-amber-500/20 text-amber-200",
    };
    const arr = Array.from(byMethod.entries())
      .map(([m, amount]) => ({
        method: m,
        label: pretty(m),
        amount,
        percent: total > 0 ? (amount / total) * 100 : 0,
        tint: tints[m] ?? "bg-slate-500/20 text-slate-200",
      }))
      .sort((a, b) => b.amount - a.amount);
    return { items: arr, total };
  }, [payments]);

  /* ───────── calendar (filtered upcoming bookings) ───────── */

  const roomTypeFilters = useMemo(() => {
    const map = new Map<string, number>();
    const horizon = new Date();
    horizon.setHours(0, 0, 0, 0);
    const cutoff = new Date(horizon);
    cutoff.setDate(cutoff.getDate() + calendarDays);

    for (const r of reservations) {
      if (r.status !== "reserved" && r.status !== "checked_in") continue;
      const d = parseISO(r.checkInDate);
      if (d < horizon || d >= cutoff) continue;
      const room = roomByNumber.get(r.roomNumber);
      const type = room?.type ?? "Other";
      map.set(type, (map.get(type) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [reservations, roomByNumber, calendarDays]);

  const calendar = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: { date: Date; key: string; bookings: Reservation[] }[] = [];
    for (let i = 0; i < calendarDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const k = format(d, "yyyy-MM-dd");
      const dayRes = reservations
        .filter((r) => {
          if (r.checkInDate.slice(0, 10) !== k) return false;
          if (r.status !== "reserved" && r.status !== "checked_in") return false;
          if (calendarTypes.length === 0) return true;
          const room = roomByNumber.get(r.roomNumber);
          return calendarTypes.includes(room?.type ?? "Other");
        })
        .sort((a, b) => a.guestName.localeCompare(b.guestName));
      days.push({ date: d, key: k, bookings: dayRes });
    }
    return days;
  }, [reservations, calendarTypes, calendarDays, roomByNumber]);

  /* ───────── totals/labels ───────── */

  const revenueRangeValue = useMemo(() => {
    switch (revenueRange) {
      case "today":
        return revenue?.todayRevenue ?? 0;
      case "week":
        return revenue?.weekRevenue ?? 0;
      case "month":
        return revenue?.monthRevenue ?? revenueThisMonth;
      case "all":
        return revenue?.totalRevenue ?? 0;
    }
  }, [revenue, revenueRange, revenueThisMonth]);

  const todayRev = revenue?.todayRevenue ?? 0;
  const revenueRangeLabel =
    REVENUE_RANGES.find((r) => r.id === revenueRange)?.label ?? "Last 7 days";
  const bookingPeriodLabel =
    BOOKING_PERIODS.find((p) => p.id === bookingMonths)?.label ?? `${bookingMonths} months`;
  const calendarPeriodLabel =
    CALENDAR_PERIODS.find((p) => p.id === calendarDays)?.label ?? `${calendarDays} days`;

  /* ───────── render ───────── */

  return (
    <div className="w-full min-w-0 max-w-none space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="grid w-full min-w-0 grid-cols-12 gap-4 md:gap-5 xl:gap-6 2xl:gap-8">
        {/* ──────────────────────── LEFT (grey parent) ──────────────────────── */}
        <aside className="col-span-12 min-w-0 lg:col-span-4 xl:col-span-3 2xl:col-span-3 border-0">
          <div className="rounded-3xl bg-zinc-200/70 dark:bg-zinc-600/10 border-0 border-slate-200/70 dark:border-slate-800 p-3 space-y-3">
            {/* Revenue header (no inner card) */}
            <div className="px-2 pt-2 pb-1 border-0">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2.5">
                Revenue
              </div>
              {isRevenueLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="flex items-baseline gap-6">
                  <div>
                    <div className="text-2xl font-bold tabular-nums leading-none">
                      {formatPhp(todayRev, { compact: true })}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                      Today
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold tabular-nums leading-none">
                      {formatPhp(revenueRangeValue, { compact: true })}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                      {revenueRangeLabel}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Inner: Reservation + Housekeeping */}
            <InnerCard>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2.5">
                Reservation
              </div>
              {isSummaryLoading || isResLoading ? (
                <Skeleton className="h-12 w-full mb-3" />
              ) : (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <MiniStat
                    icon={<CalendarRange className="w-3.5 h-3.5" />}
                    value={upcomingCount}
                    label="Upcoming"
                  />
                  <MiniStat
                    icon={<ArrowDownRight className="w-3.5 h-3.5" />}
                    value={todayCheckIns}
                    label="Check-In"
                  />
                  <MiniStat
                    icon={<ArrowUpRight className="w-3.5 h-3.5" />}
                    value={todayCheckOuts}
                    label="Check-Out"
                  />
                </div>
              )}
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2.5">
                House keeping
              </div>
              {isOccupancyLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat
                    icon={<Bed className="w-3.5 h-3.5" />}
                    value={rentedDirty}
                    label="Rented & Dirty"
                  />
                  <MiniStat
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                    value={vacantDirty}
                    label="Vacant & Dirty"
                  />
                </div>
              )}
            </InnerCard>

            {/* Inner: Occupancy donut */}
            <InnerCard>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Occupancy
                </div>
                <button
                  type="button"
                  onClick={() => setLocation("/rooms")}
                  className="text-[11px] text-primary hover:text-primary/80 transition-colors"
                >
                  Go to Details →
                </button>
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold tabular-nums">{donutData.total}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Total Rooms
                </div>
              </div>
              <div className="mt-3 grid grid-cols-[1.1fr_1fr] items-center gap-3">
                <div className="relative aspect-square">
                  {isOccupancyLoading ? (
                    <Skeleton className="h-full w-full rounded-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData.pieData}
                          innerRadius="68%"
                          outerRadius="96%"
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                          isAnimationActive
                        />
                        <Tooltip
                          formatter={(v: number, name: string) => [`${v} rooms`, name]}
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid hsl(var(--border))",
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-lg font-bold tabular-nums leading-none">
                      {(summary?.occupancyRate ?? 0).toFixed(1)}%
                    </div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      Occupancy
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <DonutLegend dotClass="bg-emerald-300" label="Vacant" value={donutData.vacant} />
                  <DonutLegend dotClass="bg-violet-400" label="Occupied" value={donutData.occupied} />
                  <DonutLegend dotClass="bg-cyan-300" label="Reserved" value={donutData.reserved} />
                </div>
              </div>
            </InnerCard>
          </div>
        </aside>

        {/* ──────────────────────── RIGHT (grey parent) ──────────────────────── */}
        <section className="col-span-12 min-w-0 lg:col-span-8 xl:col-span-9 2xl:col-span-9">
          <div className="rounded-3xl bg-zinc-200/70 dark:bg-zinc-600/10 border-0 border-slate-200/70 dark:border-slate-800 p-3 space-y-3">
            {/* Welcome header (no inner card) */}
            <div className="px-2 pt-2 pb-1 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Welcome Back, {firstName}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {format(new Date(), "EEE, MMM d, yyyy")} · Property at a glance.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Filters popover */}
                <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-card"
                      aria-label="Filters"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-3 space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Dashboard filters
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-muted-foreground mb-1.5">
                        Revenue range
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {REVENUE_RANGES.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setRevenueRange(r.id)}
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] border transition-colors",
                              revenueRange === r.id
                                ? "bg-foreground text-background border-transparent"
                                : "bg-muted/50 hover:bg-muted text-foreground",
                            )}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-muted-foreground mb-1.5">
                        Booking chart period
                      </div>
                      <div className="flex gap-1.5">
                        {BOOKING_PERIODS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setBookingMonths(p.id)}
                            className={cn(
                              "flex-1 rounded-full px-2 py-1 text-[11px] border transition-colors",
                              bookingMonths === p.id
                                ? "bg-foreground text-background border-transparent"
                                : "bg-muted/50 hover:bg-muted text-foreground",
                            )}
                          >
                            {p.id}m
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-muted-foreground mb-1.5">
                        Calendar horizon
                      </div>
                      <div className="flex gap-1.5">
                        {CALENDAR_PERIODS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setCalendarDays(p.id)}
                            className={cn(
                              "flex-1 rounded-full px-2 py-1 text-[11px] border transition-colors",
                              calendarDays === p.id
                                ? "bg-foreground text-background border-transparent"
                                : "bg-muted/50 hover:bg-muted text-foreground",
                            )}
                          >
                            {p.id}d
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-8 rounded-full"
                      onClick={() => {
                        setRevenueRange("month");
                        setBookingMonths(6);
                        setCalendarDays(5);
                        setCalendarTypes([]);
                      }}
                    >
                      Reset filters
                    </Button>
                  </PopoverContent>
                </Popover>

                {/* Notifications popover */}
                <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-card relative"
                      aria-label="Notifications"
                    >
                      <Bell className="w-4 h-4" />
                      {activity && activity.length > 0 ? (
                        <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
                      ) : null}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-[440px] max-w-[calc(100vw-2rem)] p-0"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <div>
                        <div className="text-sm font-semibold">Notifications</div>
                        <div className="text-[11px] text-muted-foreground">
                          Latest events in the property
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px]">
                        <Activity className="w-3 h-3 text-muted-foreground" />
                        {activity?.length ?? 0} entries
                      </span>
                    </div>
                    <ScrollArea className="h-[420px]">
                      {isActivityLoading ? (
                        <div className="space-y-2 p-3">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 rounded-lg" />
                          ))}
                        </div>
                      ) : !activity || activity.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-muted-foreground inline-flex items-center gap-2 justify-center w-full">
                          <Sparkles className="w-3.5 h-3.5" />
                          No recent activity yet.
                        </div>
                      ) : (
                        <ul className="divide-y">
                          {activity.map((entry) => {
                            const c = activityChip(entry.type);
                            return (
                              <li
                                key={entry.id}
                                className="flex items-start gap-3 px-4 py-3"
                              >
                                <div
                                  className={cn(
                                    "h-8 w-8 shrink-0 rounded-full flex items-center justify-center",
                                    c.bg,
                                    c.text,
                                  )}
                                >
                                  <ActivityTypeIcon
                                    type={entry.type}
                                    className="w-3.5 h-3.5"
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="text-sm font-medium">
                                      {entry.guestName ?? entry.user}
                                    </span>
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                                        c.bg,
                                        c.text,
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "w-1.5 h-1.5 rounded-full",
                                          c.dot,
                                        )}
                                      />
                                      {getActivityLabel(entry.type)}
                                    </span>
                                    {entry.reservationNumber ? (
                                      <span className="font-mono text-[10px] text-muted-foreground">
                                        {entry.reservationNumber}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground mt-1 break-words">
                                    {entry.description}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                                    {formatPhDate(entry.timestamp)}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                                    {formatPhTime(entry.timestamp)}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>

                <Button
                  onClick={() => setLocation("/guests?tab=bookings")}
                  className="h-9 rounded-full px-4 bg-foreground text-background hover:bg-foreground/90"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  New Reservation
                </Button>
              </div>
            </div>

            {/* Inner: Booking (full width) */}
            <InnerCard>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold">Booking</div>
                  <div className="text-[11px] text-muted-foreground">
                    Reservations per month
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2.5 py-1 text-[11px] text-foreground hover:bg-muted transition-colors"
                    >
                      {bookingPeriodLabel}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Period
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {BOOKING_PERIODS.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => setBookingMonths(p.id)}
                        className="text-xs"
                      >
                        <span className="flex-1">{p.label}</span>
                        {bookingMonths === p.id ? <Check className="w-3.5 h-3.5" /> : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {isResLoading ? (
                <Skeleton className="h-44 w-full xl:h-52 2xl:h-60" />
              ) : (
                <div className="relative h-44 xl:h-52 2xl:h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bookingByMonth} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis hide />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                        formatter={(v: number) => [`${v} bookings`, "Bookings"]}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid hsl(var(--border))",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={40}>
                        {bookingByMonth.map((b, i) => (
                          <Cell
                            key={i}
                            fill={b.key === activeMonth?.key ? "#86efac" : "hsl(var(--muted))"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {activeMonth ? (
                <div className="mt-1 text-center">
                  <div className="text-2xl font-bold tabular-nums text-emerald-700">
                    {activeMonth.count.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    Bookings · {format(activeMonth.date, "MMMM")}
                  </div>
                </div>
              ) : null}
            </InnerCard>

            <div className="grid min-w-0 grid-cols-1 gap-3 md:gap-4 xl:grid-cols-3 xl:gap-5 2xl:gap-6">
              {/* Inner: Average rooms per Rented + Average Rented Revenue (combined) */}
              <InnerCard className="xl:col-span-2 bg-slate-900 text-slate-100 border-slate-800">
                {/* Row 1 — rooms per rented */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Average rooms per Rented</div>
                    <div className="text-[11px] text-slate-400">
                      Distribution by room type · last 30 days
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular-nums">
                      {totalBookingsInRange.toLocaleString()}
                    </div>
                    <DeltaPill
                      value={bookingsDelta}
                      label="vs last month"
                      darker
                    />
                  </div>
                </div>
                {isResLoading ? (
                  <Skeleton className="mt-3 h-28 w-full bg-slate-800 xl:h-36 2xl:h-44" />
                ) : roomsPerType.length === 0 ? (
                  <div className="mt-3 flex h-28 items-center justify-center text-xs text-slate-400 xl:h-36 2xl:h-44">
                    No reservations in the last 30 days.
                  </div>
                ) : (
                  <div className="mt-3 h-28 xl:h-36 2xl:h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={roomsPerType} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="rptGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#86efac" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="#86efac" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.5} />
                        <XAxis
                          dataKey="type"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "#cbd5e1" }}
                        />
                        <YAxis hide />
                        <Tooltip
                          formatter={(v: number, _n, ctx: { payload?: { revenue?: number } }) => [
                            `${v} bookings · ${formatPhp(ctx?.payload?.revenue ?? 0, { compact: true })}`,
                            "Total",
                          ]}
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid #334155",
                            backgroundColor: "#0f172a",
                            color: "#f1f5f9",
                            fontSize: 12,
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="bookings"
                          stroke="#86efac"
                          strokeWidth={2}
                          fill="url(#rptGradient)"
                          activeDot={{ r: 4 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="my-3 h-px bg-slate-800" />

                {/* Row 2 — average rented revenue */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Average Rented Revenue</div>
                    <div className="text-[11px] text-slate-400">
                      Payment distribution this month
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular-nums">
                      {formatPhp(revenueThisMonth, { compact: true })}
                    </div>
                    <DeltaPill value={revenueDelta} label="vs last month" darker money />
                  </div>
                </div>
                {paymentBreakdown.items.length === 0 ? (
                  <div className="text-xs text-slate-400 mt-3 text-center py-3">
                    No payments recorded this month yet.
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {paymentBreakdown.items.map((b) => (
                      <BreakdownChip
                        key={b.method}
                        label={b.label}
                        value={`${b.percent.toFixed(0)}%`}
                        tint={b.tint}
                      />
                    ))}
                  </div>
                )}
              </InnerCard>

              {/* Inner: Calendar */}
              <InnerCard className="xl:col-span-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">Calendar</div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2.5 py-1 text-[11px] text-foreground hover:bg-muted transition-colors"
                      >
                        {calendarPeriodLabel}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Horizon
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {CALENDAR_PERIODS.map((p) => (
                        <DropdownMenuItem
                          key={p.id}
                          onClick={() => setCalendarDays(p.id)}
                          className="text-xs"
                        >
                          <span className="flex-1">{p.label}</span>
                          {calendarDays === p.id ? <Check className="w-3.5 h-3.5" /> : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Room-type filter pills */}
                {roomTypeFilters.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {roomTypeFilters.map((f) => {
                      const active = calendarTypes.includes(f.type);
                      return (
                        <button
                          key={f.type}
                          type="button"
                          onClick={() =>
                            setCalendarTypes((cur) =>
                              cur.includes(f.type)
                                ? cur.filter((t) => t !== f.type)
                                : [...cur, f.type],
                            )
                          }
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                            active
                              ? "bg-foreground text-background border-transparent"
                              : "bg-muted/40 hover:bg-muted text-foreground border-transparent",
                          )}
                        >
                          {f.type} ({f.count})
                        </button>
                      );
                    })}
                    {calendarTypes.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setCalendarTypes([])}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="mb-3 text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5" />
                    No upcoming bookings in window.
                  </div>
                )}

                <ScrollArea className="max-h-[min(360px,55dvh)] pr-1 xl:max-h-[min(480px,60dvh)] 2xl:max-h-[min(560px,65dvh)]">
                  <div className="space-y-2">
                    {calendar.map((day) => {
                      const isToday = day.key === todayYmd;
                      const count = day.bookings.length;
                      const rowClass = cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors hover:bg-muted/60",
                        isToday
                          ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                          : "bg-card",
                      );
                      const goNewBooking = () =>
                        setLocation(
                          `/guests?tab=bookings&new=1&checkIn=${encodeURIComponent(day.key)}`,
                        );
                      const goViewBooking = (id: string) =>
                        setLocation(
                          `/guests?tab=bookings&reservation=${encodeURIComponent(id)}`,
                        );
                      const dayInner = (
                        <>
                          <div className="w-9 shrink-0 text-center">
                            <div className="text-base font-bold leading-none tabular-nums">
                              {format(day.date, "d")}
                            </div>
                            <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">
                              {format(day.date, "EEE")}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            {count === 0 ? (
                              <div className="text-xs text-muted-foreground">
                                Available for booking
                              </div>
                            ) : (
                              <div className="text-xs font-medium">
                                {count} Booking{count === 1 ? "" : "s"}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex -space-x-1.5">
                              {day.bookings.slice(0, 3).map((b) => (
                                <GuestAvatar key={b.id} name={b.guestName} size={20} />
                              ))}
                            </div>
                            {count > 3 ? (
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                +{count - 3}
                              </span>
                            ) : null}
                            {count === 0 ? (
                              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>
                        </>
                      );

                      if (count > 1) {
                        return (
                          <Popover key={day.key}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className={rowClass}
                                aria-label={`${count} bookings on ${format(day.date, "MMM d")}. Choose one to view.`}
                              >
                                {dayInner}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-72 p-2">
                              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {format(day.date, "EEE, MMM d")}
                              </p>
                              <div className="space-y-1">
                                {day.bookings.map((b) => (
                                  <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => goViewBooking(b.id)}
                                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                                  >
                                    <GuestAvatar name={b.guestName} size={22} />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-xs font-medium">
                                        {b.guestName}
                                      </span>
                                      <span className="block text-[10px] text-muted-foreground">
                                        Room {b.roomNumber} · {b.status.replace(/_/g, " ")}
                                      </span>
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        );
                      }

                      return (
                        <button
                          key={day.key}
                          type="button"
                          className={rowClass}
                          onClick={() =>
                            count === 0
                              ? goNewBooking()
                              : goViewBooking(day.bookings[0]!.id)
                          }
                          aria-label={
                            count === 0
                              ? `Create booking for ${format(day.date, "MMM d")}`
                              : `View booking for ${day.bookings[0]!.guestName}`
                          }
                        >
                          {dayInner}
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </InnerCard>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ───────── local UI helpers ───────── */

function InnerCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-card p-3 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

function MiniStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-sm font-bold tabular-nums text-foreground">{value}</span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function DonutLegend({
  dotClass,
  label,
  value,
}: {
  dotClass: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("w-2.5 h-2.5 rounded-full", dotClass)} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-semibold tabular-nums leading-none">{value}</div>
      </div>
    </div>
  );
}

function BreakdownChip({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className={cn("rounded-full px-3 py-1.5 text-center", tint)}>
      <div className="text-sm font-bold tabular-nums leading-none">{value}</div>
      <div className="text-[9px] uppercase tracking-wider opacity-80 mt-0.5">{label}</div>
    </div>
  );
}

function DeltaPill({
  value,
  label,
  darker,
  money,
}: {
  value: number;
  label: string;
  darker?: boolean;
  money?: boolean;
}) {
  const positive = value > 0;
  const zero = value === 0;
  const display = money
    ? `${positive ? "+" : value < 0 ? "−" : ""}${formatPhp(Math.abs(value), { compact: true })}`
    : `${positive ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString()}`;

  const tone = zero
    ? darker
      ? "text-slate-400"
      : "text-muted-foreground"
    : positive
      ? "text-emerald-300"
      : "text-rose-300";
  return (
    <div className={cn("inline-flex items-center gap-1 text-[10px] mt-0.5", tone)}>
      {positive ? (
        <TrendingUp className="w-3 h-3" />
      ) : value < 0 ? (
        <TrendingDown className="w-3 h-3" />
      ) : null}
      <span className="tabular-nums">{display}</span>
      <span className={darker ? "text-slate-400" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
