import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
  useListRooms,
  getListRoomsQueryKey,
  type CreateRoomPayload,
  useListRoomOptions,
  useCreateRoomOption,
  useUpdateRoomOption,
  useDeleteRoomOption,
  getRoomOptionsQueryKey,
  useListReservations,
  type Room,
  type Reservation,
  type RoomOption,
  useListHousekeepers,
  useCreateHousekeeper,
  useUpdateHousekeeper,
  useDeleteHousekeeper,
  type Housekeeper,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
  DialogClose,
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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Pencil,
  Plus,
  Trash2,
  BedDouble,
  Users,
  Wallet,
  Calendar,
  CalendarRange,
  LayoutGrid,
  StickyNote,
  Wrench,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  History,
  ChevronLeft,
  ChevronRight,
  Tag,
  Hash,
  CircleDollarSign,
  Clock,
  Phone,
  MoreVertical,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatPhDate } from "@/lib/datetime";
import { differenceInCalendarDays, format, parseISO } from "date-fns";

type RoomStatus = "available" | "occupied" | "cleaning" | "maintenance" | string;

const STATUS_STYLES: Record<
  string,
  { dot: string; ring: string; chipBg: string; chipText: string; badge: "default" | "secondary" | "outline" | "destructive"; icon: typeof CheckCircle2 }
> = {
  available: {
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/30",
    chipBg: "bg-emerald-500/10",
    chipText: "text-emerald-700 dark:text-emerald-400",
    badge: "default",
    icon: CheckCircle2,
  },
  occupied: {
    dot: "bg-amber-500",
    ring: "ring-amber-500/30",
    chipBg: "bg-amber-500/10",
    chipText: "text-amber-700 dark:text-amber-400",
    badge: "secondary",
    icon: BedDouble,
  },
  reserved: {
    dot: "bg-blue-500",
    ring: "ring-blue-500/30",
    chipBg: "bg-blue-500/10",
    chipText: "text-blue-700 dark:text-blue-400",
    badge: "secondary",
    icon: CalendarRange,
  },
  cleaning: {
    dot: "bg-yellow-500",
    ring: "ring-yellow-500/30",
    chipBg: "bg-yellow-500/10",
    chipText: "text-yellow-700 dark:text-yellow-400",
    badge: "secondary",
    icon: Sparkles,
  },
  maintenance: {
    dot: "bg-rose-500",
    ring: "ring-rose-500/30",
    chipBg: "bg-rose-500/10",
    chipText: "text-rose-700 dark:text-rose-400",
    badge: "destructive",
    icon: Wrench,
  },
};

function styleFor(status: RoomStatus) {
  return STATUS_STYLES[status] ?? {
    dot: "bg-slate-400",
    ring: "ring-slate-500/30",
    chipBg: "bg-muted",
    chipText: "text-muted-foreground",
    badge: "outline" as const,
    icon: AlertTriangle,
  };
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
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]!;
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

const TIMELINE_DAYS = 14;

/** Occupied, cleaning, and maintenance are system-managed or fixed labels — not renamed/deleted here. */
const BUILTIN_ROOM_STATUS_VALUES = new Set(["available", "occupied", "cleaning", "maintenance"]);

function isBuiltinRoomStatusValue(value: string): boolean {
  return BUILTIN_ROOM_STATUS_VALUES.has(value.trim().toLowerCase());
}

export default function Rooms() {
  const { data: rooms, isLoading } = useListRooms();
  const { data: reservations = [] } = useListReservations();
  const { data: roomTypes = [] } = useListRoomOptions("type");
  const { data: roomStatuses = [] } = useListRoomOptions("status");
  const createRoomMutation = useCreateRoom();
  const createRoomOptionMutation = useCreateRoomOption();
  const updateRoomOptionMutation = useUpdateRoomOption();
  const deleteRoomOptionMutation = useDeleteRoomOption();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: housekeepers = [] } = useListHousekeepers();
  const createHousekeeperMutation = useCreateHousekeeper();
  const updateHousekeeperMutation = useUpdateHousekeeper();
  const deleteHousekeeperMutation = useDeleteHousekeeper();
  const updateRoomMutation = useUpdateRoom();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState<"scheme" | "timeline" | "housekeeping">("scheme");

  // Housekeeping view filters
  const [hkFilterUnitType, setHkFilterUnitType] = useState<string>("all");
  const [hkFilterFrontdeskStatus, setHkFilterFrontdeskStatus] = useState<string>("all");
  const [hkFilterUnitStatus, setHkFilterUnitStatus] = useState<string>("all"); // 'all' | 'occupied' | 'vacant'
  const [hkFilterCondition, setHkFilterCondition] = useState<string>("all"); // 'all' | 'clean' | 'dirty'
  const [hkFilterDnd, setHkFilterDnd] = useState<string>("all"); // 'all' | 'dnd' | 'no-dnd'
  const [hkFilterHousekeeper, setHkFilterHousekeeper] = useState<string>("all"); // 'all' | 'unassigned' | hkId

  // Housekeeper management state
  const [isHkManagerOpen, setIsHkManagerOpen] = useState(false);
  const [newHkName, setNewHkName] = useState("");
  const [newHkPhone, setNewHkPhone] = useState("");
  const [editingHk, setEditingHk] = useState<Housekeeper | null>(null);
  const [editingHkName, setEditingHkName] = useState("");
  const [editingHkPhone, setEditingHkPhone] = useState("");
  const [editingHkStatus, setEditingHkStatus] = useState("active");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingRoomId, setViewingRoomId] = useState<string | null>(null);
  const [timelineStart, setTimelineStart] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 1);
    return d;
  });

  const [newTypeOption, setNewTypeOption] = useState("");
  const [newStatusOption, setNewStatusOption] = useState("");
  const [newStatusDisablesRoom, setNewStatusDisablesRoom] = useState(false);
  const [editingOption, setEditingOption] = useState<{
    kind: "type" | "status";
    id: string;
    currentValue: string;
    nextValue: string;
    disablesRoom?: boolean;
  } | null>(null);
  const [deletingOption, setDeletingOption] = useState<{
    kind: "type" | "status";
    id: string;
    value: string;
  } | null>(null);
  const [newRoom, setNewRoom] = useState<CreateRoomPayload>({
    roomNumber: "",
    type: "deluxe",
    capacity: 2,
    pricePerNight: 0,
    status: "available",
  });

  const safeRooms = rooms ?? [];
  const total = safeRooms.length || 1;
  const availableCount = safeRooms.filter((r) => r.status === "available").length;
  const occupiedCount = safeRooms.filter((r) => r.status === "occupied").length;
  const cleaningCount = safeRooms.filter((r) => r.status === "cleaning").length;
  const maintenanceCount = safeRooms.filter((r) => r.status === "maintenance").length;
  const percent = (count: number) => `${Math.round((count / total) * 100)}%`;
  const prettyStatus = (status: string) => status.replace(/_/g, " ");

  /** Statuses staff may assign manually (excludes occupied — set at check-in). */
  const selectableRoomTypes = useMemo(
    () => roomTypes.filter((o) => Boolean(o.value?.trim())),
    [roomTypes],
  );
  const roomStatusesManualPick = useMemo(
    () => roomStatuses.filter((o) => Boolean(o.value?.trim()) && o.value !== "occupied"),
    [roomStatuses],
  );

  const filteredRooms = useMemo(() => {
    const lowered = search.trim().toLowerCase();
    return safeRooms.filter((room) => {
      const haystack = `${room.roomNumber} ${room.type}`.toLowerCase();
      const matchesSearch = lowered ? haystack.includes(lowered) : true;
      const matchesStatus = statusFilter === "all" ? true : room.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [safeRooms, search, statusFilter]);

  const groupedRooms = useMemo(() => {
    const map = new Map<string, Room[]>();
    for (const r of filteredRooms) {
      const key = r.type || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRooms]);

  /** Reservations indexed by roomNumber (rooms list returns roomNumber, reservations carry roomNumber). */
  const reservationsByRoomNumber = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      if (!map.has(r.roomNumber)) map.set(r.roomNumber, []);
      map.get(r.roomNumber)!.push(r);
    }
    return map;
  }, [reservations]);

  const todayYmd = format(new Date(), "yyyy-MM-dd");

  function reservationsForRoom(room: Room) {
    const list = reservationsByRoomNumber.get(room.roomNumber) ?? [];
    const current = list.find(
      (r) => r.status === "checked_in" && r.checkInDate.slice(0, 10) <= todayYmd && r.checkOutDate.slice(0, 10) >= todayYmd,
    );
    const upcoming = list
      .filter((r) => r.status === "reserved" && r.checkInDate.slice(0, 10) >= todayYmd)
      .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
    const past = list.filter((r) => r.status === "checked_out");
    return { all: list, current, upcoming, past };
  }

  const filteredHkRooms = useMemo(() => {
    const lowered = search.trim().toLowerCase();
    return safeRooms.filter((room) => {
      // 0. Search term match
      const haystack = `${room.roomNumber} ${room.type}`.toLowerCase();
      if (lowered && !haystack.includes(lowered)) return false;

      // 1. Unit Type
      if (hkFilterUnitType !== "all" && room.type !== hkFilterUnitType) return false;

      // Calculate reservation context
      const resData = reservationsForRoom(room);
      const isOccupied = room.status === "occupied" || !!resData.current;
      const frontdeskStatus = resData.current 
        ? "checked_in" 
        : (resData.upcoming.length > 0 ? "reserved" : "vacant");

      // 2. Frontdesk Status
      if (hkFilterFrontdeskStatus !== "all" && frontdeskStatus !== hkFilterFrontdeskStatus) return false;

      // 3. Unit Status (Occupied/Vacant)
      if (hkFilterUnitStatus !== "all") {
        if (hkFilterUnitStatus === "occupied" && !isOccupied) return false;
        if (hkFilterUnitStatus === "vacant" && isOccupied) return false;
      }

      // 4. Condition
      const cond = room.condition || "clean";
      if (hkFilterCondition !== "all" && cond !== hkFilterCondition) return false;

      // 5. DND
      const dnd = !!room.doNotDisturb;
      if (hkFilterDnd !== "all") {
        if (hkFilterDnd === "dnd" && !dnd) return false;
        if (hkFilterDnd === "no-dnd" && dnd) return false;
      }

      // 6. Assigned Housekeeper
      if (hkFilterHousekeeper !== "all") {
        if (hkFilterHousekeeper === "unassigned" && room.assignedHousekeeperId) return false;
        if (hkFilterHousekeeper !== "unassigned" && room.assignedHousekeeperId !== hkFilterHousekeeper) return false;
      }

      return true;
    });
  }, [
    safeRooms,
    search,
    hkFilterUnitType,
    hkFilterFrontdeskStatus,
    hkFilterUnitStatus,
    hkFilterCondition,
    hkFilterDnd,
    hkFilterHousekeeper,
    reservationsByRoomNumber,
    todayYmd
  ]);

  const statusBadge = (status: string) => {
    if (status === "available") return "default";
    if (status === "occupied") return "secondary";
    if (status === "cleaning") return "secondary";
    return "outline";
  };

  const addOption = async (kind: "type" | "status", value: string, opts?: { disablesRoom?: boolean }) => {
    try {
      const v = value.trim().toLowerCase();
      if (!v) {
        toast({
          title: "Value required",
          description: `Enter a ${kind === "type" ? "room type" : "status"} name.`,
          variant: "destructive",
        });
        return;
      }
      if (kind === "status") {
        await createRoomOptionMutation.mutateAsync({ kind: "status", value: v, disablesRoom: opts?.disablesRoom ?? false });
      } else {
        await createRoomOptionMutation.mutateAsync({ kind: "type", value: v });
      }
      queryClient.invalidateQueries({ queryKey: getRoomOptionsQueryKey(kind) });
      if (kind === "type") {
        setNewTypeOption("");
        setNewRoom((prev) => ({ ...prev, type: v }));
      } else {
        setNewStatusOption("");
        setNewStatusDisablesRoom(false);
        setNewRoom((prev) => ({ ...prev, status: v }));
      }
      toast({ title: `${kind === "type" ? "Room type" : "Room status"} added` });
    } catch (error) {
      toast({
        title: "Failed to add option",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  /** Throws on failure so callers (e.g. room details menu) can avoid clearing input on failure. */
  const addRoomStatusOptionStrict = async (value: string, disablesRoom = false) => {
    const v = value.trim().toLowerCase();
    if (!v) throw new Error("Status name is required");
    await createRoomOptionMutation.mutateAsync({ kind: "status", value: v, disablesRoom });
    queryClient.invalidateQueries({ queryKey: getRoomOptionsQueryKey("status") });
    setNewStatusOption("");
    setNewStatusDisablesRoom(false);
    toast({ title: "Room status added" });
  };

  const editOption = async (kind: "type" | "status", id: string, currentValue: string) => {
    if (kind === "status" && isBuiltinRoomStatusValue(currentValue)) {
      toast({
        title: "Built-in status",
        description: "Available, occupied, cleaning, and maintenance cannot be renamed or deleted.",
        variant: "destructive",
      });
      return;
    }
    const disablesRoom =
      kind === "status" ? Boolean(roomStatuses.find((o) => o.id === id)?.disablesRoom) : undefined;
    setEditingOption({ kind, id, currentValue, nextValue: currentValue, disablesRoom });
  };

  const submitEditOption = async () => {
    if (!editingOption) return;
    const { kind, id, currentValue } = editingOption;
    const label = kind === "type" ? "Room type" : "Room status";
    const nextValue = editingOption.nextValue.trim().toLowerCase();
    if (!nextValue) {
      toast({ title: "Invalid name", description: "Option name cannot be empty.", variant: "destructive" });
      return;
    }
    const origDisables =
      kind === "status" ? Boolean(roomStatuses.find((o) => o.id === id)?.disablesRoom) : false;
    const nextDisables = kind === "status" ? Boolean(editingOption.disablesRoom) : false;
    const valueUnchanged = nextValue === currentValue.trim().toLowerCase();
    if (kind === "type" && valueUnchanged) {
      toast({ title: "No changes", description: "The name is unchanged." });
      setEditingOption(null);
      return;
    }
    if (kind === "status" && valueUnchanged && nextDisables === origDisables) {
      toast({ title: "No changes", description: "Nothing to update." });
      setEditingOption(null);
      return;
    }
    try {
      if (kind === "type") {
        await updateRoomOptionMutation.mutateAsync({ kind: "type", id, value: nextValue });
      } else {
        await updateRoomOptionMutation.mutateAsync({
          kind: "status",
          id,
          value: nextValue,
          disablesRoom: nextDisables,
        });
      }
      queryClient.invalidateQueries({ queryKey: getRoomOptionsQueryKey(kind) });
      if (kind === "type" && newRoom.type === currentValue.trim().toLowerCase()) {
        setNewRoom((prev) => ({ ...prev, type: nextValue }));
      }
      if (kind === "status" && newRoom.status === currentValue.trim().toLowerCase()) {
        setNewRoom((prev) => ({ ...prev, status: nextValue }));
      }
      toast({ title: `${label} updated`, description: `Saved as "${nextValue}".` });
      setEditingOption(null);
    } catch (error) {
      toast({
        title: "Failed to update option",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteOption = async (kind: "type" | "status", id: string, displayValue: string) => {
    if (kind === "status" && isBuiltinRoomStatusValue(displayValue)) {
      toast({
        title: "Built-in status",
        description: "Available, occupied, cleaning, and maintenance cannot be deleted.",
        variant: "destructive",
      });
      return;
    }
    setDeletingOption({ kind, id, value: displayValue });
  };

  const confirmDeleteOption = async () => {
    if (!deletingOption) return;
    const { kind, id, value } = deletingOption;
    const titleCase = kind === "type" ? "Room type" : "Room status";
    try {
      await deleteRoomOptionMutation.mutateAsync({ kind, id });
      queryClient.invalidateQueries({ queryKey: getRoomOptionsQueryKey(kind) });
      if (kind === "type" && newRoom.type === value.trim().toLowerCase()) {
        setNewRoom((prev) => ({ ...prev, type: "deluxe" }));
      }
      if (kind === "status" && newRoom.status === value.trim().toLowerCase()) {
        setNewRoom((prev) => ({ ...prev, status: "available" }));
      }
      toast({ title: `${titleCase} deleted`, description: `"${value}" has been removed.` });
      setDeletingOption(null);
    } catch (error) {
      toast({
        title: "Failed to delete option",
        description: error instanceof Error ? error.message : "Please remove usage first, then try again.",
        variant: "destructive",
      });
    }
  };

  const handleCreateRoom = async () => {
    try {
      await createRoomMutation.mutateAsync(newRoom);
      queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
      setIsCreateOpen(false);
      setNewRoom({ roomNumber: "", type: "deluxe", capacity: 2, pricePerNight: 0, status: "available" });
      toast({ title: "Room created successfully" });
    } catch (error) {
      toast({
        title: "Failed to create room",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const shouldIgnoreSelectFromAction = (event: unknown) => {
    const customEvent = event as CustomEvent<{ originalEvent?: Event }>;
    const originalTarget = customEvent.detail?.originalEvent?.target as HTMLElement | null;
    const domEvent = event as { target?: EventTarget | null };
    const target = originalTarget ?? (domEvent.target as HTMLElement | null);
    return Boolean(target?.closest("[data-option-action]"));
  };

  const viewingRoom = useMemo(
    () => safeRooms.find((r) => r.id === viewingRoomId) ?? null,
    [safeRooms, viewingRoomId],
  );
  const viewingRoomReservations = viewingRoom ? reservationsForRoom(viewingRoom) : null;

  return (
    <div className="space-y-5">
      {/* Page title + toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rooms</h1>
          <p className="text-muted-foreground">Monitor room status, pricing, and availability.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Quick search"
              className="pl-9 h-9 w-[200px] rounded-full bg-card"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[140px] rounded-full">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <SelectItemText>All statuses</SelectItemText>
              </SelectItem>
              {roomStatuses.filter((option) => Boolean(option.value?.trim())).map((option) => (
                <SelectItem key={option.id} value={option.value} className="capitalize">
                  <SelectItemText className="capitalize">{option.value}</SelectItemText>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="inline-flex items-center gap-1 rounded-full border bg-card p-1 text-xs">
            <button
              type="button"
              onClick={() => setView("timeline")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                view === "timeline" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              Timeline
            </button>
            <button
              type="button"
              onClick={() => setView("scheme")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                view === "scheme" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Scheme
            </button>
            <button
              type="button"
              onClick={() => setView("housekeeping")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                view === "housekeeping" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Housekeeping
            </button>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-9 rounded-full px-4">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Room
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Room</DialogTitle>
                <DialogDescription>Set up a new room for bookings.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-1">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Room Number</label>
                  <Input
                    value={newRoom.roomNumber}
                    onChange={(e) => setNewRoom((prev) => ({ ...prev, roomNumber: e.target.value }))}
                    placeholder="e.g. 302"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={newRoom.type || undefined}
                    onValueChange={(value) => setNewRoom((prev) => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="capitalize">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="min-w-[260px]">
                      {selectableRoomTypes.map((option) => (
                        <SelectItem
                          key={option.id}
                          value={option.value}
                          textValue={option.value}
                          onSelect={(event) => {
                            if (shouldIgnoreSelectFromAction(event)) event.preventDefault();
                          }}
                        >
                          <div className="flex w-full min-w-[200px] items-center justify-between gap-2">
                            <SelectItemText className="capitalize flex-1 truncate pr-1">{option.value}</SelectItemText>
                            <div
                              className="flex shrink-0 items-center gap-0.5 relative z-[100]"
                              onPointerDown={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span
                                role="button"
                                data-option-action="edit"
                                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted cursor-pointer transition-colors"
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void editOption("type", option.id, option.value);
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                              </span>
                              <span
                                role="button"
                                data-option-action="delete"
                                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive cursor-pointer transition-colors"
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void deleteOption("type", option.id, option.value);
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                      <div
                        className="sticky bottom-0 z-10 mt-1 border-t bg-popover p-2"
                        onPointerDown={(e) => e.preventDefault()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Add new type</p>
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={newTypeOption}
                            onChange={(e) => setNewTypeOption(e.target.value)}
                            placeholder="e.g. suite"
                            className="h-8 text-xs"
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void addOption("type", newTypeOption);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => void addOption("type", newTypeOption)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Capacity</label>
                  <Input
                    type="number"
                    min={1}
                    value={newRoom.capacity}
                    onChange={(e) => setNewRoom((prev) => ({ ...prev, capacity: Number(e.target.value) || 1 }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Price / Night</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={newRoom.pricePerNight}
                    onChange={(e) => setNewRoom((prev) => ({ ...prev, pricePerNight: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium">Initial Status</label>
                  <Select
                    value={newRoom.status || undefined}
                    onValueChange={(value) => setNewRoom((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger className="capitalize">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="min-w-[280px]">
                      {roomStatusesManualPick.map((option) => (
                        <SelectItem
                          key={option.id}
                          value={option.value}
                          textValue={option.value}
                          onSelect={(event) => {
                            if (shouldIgnoreSelectFromAction(event)) event.preventDefault();
                          }}
                        >
                          <div className="flex w-full min-w-[200px] items-center justify-between gap-2">
                            <SelectItemText className="capitalize flex-1 truncate pr-1">
                              {option.value}
                              {option.disablesRoom ? (
                                <span className="ml-1 text-[10px] font-normal text-muted-foreground normal-case">
                                  · unavailable
                                </span>
                              ) : null}
                            </SelectItemText>
                            {!isBuiltinRoomStatusValue(option.value) ? (
                              <div
                                className="flex shrink-0 items-center gap-0.5 relative z-[100]"
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span
                                  role="button"
                                  data-option-action="edit"
                                  className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted cursor-pointer transition-colors"
                                  onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void editOption("status", option.id, option.value);
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                >
                                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                </span>
                                <span
                                  role="button"
                                  data-option-action="delete"
                                  className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive cursor-pointer transition-colors"
                                  onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void deleteOption("status", option.id, option.value);
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground shrink-0">Built-in</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                      <div
                        className="sticky bottom-0 z-10 mt-1 space-y-2 border-t bg-popover p-2"
                        onPointerDown={(e) => e.preventDefault()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <p className="text-[11px] font-medium text-muted-foreground">Add new status</p>
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={newStatusOption}
                            onChange={(e) => setNewStatusOption(e.target.value)}
                            placeholder="e.g. renovation"
                            className="h-8 text-xs"
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void addOption("status", newStatusOption, {
                                  disablesRoom: newStatusDisablesRoom,
                                });
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() =>
                              void addOption("status", newStatusOption, {
                                disablesRoom: newStatusDisablesRoom,
                              })
                            }
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2.5 py-2">
                          <Label htmlFor="new-status-disables" className="text-[11px] font-medium cursor-pointer leading-snug">
                            Unavailable / not bookable
                          </Label>
                          <Switch
                            id="new-status-disables"
                            checked={newStatusDisablesRoom}
                            onCheckedChange={setNewStatusDisablesRoom}
                          />
                        </div>
                      </div>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRoom} disabled={createRoomMutation.isPending}>
                  {createRoomMutation.isPending ? "Creating..." : "Create Room"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Chip stats */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "available", label: "Available", count: availableCount },
          { key: "occupied", label: "Occupied", count: occupiedCount },
          { key: "cleaning", label: "Cleaning", count: cleaningCount },
          { key: "maintenance", label: "Maintenance", count: maintenanceCount },
        ].map((s) => {
          const sx = styleFor(s.key);
          return (
            <div
              key={s.key}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs",
                sx.chipBg,
              )}
            >
              <span className={cn("w-2 h-2 rounded-full", sx.dot)} />
              <span className={cn("font-medium", sx.chipText)}>{s.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {s.count} <span className="text-muted-foreground/70">· {percent(s.count)}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : view === "housekeeping" ? (
        <div className="space-y-4">
          {/* Housekeeping Filters */}
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unit Type</label>
                <Select value={hkFilterUnitType} onValueChange={setHkFilterUnitType}>
                  <SelectTrigger className="h-9 w-[130px] rounded-lg">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"><SelectItemText>All types</SelectItemText></SelectItem>
                    {selectableRoomTypes.map((o) => (
                      <SelectItem key={o.id} value={o.value} className="capitalize">
                        <SelectItemText className="capitalize">{o.value}</SelectItemText>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Frontdesk Status</label>
                <Select value={hkFilterFrontdeskStatus} onValueChange={setHkFilterFrontdeskStatus}>
                  <SelectTrigger className="h-9 w-[140px] rounded-lg">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"><SelectItemText>All statuses</SelectItemText></SelectItem>
                    <SelectItem value="checked_in"><SelectItemText>Checked In</SelectItemText></SelectItem>
                    <SelectItem value="reserved"><SelectItemText>Reserved</SelectItemText></SelectItem>
                    <SelectItem value="vacant"><SelectItemText>Vacant</SelectItemText></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unit Status</label>
                <Select value={hkFilterUnitStatus} onValueChange={setHkFilterUnitStatus}>
                  <SelectTrigger className="h-9 w-[130px] rounded-lg">
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"><SelectItemText>All status</SelectItemText></SelectItem>
                    <SelectItem value="occupied"><SelectItemText>Occupied</SelectItemText></SelectItem>
                    <SelectItem value="vacant"><SelectItemText>Vacant</SelectItemText></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Condition</label>
                <Select value={hkFilterCondition} onValueChange={setHkFilterCondition}>
                  <SelectTrigger className="h-9 w-[120px] rounded-lg">
                    <SelectValue placeholder="All conditions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"><SelectItemText>All conditions</SelectItemText></SelectItem>
                    <SelectItem value="clean"><SelectItemText>Clean</SelectItemText></SelectItem>
                    <SelectItem value="dirty"><SelectItemText>Dirty</SelectItemText></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Do Not Disturb</label>
                <Select value={hkFilterDnd} onValueChange={setHkFilterDnd}>
                  <SelectTrigger className="h-9 w-[120px] rounded-lg">
                    <SelectValue placeholder="All DND" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"><SelectItemText>All DND</SelectItemText></SelectItem>
                    <SelectItem value="dnd"><SelectItemText>DND Active</SelectItemText></SelectItem>
                    <SelectItem value="no-dnd"><SelectItemText>No DND</SelectItemText></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned to</label>
                <Select value={hkFilterHousekeeper} onValueChange={setHkFilterHousekeeper}>
                  <SelectTrigger className="h-9 w-[160px] rounded-lg">
                    <SelectValue placeholder="All housekeepers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"><SelectItemText>All housekeepers</SelectItemText></SelectItem>
                    <SelectItem value="unassigned"><SelectItemText>Unassigned</SelectItemText></SelectItem>
                    {housekeepers.filter((h) => Boolean(h.id?.trim())).map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        <SelectItemText>{h.name}</SelectItemText>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg"
                  onClick={() => {
                    setHkFilterUnitType("all");
                    setHkFilterFrontdeskStatus("all");
                    setHkFilterUnitStatus("all");
                    setHkFilterCondition("all");
                    setHkFilterDnd("all");
                    setHkFilterHousekeeper("all");
                  }}
                >
                  Clear Filters
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg border-primary/40 hover:bg-primary/5 text-primary"
                  onClick={() => setIsHkManagerOpen(true)}
                >
                  <Users className="w-4 h-4 mr-1.5" />
                  Housekeepers
                </Button>
              </div>
            </div>
          </div>

          {filteredHkRooms.length === 0 ? (
            <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
              No rooms match the current housekeeping filter.
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="p-3 pl-4">Unit Number</th>
                      <th className="p-3">Unit Type</th>
                      <th className="p-3">Condition</th>
                      <th className="p-3">Unit Status</th>
                      <th className="p-3">Arrival Time</th>
                      <th className="p-3">Arrival Date</th>
                      <th className="p-3">Departure Date</th>
                      <th className="p-3">Frontdesk Status</th>
                      <th className="p-3">Assigned to</th>
                      <th className="p-3 text-center">Do Not Disturb</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredHkRooms.map((room) => {
                      const resData = reservationsForRoom(room);
                      const isOccupied = room.status === "occupied" || !!resData.current;
                      const frontdeskStatusVal = resData.current 
                        ? "Checked In" 
                        : (resData.upcoming.length > 0 ? "Reserved" : "Vacant");

                      const arrivalDate = resData.current 
                        ? format(parseISO(resData.current.checkInDate), "MMM dd, yyyy") 
                        : (resData.upcoming.length > 0 ? format(parseISO(resData.upcoming[0].checkInDate), "MMM dd, yyyy") : "-");

                      const departureDate = resData.current 
                        ? format(parseISO(resData.current.checkOutDate), "MMM dd, yyyy") 
                        : (resData.upcoming.length > 0 ? format(parseISO(resData.upcoming[0].checkOutDate), "MMM dd, yyyy") : "-");

                      const arrivalTime = resData.current 
                        ? "14:00"
                        : (resData.upcoming.length > 0 ? "14:00" : "-");

                      return (
                        <tr key={room.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 pl-4 font-semibold text-foreground">Room {room.roomNumber}</td>
                          <td className="p-3 capitalize text-muted-foreground">{room.type}</td>
                          <td className="p-3">
                            <Select
                              value={room.condition || "clean"}
                              onValueChange={(val) => {
                                updateRoomMutation.mutate({ id: room.id, condition: val });
                                toast({ title: `Room ${room.roomNumber} condition updated to ${val}` });
                              }}
                            >
                              <SelectTrigger className={cn(
                                "h-8 w-28 text-xs font-semibold rounded-full border-none shadow-none px-2.5",
                                room.condition === "dirty" 
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" 
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              )}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="clean"><SelectItemText>Clean</SelectItemText></SelectItem>
                                <SelectItem value="dirty"><SelectItemText>Dirty</SelectItemText></SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-3">
                            <Badge variant={isOccupied ? "secondary" : "default"} className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide border-none",
                              isOccupied 
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            )}>
                              {isOccupied ? "Occupied" : "Vacant"}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{arrivalTime}</td>
                          <td className="p-3 text-muted-foreground">{arrivalDate}</td>
                          <td className="p-3 text-muted-foreground">{departureDate}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                              frontdeskStatusVal === "Checked In" && "border-blue-500/30 text-blue-500 bg-blue-500/5",
                              frontdeskStatusVal === "Reserved" && "border-purple-500/30 text-purple-500 bg-purple-500/5",
                              frontdeskStatusVal === "Vacant" && "border-slate-500/30 text-slate-500 bg-slate-500/5"
                            )}>
                              {frontdeskStatusVal}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Select
                              value={room.assignedHousekeeperId || "unassigned"}
                              onValueChange={(val) => {
                                const hkId = val === "unassigned" ? null : val;
                                updateRoomMutation.mutate({ id: room.id, assignedHousekeeperId: hkId });
                                toast({ 
                                  title: "Housekeeper Assigned", 
                                  description: val === "unassigned" 
                                    ? `Room ${room.roomNumber} is now unassigned.`
                                    : `Assigned to ${housekeepers.find(h => h.id === val)?.name}` 
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 w-44 text-xs bg-transparent border-input rounded-lg">
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned"><SelectItemText>Unassigned</SelectItemText></SelectItem>
                                {housekeepers.filter((hk) => Boolean(hk.id?.trim())).map((hk) => (
                                  <SelectItem key={hk.id} value={hk.id}>
                                    <SelectItemText>{hk.name}</SelectItemText>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center">
                              <Switch
                                checked={!!room.doNotDisturb}
                                onCheckedChange={(checked) => {
                                  updateRoomMutation.mutate({ id: room.id, doNotDisturb: checked });
                                  toast({ 
                                    title: checked ? "Do Not Disturb Activated" : "Do Not Disturb Deactivated",
                                    description: `Room ${room.roomNumber} status updated.`
                                  });
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
          No rooms match the current filter.
        </div>
      ) : view === "scheme" ? (
        <SchemeView
          groups={groupedRooms}
          getReservations={reservationsForRoom}
          onOpenRoom={(id) => setViewingRoomId(id)}
          prettyStatus={prettyStatus}
        />
      ) : (
        <TimelineView
          groups={groupedRooms}
          reservations={reservations}
          start={timelineStart}
          onShift={(days) => {
            const next = new Date(timelineStart);
            next.setDate(next.getDate() + days);
            setTimelineStart(next);
          }}
          onResetToday={() => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - 1);
            setTimelineStart(d);
          }}
          onOpenRoom={(id) => setViewingRoomId(id)}
        />
      )}

      {/* Room details */}
      <Dialog open={Boolean(viewingRoom)} onOpenChange={(open) => !open && setViewingRoomId(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden" showCloseButton={false}>
          {viewingRoom && viewingRoomReservations ? (
            <RoomDetails
              room={viewingRoom}
              data={viewingRoomReservations}
              prettyStatus={prettyStatus}
              statusOptionsManualPick={roomStatusesManualPick}
              roomTypes={roomTypes}
              shouldIgnoreSelectFromAction={shouldIgnoreSelectFromAction}
              onRequestEditStatusOption={(id, value) => void editOption("status", id, value)}
              onRequestDeleteStatusOption={(id, value) => void deleteOption("status", id, value)}
              onAddStatusOption={(value, disablesRoom) => addRoomStatusOptionStrict(value, disablesRoom)}
              onCloseDetails={() => setViewingRoomId(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit / delete option dialogs */}
      <Dialog open={Boolean(editingOption)} onOpenChange={(open) => !open && setEditingOption(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingOption?.kind === "type" ? "Room Type" : "Room Status"}</DialogTitle>
            <DialogDescription>
              {editingOption?.kind === "type"
                ? "Update the option name."
                : "Update the label and whether this status marks the room as unavailable."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editingOption?.nextValue ?? ""}
                onChange={(e) => setEditingOption((prev) => (prev ? { ...prev, nextValue: e.target.value } : prev))}
                placeholder="Enter new option name"
              />
            </div>
            {editingOption?.kind === "status" ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                <Label htmlFor="edit-status-disables" className="text-xs font-medium cursor-pointer leading-snug">
                  Unavailable / not bookable
                </Label>
                <Switch
                  id="edit-status-disables"
                  checked={Boolean(editingOption.disablesRoom)}
                  onCheckedChange={(checked) =>
                    setEditingOption((prev) => (prev ? { ...prev, disablesRoom: checked } : prev))
                  }
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOption(null)}>
              Cancel
            </Button>
            <Button onClick={submitEditOption} disabled={updateRoomOptionMutation.isPending}>
              {updateRoomOptionMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingOption)} onOpenChange={(open) => !open && setDeletingOption(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Option</DialogTitle>
            <DialogDescription>
              Delete{" "}
              {deletingOption
                ? `${deletingOption.kind === "type" ? "room type" : "room status"} "${deletingOption.value}"?`
                : "this option?"}{" "}
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingOption(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteOption} disabled={deleteRoomOptionMutation.isPending}>
              {deleteRoomOptionMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Housekeepers Manager Modal */}
      <Dialog open={isHkManagerOpen} onOpenChange={setIsHkManagerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Housekeeping Staff Directory</DialogTitle>
            <DialogDescription>Add, update, and manage your hotel's housekeeping staff.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
            {/* Add / Edit Form */}
            <div className="md:col-span-1 rounded-xl border bg-muted/20 p-4 space-y-4 h-fit">
              <h3 className="text-sm font-semibold text-foreground">
                {editingHk ? "Edit Housekeeper" : "Add Housekeeper"}
              </h3>
              
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <Label htmlFor="hk-name">Full Name</Label>
                  <Input
                    id="hk-name"
                    placeholder="e.g. Mollie Gonzales"
                    value={editingHk ? editingHkName : newHkName}
                    onChange={(e) => editingHk ? setEditingHkName(e.target.value) : setNewHkName(e.target.value)}
                    className="h-8"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="hk-phone">Phone Number</Label>
                  <Input
                    id="hk-phone"
                    placeholder="e.g. +63 912 345 6789"
                    value={editingHk ? editingHkPhone : newHkPhone}
                    onChange={(e) => editingHk ? setEditingHkPhone(e.target.value) : setNewHkPhone(e.target.value)}
                    className="h-8"
                  />
                </div>

                {editingHk && (
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select value={editingHkStatus} onValueChange={editingHkStatus => setEditingHkStatus(editingHkStatus)}>
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active"><SelectItemText>Active</SelectItemText></SelectItem>
                        <SelectItem value="inactive"><SelectItemText>Inactive</SelectItemText></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="w-full text-xs"
                  onClick={async () => {
                    const name = editingHk ? editingHkName : newHkName;
                    const phone = editingHk ? editingHkPhone : newHkPhone;
                    if (!name.trim()) {
                      toast({ title: "Name is required", variant: "destructive" });
                      return;
                    }

                    try {
                      if (editingHk) {
                        await updateHousekeeperMutation.mutateAsync({
                          id: editingHk.id,
                          name,
                          phone,
                          status: editingHkStatus
                        });
                        toast({ title: "Housekeeper updated successfully" });
                        setEditingHk(null);
                        setEditingHkName("");
                        setEditingHkPhone("");
                      } else {
                        await createHousekeeperMutation.mutateAsync({
                          name,
                          phone,
                          status: "active"
                        });
                        toast({ title: "Housekeeper added successfully" });
                        setNewHkName("");
                        setNewHkPhone("");
                      }
                    } catch (err: any) {
                      toast({ title: "Failed to save housekeeper", description: err.message, variant: "destructive" });
                    }
                  }}
                >
                  {editingHk ? "Save" : "Add Staff"}
                </Button>

                {editingHk && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setEditingHk(null);
                      setEditingHkName("");
                      setEditingHkPhone("");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Directory Table */}
            <div className="md:col-span-2 rounded-xl border overflow-hidden">
              <div className="max-h-[350px] overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="p-2.5 pl-3">Name</th>
                      <th className="p-2.5">Phone</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5 text-right pr-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {housekeepers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted-foreground">
                          No housekeeping staff in directory.
                        </td>
                      </tr>
                    ) : (
                      housekeepers.map((hk) => (
                        <tr key={hk.id} className="hover:bg-muted/30">
                          <td className="p-2.5 pl-3 font-medium text-foreground">{hk.name}</td>
                          <td className="p-2.5 text-muted-foreground">{hk.phone || "-"}</td>
                          <td className="p-2.5">
                            <Badge variant="outline" className={cn(
                              "rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide",
                              hk.status === "active" 
                                ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5" 
                                : "border-slate-500/30 text-slate-500 bg-slate-500/5"
                            )}>
                              {hk.status}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-right pr-3 space-x-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditingHk(hk);
                                setEditingHkName(hk.name);
                                setEditingHkPhone(hk.phone || "");
                                setEditingHkStatus(hk.status);
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                              onClick={async () => {
                                if (confirm(`Are you sure you want to remove ${hk.name}?`)) {
                                  try {
                                    await deleteHousekeeperMutation.mutateAsync(hk.id);
                                    toast({ title: "Housekeeper removed" });
                                    if (editingHk?.id === hk.id) {
                                      setEditingHk(null);
                                    }
                                  } catch (err: any) {
                                    toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
                                  }
                                }
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────────── Scheme view ───────────── */

function SchemeView({
  groups,
  getReservations,
  onOpenRoom,
  prettyStatus,
}: {
  groups: Array<[string, Room[]]>;
  getReservations: (r: Room) => RoomReservationData;
  onOpenRoom: (id: string) => void;
  prettyStatus: (s: string) => string;
}) {
  return (
    <div className="space-y-7">
      {groups.map(([type, list]) => (
        <section key={type} className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground pl-1">
            {type} rooms
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {list.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                data={getReservations(room)}
                onOpen={() => onOpenRoom(room.id)}
                prettyStatus={prettyStatus}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RoomCard({
  room,
  data,
  onOpen,
  prettyStatus,
}: {
  room: Room;
  data: RoomReservationData;
  onOpen: () => void;
  prettyStatus: (s: string) => string;
}) {
  const { current, upcoming } = data;
  const isReserved = room.status === "available" && !current && upcoming.length > 0;
  const effectiveStatus = isReserved ? "reserved" : room.status;
  const sx = styleFor(effectiveStatus);
  const StatusIcon = sx.icon;
  const nightsRemaining =
    current && current.checkOutDate
      ? Math.max(0, differenceInCalendarDays(parseISO(current.checkOutDate), new Date()))
      : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative text-left rounded-xl border bg-card p-3 transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-ring",
        "ring-1 ring-transparent",
        sx.ring,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full", sx.dot)} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isReserved ? "Reserved" : prettyStatus(room.status)}
            </span>
          </div>
          <div className="text-base font-semibold mt-0.5">Room {room.roomNumber}</div>
        </div>
        {current ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              sx.chipBg,
              sx.chipText,
            )}
            title={`${nightsRemaining} night(s) remaining`}
          >
            <Clock className="w-3 h-3" />
            {nightsRemaining}n
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center justify-center rounded-full w-6 h-6",
              sx.chipBg,
              sx.chipText,
            )}
          >
            <StatusIcon className="w-3.5 h-3.5" />
          </span>
        )}
      </div>

      <div className="mt-2 min-h-[28px] flex items-center justify-between gap-2">
        {current ? (
          <>
            <div className="flex -space-x-1.5">
              <GuestAvatar name={current.guestName} />
              {upcoming[0] ? <GuestAvatar name={upcoming[0].guestName} /> : null}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {format(parseISO(current.checkInDate), "MMM d")} – {format(parseISO(current.checkOutDate), "MMM d")}
            </div>
          </>
        ) : upcoming[0] ? (
          <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Next: {format(parseISO(upcoming[0].checkInDate), "MMM d")}
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <BedDouble className="w-3 h-3" />
            {room.capacity} pax · ₱{room.pricePerNight.toFixed(0)}
          </div>
        )}
      </div>
    </button>
  );
}

/* ───────────── Timeline view ───────────── */

function TimelineView({
  groups,
  reservations,
  start,
  onShift,
  onResetToday,
  onOpenRoom,
}: {
  groups: Array<[string, Room[]]>;
  reservations: Reservation[];
  start: Date;
  onShift: (days: number) => void;
  onResetToday: () => void;
  onOpenRoom: (id: string) => void;
}) {
  const days: Date[] = Array.from({ length: TIMELINE_DAYS }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const last = days[days.length - 1]!;

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayCol = days.findIndex((d) => format(d, "yyyy-MM-dd") === todayKey);

  /** Visible reservations grouped by roomNumber (overlapping the window, non-cancelled). */
  const reservationsInWindow = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    const windowStart = days[0]!;
    const windowEnd = last;
    for (const r of reservations) {
      if (r.status === "cancelled" || r.status === "no_show") continue;
      const ci = parseISO(r.checkInDate);
      const co = parseISO(r.checkOutDate);
      if (co < windowStart || ci > windowEnd) continue;
      if (!map.has(r.roomNumber)) map.set(r.roomNumber, []);
      map.get(r.roomNumber)!.push(r);
    }
    return map;
  }, [reservations, days, last]);

  const dayKeys = days.map((d) => format(d, "yyyy-MM-dd"));
  const monthLabel = `${format(days[0]!, "MMM yyyy")}${
    format(days[0]!, "MMM yyyy") !== format(last, "MMM yyyy") ? ` – ${format(last, "MMM yyyy")}` : ""
  }`;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
        <div className="text-xs font-medium text-muted-foreground">{monthLabel}</div>
        <div className="inline-flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onShift(-7)} aria-label="Previous week">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onResetToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onShift(7)} aria-label="Next week">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-auto">
        <div className="min-w-[760px]">
          {/* Header row */}
          <div
            className="grid border-b bg-card"
            style={{ gridTemplateColumns: `200px repeat(${TIMELINE_DAYS}, minmax(0, 1fr))` }}
          >
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Rooms
            </div>
            {days.map((d, i) => {
              const isToday = i === todayCol;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={i}
                  className={cn(
                    "py-1.5 text-center border-l text-[10px] uppercase tracking-wider",
                    isWeekend ? "bg-muted/40" : "",
                    isToday ? "text-primary font-semibold" : "text-muted-foreground",
                  )}
                >
                  <div>{format(d, "EEE")}</div>
                  <div className="text-[11px] tabular-nums">{format(d, "d")}</div>
                </div>
              );
            })}
          </div>

          {/* Body */}
          {groups.map(([type, list]) => (
            <div key={type}>
              <div
                className="grid bg-muted/30 border-b"
                style={{ gridTemplateColumns: `200px repeat(${TIMELINE_DAYS}, minmax(0, 1fr))` }}
              >
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {type} rooms
                </div>
                <div style={{ gridColumn: `2 / span ${TIMELINE_DAYS}` }} />
              </div>
              {list.map((room) => (
                <TimelineRow
                  key={room.id}
                  room={room}
                  reservations={reservationsInWindow.get(room.roomNumber) ?? []}
                  dayKeys={dayKeys}
                  todayCol={todayCol}
                  onOpenRoom={onOpenRoom}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  room,
  reservations,
  dayKeys,
  todayCol,
  onOpenRoom,
}: {
  room: Room;
  reservations: Reservation[];
  dayKeys: string[];
  todayCol: number;
  onOpenRoom: (id: string) => void;
}) {
  return (
    <div
      className="grid border-b last:border-b-0 hover:bg-muted/30 relative"
      style={{ gridTemplateColumns: `200px repeat(${TIMELINE_DAYS}, minmax(0, 1fr))` }}
    >
      <button
        type="button"
        onClick={() => onOpenRoom(room.id)}
        className="text-left px-3 py-2 text-sm font-medium hover:text-primary truncate"
      >
        Room {room.roomNumber}
        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">{room.status}</span>
      </button>
      {dayKeys.map((_, i) => (
        <div
          key={i}
          className={cn(
            "border-l h-10",
            todayCol === i ? "bg-primary/5" : "",
            i % 7 === 6 ? "bg-muted/20" : "",
          )}
        />
      ))}

      {reservations.map((r) => {
        const startCol = Math.max(0, dayKeys.indexOf(r.checkInDate.slice(0, 10)));
        const endIdx = dayKeys.indexOf(r.checkOutDate.slice(0, 10));
        const endCol = endIdx === -1 ? TIMELINE_DAYS - 1 : Math.max(startCol, endIdx - 1);
        const span = Math.max(1, endCol - startCol + 1);

        const isCheckedIn = r.status === "checked_in";
        const isReserved = r.status === "reserved";
        const isPast = r.status === "checked_out";

        return (
          <div
            key={r.id}
            className="absolute top-1 bottom-1 mx-[2px] flex items-center"
            style={{
              left: `calc(200px + ${startCol} * ((100% - 200px) / ${TIMELINE_DAYS}))`,
              width: `calc(${span} * ((100% - 200px) / ${TIMELINE_DAYS}) - 4px)`,
            }}
          >
            <div
              title={`${r.guestName} · ${r.checkInDate} → ${r.checkOutDate}`}
              className={cn(
                "h-7 w-full rounded-md px-2 text-[11px] font-medium text-white flex items-center gap-1.5 truncate shadow-sm",
                isCheckedIn ? "bg-emerald-500" : isReserved ? "bg-sky-500" : isPast ? "bg-slate-400/80" : "bg-indigo-500",
              )}
            >
              <GuestAvatar name={r.guestName} size={16} />
              <span className="truncate">{r.guestName}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── Room details modal ───────────── */

type RoomReservationData = {
  all: Reservation[];
  current: Reservation | undefined;
  upcoming: Reservation[];
  past: Reservation[];
};

function RoomDetails({
  room,
  data,
  prettyStatus,
  statusOptionsManualPick,
  roomTypes,
  shouldIgnoreSelectFromAction,
  onRequestEditStatusOption,
  onRequestDeleteStatusOption,
  onAddStatusOption,
  onCloseDetails,
}: {
  room: Room;
  data: RoomReservationData;
  prettyStatus: (s: string) => string;
  statusOptionsManualPick: RoomOption[];
  roomTypes: RoomOption[];
  shouldIgnoreSelectFromAction: (event: unknown) => boolean;
  onRequestEditStatusOption: (id: string, value: string) => void;
  onRequestDeleteStatusOption: (id: string, value: string) => void;
  onAddStatusOption: (value: string, disablesRoom?: boolean) => void | Promise<void>;
  onCloseDetails: () => void;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateRoomMutation = useUpdateRoom();
  const deleteRoomMutation = useDeleteRoom();

  const [newStatusInMenu, setNewStatusInMenu] = useState("");
  const [newSubmenuStatusDisables, setNewSubmenuStatusDisables] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    roomNumber: room.roomNumber,
    type: room.type,
    capacity: room.capacity,
    pricePerNight: room.pricePerNight,
    status: room.status,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState("");

  useEffect(() => {
    if (!editOpen) return;
    setEditForm({
      roomNumber: room.roomNumber,
      type: room.type,
      capacity: room.capacity,
      pricePerNight: room.pricePerNight,
      status: room.status,
    });
  }, [editOpen, room.id, room.roomNumber, room.type, room.capacity, room.pricePerNight, room.status]);

  useEffect(() => {
    if (!deleteOpen) setDeleteTyped("");
  }, [deleteOpen]);

  const { current, upcoming, past } = data;
  const isReserved = room.status === "available" && !current && upcoming.length > 0;
  const effectiveStatus = isReserved ? "reserved" : room.status;
  const sx = styleFor(effectiveStatus);

  const nightsTotal = current
    ? Math.max(1, differenceInCalendarDays(parseISO(current.checkOutDate), parseISO(current.checkInDate)))
    : 0;
  const elapsed = current
    ? Math.min(nightsTotal, Math.max(0, differenceInCalendarDays(new Date(), parseISO(current.checkInDate))))
    : 0;
  const tenurePct = nightsTotal > 0 ? Math.round((elapsed / nightsTotal) * 100) : 0;

  const handlePatchStatus = async (status: string) => {
    if (status === room.status) return;
    try {
      await updateRoomMutation.mutateAsync({ id: room.id, status });
      await queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
      toast({ title: "Status updated", description: `Room is now ${prettyStatus(status)}.` });
    } catch (error) {
      toast({
        title: "Could not update status",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveEdit = async () => {
    try {
      const base = {
        id: room.id,
        roomNumber: editForm.roomNumber.trim(),
        type: editForm.type,
        capacity: editForm.capacity,
        pricePerNight: editForm.pricePerNight,
      };
      if (room.status !== "occupied") {
        await updateRoomMutation.mutateAsync({ ...base, status: editForm.status });
      } else {
        await updateRoomMutation.mutateAsync(base);
      }
      await queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
      toast({ title: "Room updated" });
      setEditOpen(false);
    } catch (error) {
      toast({
        title: "Failed to save room",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRoom = async () => {
    try {
      await deleteRoomMutation.mutateAsync(room.id);
      await queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
      toast({ title: "Room deleted" });
      setDeleteOpen(false);
      onCloseDetails();
    } catch (error) {
      toast({
        title: "Could not delete room",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const deleteConfirmOk = deleteTyped.trim() === room.roomNumber.trim();

  return (
    <>
      <div>
        {/* Header band */}
        <div className={cn("p-5 pb-4 relative", sx.chipBg)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]">
                <span className={cn("w-1.5 h-1.5 rounded-full", sx.dot)} />
                <span className={sx.chipText}>{isReserved ? "Reserved" : prettyStatus(room.status)}</span>
              </div>
              <DialogTitle className="mt-1 text-2xl">Room {room.roomNumber}</DialogTitle>
              <DialogDescription className="capitalize mt-0.5">
                {room.type} · {room.capacity} pax
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge variant="outline" className="font-mono uppercase">
                #{room.roomNumber}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="Room actions">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Set status</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-64 overflow-y-auto min-w-[220px]">
                      {statusOptionsManualPick.map((option) => (
                        <DropdownMenuItem
                          key={option.id}
                          className="cursor-default p-0 focus:bg-transparent"
                          onSelect={(event) => {
                            if (shouldIgnoreSelectFromAction(event)) {
                              event.preventDefault();
                              return;
                            }
                            void handlePatchStatus(option.value);
                          }}
                        >
                          <div className="flex w-full min-w-[200px] items-center justify-between gap-2 px-2 py-1">
                            <span className="capitalize flex-1 truncate pr-1">
                              {option.value}
                              {option.disablesRoom ? (
                                <span className="ml-1 text-[10px] font-normal text-muted-foreground normal-case">
                                  · unavailable
                                </span>
                              ) : null}
                              {option.value === room.status ? (
                                <span className="ml-1 text-[10px] font-normal text-muted-foreground normal-case">(current)</span>
                              ) : null}
                            </span>
                            {!isBuiltinRoomStatusValue(option.value) ? (
                              <div
                                className="flex shrink-0 items-center gap-0.5"
                                data-option-action
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  data-option-action="edit"
                                  className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted cursor-pointer transition-colors"
                                  onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onRequestEditStatusOption(option.id, option.value);
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                >
                                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                                <button
                                  type="button"
                                  data-option-action="delete"
                                  className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive cursor-pointer transition-colors"
                                  onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onRequestDeleteStatusOption(option.id, option.value);
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground shrink-0">Built-in</span>
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-default focus:bg-transparent"
                        onSelect={(e) => e.preventDefault()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <div className="flex w-full flex-col gap-2 pt-0.5">
                          <div className="flex w-full items-center gap-1">
                            <Input
                              value={newStatusInMenu}
                              onChange={(e) => setNewStatusInMenu(e.target.value)}
                              placeholder="New status"
                              className="h-8 text-xs flex-1"
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 shrink-0 px-2"
                              onClick={() => {
                                const v = newStatusInMenu.trim();
                                if (!v) return;
                                void (async () => {
                                  try {
                                    await onAddStatusOption(v, newSubmenuStatusDisables);
                                    setNewStatusInMenu("");
                                    setNewSubmenuStatusDisables(false);
                                  } catch (error) {
                                    toast({
                                      title: "Failed to add status",
                                      description: error instanceof Error ? error.message : "Please try again.",
                                      variant: "destructive",
                                    });
                                  }
                                })();
                              }}
                            >
                              Add
                            </Button>
                          </div>
                          <div className="flex items-center justify-between gap-2 px-0.5">
                            <Label htmlFor="submenu-status-disables" className="text-[11px] font-normal cursor-pointer">
                              Unavailable / not bookable
                            </Label>
                            <Switch
                              id="submenu-status-disables"
                              className="scale-90"
                              checked={newSubmenuStatusDisables}
                              onCheckedChange={setNewSubmenuStatusDisables}
                            />
                          </div>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setEditOpen(true);
                    }}
                  >
                    Edit room
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => {
                      e.preventDefault();
                      setDeleteOpen(true);
                    }}
                  >
                    Delete room
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <DetailChip icon={<Tag className="w-3.5 h-3.5" />} label="Type" value={<span className="capitalize">{room.type}</span>} />
            <DetailChip icon={<Users className="w-3.5 h-3.5" />} label="Capacity" value={`${room.capacity} pax`} />
            <DetailChip
              icon={<CircleDollarSign className="w-3.5 h-3.5" />}
              label="Rate / night"
              value={`₱${room.pricePerNight.toLocaleString()}`}
            />
            <DetailChip icon={<Hash className="w-3.5 h-3.5" />} label="Room ID" value={<span className="font-mono text-[11px]">{room.id.slice(0, 8)}</span>} />
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Current guest */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-muted-foreground" />
                Current guest
              </h3>
              {current ? (
                <Badge
                  variant="outline"
                  className={cn("text-[10px] uppercase tracking-wider border-none", sx.chipBg, sx.chipText)}
                >
                  {prettyStatus(current.status)}
                </Badge>
              ) : isReserved ? (
                <Badge
                  variant="outline"
                  className={cn("text-[10px] uppercase tracking-wider border-none", sx.chipBg, sx.chipText)}
                >
                  Reserved
                </Badge>
              ) : null}
            </div>
            {current ? (
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <GuestAvatar name={current.guestName} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{current.guestName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{current.reservationNumber}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Balance</div>
                    <div className={cn("font-semibold", current.balance > 0 ? "text-rose-600" : "text-emerald-600")}>
                      ₱{current.balance.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatPhDate(current.checkInDate)}
                    </span>
                    <span>
                      {elapsed} / {nightsTotal} nights
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {formatPhDate(current.checkOutDate)}
                      <Calendar className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, tenurePct))}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <DetailChip
                    icon={<Wallet className="w-3.5 h-3.5" />}
                    label="Paid"
                    value={`₱${current.paidAmount.toFixed(2)}`}
                  />
                  <DetailChip
                    icon={<CircleDollarSign className="w-3.5 h-3.5" />}
                    label="Total"
                    value={`₱${current.totalAmount.toFixed(2)}`}
                  />
                  <DetailChip icon={<Phone className="w-3.5 h-3.5" />} label="Reservation" value={current.reservationNumber} />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground inline-flex items-center gap-2">
                <BedDouble className="w-4 h-4" />
                No active guest in this room.
              </div>
            )}
          </section>

          {/* Upcoming */}
          <section>
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
              <CalendarRange className="w-4 h-4 text-muted-foreground" />
              Upcoming reservations
              <span className="text-xs text-muted-foreground font-normal">({upcoming.length})</span>
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground">No future bookings for this room.</p>
            ) : (
              <ul className="rounded-xl border divide-y bg-card max-h-[28vh] overflow-auto">
                {upcoming.slice(0, 8).map((r) => (
                  <li
                    key={r.id}
                    onClick={() =>
                      setLocation(`/guests?tab=bookings&search=${encodeURIComponent(r.reservationNumber)}`)
                    }
                    className="flex items-center justify-between gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors group/item"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GuestAvatar name={r.guestName} size={26} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate group-hover/item:text-primary transition-colors">{r.guestName}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{r.reservationNumber}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground">
                        {format(parseISO(r.checkInDate), "MMM d")} – {format(parseISO(r.checkOutDate), "MMM d")}
                      </div>
                      <div className="text-[11px] font-medium">₱{r.totalAmount.toFixed(2)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Summary footer */}
          <section className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1">
              <History className="w-3 h-3 text-muted-foreground" />
              {past.length} past stays
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1">
              <StickyNote className="w-3 h-3 text-muted-foreground" />
              {data.all.length} total reservations
            </span>
          </section>
        </div>

        <DialogFooter className="p-5 pt-0">
          <DialogClose asChild>
            <Button variant="outline" className="rounded-full">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit room</DialogTitle>
            <DialogDescription>Update room number, type, capacity, rate, and status.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-1">
            <div className="space-y-2">
              <label className="text-sm font-medium">Room number</label>
              <Input
                value={editForm.roomNumber}
                onChange={(e) => setEditForm((prev) => ({ ...prev, roomNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={editForm.type || undefined} onValueChange={(value) => setEditForm((prev) => ({ ...prev, type: value }))}>
                <SelectTrigger className="capitalize">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.filter((o) => Boolean(o.value?.trim())).map((option) => (
                    <SelectItem key={option.id} value={option.value} className="capitalize">
                      <SelectItemText className="capitalize">{option.value}</SelectItemText>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Capacity</label>
                <Input
                  type="number"
                  min={1}
                  value={editForm.capacity}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, capacity: Number(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Price / night</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editForm.pricePerNight}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, pricePerNight: Number(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              {room.status === "occupied" ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <span className="capitalize font-medium">{prettyStatus(room.status)}</span>
                  <p className="text-xs text-muted-foreground mt-1">Set automatically while a guest is checked in.</p>
                </div>
              ) : (
                <Select value={editForm.status || undefined} onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger className="capitalize">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptionsManualPick.filter((option) => Boolean(option.value?.trim())).map((option) => (
                      <SelectItem key={option.id} value={option.value} className="capitalize">
                        <SelectItemText className="capitalize">
                          {option.value}
                          {option.disablesRoom ? (
                            <span className="text-muted-foreground font-normal text-xs"> · unavailable</span>
                          ) : null}
                        </SelectItemText>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={updateRoomMutation.isPending}>
              {updateRoomMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this room?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Rooms with any reservations cannot be deleted. Type the room number{" "}
              <span className="font-mono font-semibold text-foreground">{room.roomNumber}</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteTyped}
            onChange={(e) => setDeleteTyped(e.target.value)}
            placeholder={room.roomNumber}
            className="font-mono"
            autoComplete="off"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!deleteConfirmOk || deleteRoomMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteRoom();
              }}
            >
              {deleteRoomMutation.isPending ? "Deleting…" : "Delete room"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DetailChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold mt-0.5 truncate">{value}</div>
    </div>
  );
}
