"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAdminBulkUpdateStudents,
  useAdminClassroom,
  useAdminDeleteStudents,
  useAdminUpdateStudent,
  useOperationMode,
  useSetOperationMode,
  type ClassroomUser,
  type OperationMode,
} from "@/lib/api-client";
import { useAuth } from "@/components/auth/AuthProvider";
import { ScrollableTablePane } from "@/components/layout/ScrollableTablePane";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  GraduationCap,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";

function hasPracticeActivity(s: ClassroomUser) {
  return s.reservationsCount > 0 || s.paymentsCount > 0 || s.posOrdersCount > 0;
}

type StatusFilter = "all" | "active" | "inactive";
type RoleFilter = "all" | "admin" | "staff";
type TourFilter = "all" | "done" | "pending";
type ActivityFilter = "all" | "with" | "none";
type SortKey = "name" | "role" | "status" | "tour" | "activity";
type SortDir = "asc" | "desc";

function ProgressCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-[3.25rem] flex-col items-center gap-0.5">
      <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

function StudentRow({
  student,
  selected,
  selectable,
  onSelect,
  busy,
  onActivate,
  onDeactivate,
  onMarkTourDone,
  onDelete,
}: {
  student: ClassroomUser;
  selected: boolean;
  selectable: boolean;
  onSelect: (checked: boolean) => void;
  busy: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onMarkTourDone: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      <TableCell className="w-10">
        <Checkbox
          checked={selected}
          disabled={!selectable}
          onCheckedChange={(v) => onSelect(v === true)}
          aria-label={`Select ${student.fullName}`}
        />
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{student.fullName || "—"}</span>
          <span className="text-xs text-muted-foreground">
            {student.email || student.username}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant={student.role === "admin" ? "default" : "secondary"}
          className={cn(
            "uppercase",
            student.role === "admin" && "bg-primary text-primary-foreground",
          )}
        >
          {student.role}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={student.isActive ? "outline" : "destructive"}>
          {student.isActive ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={student.onboardingCompleted ? "outline" : "secondary"}>
          {student.onboardingCompleted ? "Done" : "Pending"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-3 py-1">
          <ProgressCell label="Rooms" value={student.roomsCount} />
          <ProgressCell label="Guests" value={student.guestsCount} />
          <ProgressCell label="Res" value={student.reservationsCount} />
          <ProgressCell label="In" value={student.checkinsCount} />
          <ProgressCell label="Pay" value={student.paymentsCount} />
          <ProgressCell label="POS" value={student.posOrdersCount} />
          <ProgressCell label="Paid" value={student.posPaidCount} />
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap justify-end gap-1.5">
          {student.isActive ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={onDeactivate}>
              Deactivate
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={onActivate}>
              Activate
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={busy || student.onboardingCompleted}
            onClick={onMarkTourDone}
          >
            Mark tour done
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={busy}
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function AdminClassroomPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { data, isLoading, isError, error, refetch, isFetching } =
    useAdminClassroom();
  const updateStudent = useAdminUpdateStudent();
  const bulkUpdate = useAdminBulkUpdateStudents();
  const deleteStudents = useAdminDeleteStudents();
  const { data: operationMode = "lab", isLoading: modeLoading } =
    useOperationMode();
  const setOperationMode = useSetOperationMode();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [tourFilter, setTourFilter] = useState<TourFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isAdmin = user?.role === "admin";
  const busy =
    updateStudent.isPending ||
    bulkUpdate.isPending ||
    deleteStudents.isPending ||
    setOperationMode.isPending;
  const isShared = operationMode === "shared";

  const students = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    const next = list.filter((s) => {
      if (statusFilter === "active" && !s.isActive) return false;
      if (statusFilter === "inactive" && s.isActive) return false;
      if (roleFilter !== "all" && s.role !== roleFilter) return false;
      if (tourFilter === "done" && !s.onboardingCompleted) return false;
      if (tourFilter === "pending" && s.onboardingCompleted) return false;
      if (activityFilter === "with" && !hasPracticeActivity(s)) return false;
      if (activityFilter === "none" && hasPracticeActivity(s)) return false;
      if (!q) return true;
      const hay = `${s.fullName} ${s.username} ${s.email ?? ""} ${s.role}`.toLowerCase();
      return hay.includes(q);
    });
    next.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "role":
          cmp = (a.role || "").localeCompare(b.role || "", undefined, { sensitivity: "base" });
          break;
        case "status":
          cmp = Number(b.isActive) - Number(a.isActive);
          break;
        case "tour":
          cmp = Number(b.onboardingCompleted) - Number(a.onboardingCompleted);
          break;
        case "activity":
          cmp =
            Number(hasPracticeActivity(b)) - Number(hasPracticeActivity(a)) ||
            (b.reservationsCount + b.paymentsCount + b.posOrdersCount) -
              (a.reservationsCount + a.paymentsCount + a.posOrdersCount);
          break;
        case "name":
        default:
          cmp = (a.fullName || a.username || "").localeCompare(
            b.fullName || b.username || "",
            undefined,
            { sensitivity: "base" },
          );
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return next;
  }, [data, query, statusFilter, roleFilter, tourFilter, activityFilter, sortKey, sortDir]);

  const filtersActive =
    query.trim() !== "" ||
    statusFilter !== "all" ||
    roleFilter !== "all" ||
    tourFilter !== "all" ||
    activityFilter !== "all";

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir("asc");
  }

  const selectableIds = useMemo(
    () => students.filter((s) => s.id !== user?.id).map((s) => s.id),
    [students, user?.id],
  );

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selectableIds.some((id) => selected.has(id));

  const totals = useMemo(() => {
    const list = data ?? [];
    return {
      users: list.length,
      active: list.filter((s) => s.isActive).length,
      onboardingPending: list.filter((s) => !s.onboardingCompleted).length,
      withActivity: list.filter(
        (s) =>
          s.reservationsCount > 0 ||
          s.paymentsCount > 0 ||
          s.posOrdersCount > 0,
      ).length,
    };
  }, [data]);

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of selectableIds) next.add(id);
      } else {
        for (const id of selectableIds) next.delete(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function patchOne(
    id: string,
    data: { isActive?: boolean; onboardingCompleted?: boolean },
    okMessage: string,
  ) {
    try {
      await updateStudent.mutateAsync({ id, ...data });
      toast({ title: okMessage });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  }

  async function runBulk(
    action: "activate" | "deactivate" | "tour" | "delete",
  ) {
    const ids = [...selected].filter((id) => id !== user?.id);
    if (ids.length === 0) {
      toast({
        title: "Nothing selected",
        description: "Select one or more students first.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (action === "delete") {
        const ok = window.confirm(
          `Delete ${ids.length} account${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
        );
        if (!ok) return;
        const result = await deleteStudents.mutateAsync(ids);
        clearSelection();
        toast({
          title: `Deleted ${result.deleted ?? 0} account(s)`,
          description:
            result.failures && result.failures.length > 0
              ? `${result.failures.length} failed`
              : undefined,
        });
        return;
      }

      if (action === "activate") {
        await bulkUpdate.mutateAsync({ ids, isActive: true });
        toast({ title: `Activated ${ids.length} account(s)` });
      } else if (action === "deactivate") {
        await bulkUpdate.mutateAsync({ ids, isActive: false });
        toast({
          title: `Deactivated ${ids.length} account(s)`,
          description: "They cannot log in until activated again.",
        });
      } else {
        await bulkUpdate.mutateAsync({ ids, onboardingCompleted: true });
        toast({ title: `Marked tour done for ${ids.length} student(s)` });
      }
      clearSelection();
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  }

  async function toggleMode(nextShared: boolean) {
    const mode: OperationMode = nextShared ? "shared" : "lab";
    const label = nextShared ? "Real hotel system" : "Lab activity";
    const ok = window.confirm(
      nextShared
        ? "Switch to Real system mode?\n\nAll staff will see each other’s bookings, guests, payments, and POS activity — like one shared hotel."
        : "Switch to Lab activity mode?\n\nEach student keeps private progress. Rooms (and menus) created by admins stay visible to everyone.",
    );
    if (!ok) return;
    try {
      await setOperationMode.mutateAsync(mode);
      toast({ title: `Mode set to ${label}` });
    } catch (err) {
      toast({
        title: "Could not change mode",
        description: err instanceof Error ? err.message : "Run 006_operation_mode.sql first.",
        variant: "destructive",
      });
    }
  }

  if (!authLoading && !isAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          You need an admin account to manage classroom users and progress.
        </p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 text-primary">
            <Shield className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em]">
              Admin
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Classroom</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage student accounts and track hotel + POS practice progress.
            Deactivated users cannot log in.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email…"
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><SelectItemText>All statuses</SelectItemText></SelectItem>
                <SelectItem value="active"><SelectItemText>Active</SelectItemText></SelectItem>
                <SelectItem value="inactive"><SelectItemText>Inactive</SelectItemText></SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><SelectItemText>All roles</SelectItemText></SelectItem>
                <SelectItem value="admin"><SelectItemText>Admin</SelectItemText></SelectItem>
                <SelectItem value="staff"><SelectItemText>Staff</SelectItemText></SelectItem>
              </SelectContent>
            </Select>
            <Select value={tourFilter} onValueChange={(v) => setTourFilter(v as TourFilter)}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Tour" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all"><SelectItemText>All tours</SelectItemText></SelectItem>
                <SelectItem value="done"><SelectItemText>Tour done</SelectItemText></SelectItem>
                <SelectItem value="pending"><SelectItemText>Tour pending</SelectItemText></SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={`${sortKey}:${sortDir}`}
              onValueChange={(v) => {
                const [key, dir] = v.split(":") as [SortKey, SortDir];
                setSortKey(key);
                setSortDir(dir);
              }}
            >
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name:asc"><SelectItemText>Name A–Z</SelectItemText></SelectItem>
                <SelectItem value="name:desc"><SelectItemText>Name Z–A</SelectItemText></SelectItem>
                <SelectItem value="status:asc"><SelectItemText>Active first</SelectItemText></SelectItem>
                <SelectItem value="status:desc"><SelectItemText>Inactive first</SelectItemText></SelectItem>
                <SelectItem value="tour:asc"><SelectItemText>Tour done first</SelectItemText></SelectItem>
                <SelectItem value="activity:asc"><SelectItemText>Most activity</SelectItemText></SelectItem>
              </SelectContent>
            </Select>
            {filtersActive ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setRoleFilter("all");
                  setTourFilter("all");
                  setActivityFilter("all");
                }}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {isLoading ? "Loading…" : `Showing ${students.length} of ${totals.users}`}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border px-4 py-4",
          isShared
            ? "border-teal-500/30 bg-teal-500/5"
            : "border-primary/25 bg-primary/5",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                isShared ? "bg-teal-500/15 text-teal-600" : "bg-primary/15 text-primary",
              )}
            >
              {isShared ? (
                <Building2 className="h-5 w-5" />
              ) : (
                <GraduationCap className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">System mode</h2>
                <Badge variant={isShared ? "default" : "secondary"}>
                  {modeLoading ? "…" : isShared ? "Real system" : "Lab activity"}
                </Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {isShared
                  ? "Everyone shares one hotel. Bookings, guests, payments, and POS activity are visible to all staff."
                  : "Each student has private progress (bookings, guests, payments, POS). Rooms and menus created by admins are visible to students."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2">
            <span className={cn("text-xs font-medium", !isShared && "text-foreground")}>
              Lab
            </span>
            <Switch
              checked={isShared}
              disabled={busy || modeLoading}
              onCheckedChange={(checked) => void toggleMode(checked)}
              aria-label="Toggle real system mode"
            />
            <span className={cn("text-xs font-medium", isShared && "text-foreground")}>
              Real
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            {
              label: "Students",
              value: totals.users,
              active:
                statusFilter === "all" &&
                tourFilter === "all" &&
                activityFilter === "all",
              onClick: () => {
                setStatusFilter("all");
                setTourFilter("all");
                setActivityFilter("all");
              },
            },
            {
              label: "Active",
              value: totals.active,
              active: statusFilter === "active",
              onClick: () =>
                setStatusFilter((prev) => (prev === "active" ? "all" : "active")),
            },
            {
              label: "Tour pending",
              value: totals.onboardingPending,
              active: tourFilter === "pending",
              onClick: () =>
                setTourFilter((prev) => (prev === "pending" ? "all" : "pending")),
            },
            {
              label: "With activity",
              value: totals.withActivity,
              active: activityFilter === "with",
              onClick: () =>
                setActivityFilter((prev) => (prev === "with" ? "all" : "with")),
            },
          ] as const
        ).map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={card.onClick}
            className={cn(
              "rounded-xl border bg-card px-4 py-3 text-left transition-colors",
              card.active
                ? "border-primary/60 ring-1 ring-primary/30"
                : "border-border/80 hover:border-border",
            )}
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {isLoading ? "—" : card.value}
            </p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {selected.size > 0
            ? `${selected.size} selected`
            : "Select rows for bulk quick actions"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || selected.size === 0}
            onClick={() => void runBulk("activate")}
          >
            <Power className="h-3.5 w-3.5" />
            Activate
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || selected.size === 0}
            onClick={() => void runBulk("deactivate")}
          >
            <PowerOff className="h-3.5 w-3.5" />
            Deactivate
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || selected.size === 0}
            onClick={() => void runBulk("tour")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Mark tour done
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy || selected.size === 0}
            onClick={() => void runBulk("delete")}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Could not load classroom data. Run{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-foreground">
            004_onboarding_admin.sql
          </code>{" "}
          in Supabase, then refresh.
          {error instanceof Error ? ` (${error.message})` : null}
        </div>
      )}

      <ScrollableTablePane offsetRem={16} minVh={28}>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allSelected ? true : someSelected ? "indeterminate" : false
                    }
                    onCheckedChange={(v) => toggleSelectAll(v === true)}
                    aria-label="Select all"
                    disabled={selectableIds.length === 0}
                  />
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort("name")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Student
                    {sortKey === "name" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                    ) : null}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort("role")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Role
                    {sortKey === "role" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                    ) : null}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort("status")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Status
                    {sortKey === "status" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                    ) : null}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort("tour")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Tour
                    {sortKey === "tour" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                    ) : null}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => handleSort("activity")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Progress
                    {sortKey === "activity" ? (
                      sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                    ) : null}
                  </button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No students match this search or filter.
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    selected={selected.has(student.id)}
                    selectable={student.id !== user?.id}
                    onSelect={(checked) => {
                      if (student.id === user?.id) return;
                      toggleSelect(student.id, checked);
                    }}
                    busy={busy}
                    onActivate={() =>
                      void patchOne(student.id, { isActive: true }, "Student activated")
                    }
                    onDeactivate={() =>
                      void patchOne(
                        student.id,
                        { isActive: false },
                        "Student deactivated — cannot log in",
                      )
                    }
                    onMarkTourDone={() =>
                      void patchOne(
                        student.id,
                        { onboardingCompleted: true },
                        "Tour marked complete",
                      )
                    }
                    onDelete={() => {
                      if (student.id === user?.id) {
                        toast({
                          title: "Cannot delete yourself",
                          variant: "destructive",
                        });
                        return;
                      }
                      const ok = window.confirm(
                        `Delete ${student.fullName || student.email}? This cannot be undone.`,
                      );
                      if (!ok) return;
                      void deleteStudents
                        .mutateAsync([student.id])
                        .then((result) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            next.delete(student.id);
                            return next;
                          });
                          toast({
                            title: `Deleted ${result.deleted ?? 0} account(s)`,
                          });
                        })
                        .catch((err: unknown) => {
                          toast({
                            title: "Delete failed",
                            description:
                              err instanceof Error ? err.message : "Try again.",
                            variant: "destructive",
                          });
                        });
                    }}
                  />
                ))
              )}
            </TableBody>
          </Table>
        )}
      </ScrollableTablePane>
    </div>
  );
}
