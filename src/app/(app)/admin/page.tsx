"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAdminBulkUpdateStudents,
  useAdminClassroom,
  useAdminDeleteStudents,
  useAdminProgressSnapshots,
  useAdminResetProgress,
  useAdminRestoreProgress,
  useAdminUpdateStudent,
  useBulkCreateUsers,
  useOperationMode,
  useSetOperationMode,
  type ClassroomUser,
  type OperationMode,
  type ProgressSnapshot,
} from "@/lib/api-client";
import { useAuth } from "@/components/auth/AuthProvider";
import { ScrollableTablePane } from "@/components/layout/ScrollableTablePane";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ACTIVATION_DURATION_UNITS,
  computeActivationExpiresAt,
  formatActivationExpiry,
  type ActivationDurationUnit,
} from "@/lib/activation-expiry";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  ClipboardPaste,
  GraduationCap,
  History,
  Power,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  Undo2,
  UserPlus,
  X,
} from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Common domains people paste without "@" (e.g. namegmail.com → name@gmail.com). */
const MISSING_AT_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "msn.com",
];

function stripListPrefix(token: string) {
  // "16.email@…" or "16)email@…" or "16-email@…"
  return token.replace(/^\d+[.)\-:]*/, "");
}

/** Fix missing @ before a known domain: angel…gmail.com → angel…@gmail.com */
function healMissingAt(token: string): string | null {
  if (token.includes("@")) return null;
  for (const domain of MISSING_AT_DOMAINS) {
    if (token.endsWith(domain) && token.length > domain.length) {
      const local = token.slice(0, -domain.length);
      if (/^[a-z0-9._+-]+$/i.test(local)) return `${local}@${domain}`;
    }
  }
  return null;
}

type ParsedPasteEmails = {
  emails: string[];
  /** Original → healed (missing @ fixed) */
  healed: { from: string; to: string }[];
  /** Tokens that looked like emails but were invalid */
  skipped: string[];
};

/** Split pasted text into unique lowercased emails (comma / space / newline / ;). */
function parsePastedEmails(raw: string): ParsedPasteEmails {
  const parts = raw
    .split(/[\s,;]+/g)
    .map((p) => stripListPrefix(p.trim().toLowerCase()))
    .filter(Boolean)
    // drop pure list numbers like "16."
    .filter((p) => !/^\d+$/.test(p));

  const emails: string[] = [];
  const healed: { from: string; to: string }[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    let email = part;
    if (!EMAIL_RE.test(email)) {
      const fixed = healMissingAt(part);
      if (fixed && EMAIL_RE.test(fixed)) {
        healed.push({ from: part, to: fixed });
        email = fixed;
      } else if (part.includes("@") || /gmail|yahoo|outlook|hotmail|\.com$/i.test(part)) {
        skipped.push(part);
        continue;
      } else {
        continue;
      }
    }
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }

  return { emails, healed, skipped };
}

function hasPracticeActivity(s: ClassroomUser) {
  return s.reservationsCount > 0 || s.paymentsCount > 0 || s.posOrdersCount > 0;
}

function formatSnapshotWhen(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function snapshotTotals(snap: ProgressSnapshot) {
  const perUser = Array.isArray(snap.summary.per_user) ? snap.summary.per_user : [];
  let guests = 0;
  let reservations = 0;
  let payments = 0;
  let posOrders = 0;
  for (const row of perUser) {
    guests += Number(row.guests ?? 0);
    reservations += Number(row.reservations ?? 0);
    payments += Number(row.payments ?? 0);
    posOrders += Number(row.pos_orders ?? 0);
  }
  return { guests, reservations, payments, posOrders };
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
        <div className="flex flex-col gap-0.5">
          <Badge variant={student.isActive ? "outline" : "destructive"}>
            {student.isActive ? "Active" : "Inactive"}
          </Badge>
          {student.isActive && student.activationExpiresAt ? (
            <span className="text-[10px] text-muted-foreground">
              Until {formatActivationExpiry(student.activationExpiresAt)}
            </span>
          ) : null}
        </div>
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
  const resetProgress = useAdminResetProgress();
  const restoreProgress = useAdminRestoreProgress();
  const bulkCreateUsers = useBulkCreateUsers();
  const {
    data: progressHistory,
    isLoading: historyLoading,
    isError: historyError,
    error: historyErr,
    refetch: refetchHistory,
  } = useAdminProgressSnapshots();
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
  const [pasteEmailsOpen, setPasteEmailsOpen] = useState(false);
  const [pasteEmailsRaw, setPasteEmailsRaw] = useState("");
  const [createMissingPassword, setCreateMissingPassword] = useState("");
  const [createMissingActive, setCreateMissingActive] = useState(true);
  const [activateDialog, setActivateDialog] = useState<{
    ids: string[];
    label: string;
  } | null>(null);
  const [activateLimitEnabled, setActivateLimitEnabled] = useState(false);
  const [activateAmount, setActivateAmount] = useState("1");
  const [activateUnit, setActivateUnit] =
    useState<ActivationDurationUnit>("days");

  const isAdmin = user?.role === "admin";
  const busy =
    updateStudent.isPending ||
    bulkUpdate.isPending ||
    deleteStudents.isPending ||
    setOperationMode.isPending ||
    resetProgress.isPending ||
    restoreProgress.isPending ||
    bulkCreateUsers.isPending;

  const parsedPaste = useMemo(
    () => parsePastedEmails(pasteEmailsRaw),
    [pasteEmailsRaw],
  );
  const parsedEmails = parsedPaste.emails;

  const pasteMatch = useMemo(() => {
    const list = data ?? [];
    const byEmail = new Map<string, ClassroomUser>();
    for (const s of list) {
      const email = (s.email ?? "").trim().toLowerCase();
      if (email) byEmail.set(email, s);
    }
    const matched: ClassroomUser[] = [];
    const unmatched: string[] = [];
    const seenIds = new Set<string>();
    for (const email of parsedEmails) {
      const hit = byEmail.get(email);
      if (hit) {
        if (!seenIds.has(hit.id)) {
          seenIds.add(hit.id);
          matched.push(hit);
        }
      } else {
        unmatched.push(email);
      }
    }
    const actionableIds = matched
      .map((s) => s.id)
      .filter((id) => id !== user?.id);
    return { matched, unmatched, actionableIds };
  }, [data, parsedEmails, user?.id]);
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
    data: {
      isActive?: boolean;
      onboardingCompleted?: boolean;
      activationExpiresAt?: string | null;
    },
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

  function openActivateDialog(ids: string[], label: string) {
    const cleaned = ids.filter((id) => id !== user?.id);
    if (cleaned.length === 0) {
      toast({
        title: "Nothing to activate",
        description: "No accounts available for this action.",
        variant: "destructive",
      });
      return;
    }
    setActivateLimitEnabled(false);
    setActivateAmount("1");
    setActivateUnit("days");
    setActivateDialog({ ids: cleaned, label });
  }

  async function confirmActivate() {
    if (!activateDialog) return;
    const { ids } = activateDialog;
    let activationExpiresAt: string | null = null;
    if (activateLimitEnabled) {
      const expires = computeActivationExpiresAt({
        amount: Number(activateAmount),
        unit: activateUnit,
      });
      if (!expires) {
        toast({
          title: "Invalid duration",
          description: "Enter a whole number of 1 or more.",
          variant: "destructive",
        });
        return;
      }
      activationExpiresAt = expires.toISOString();
    }

    try {
      if (ids.length === 1) {
        await updateStudent.mutateAsync({
          id: ids[0],
          isActive: true,
          activationExpiresAt,
        });
      } else {
        await bulkUpdate.mutateAsync({
          ids,
          isActive: true,
          activationExpiresAt,
        });
      }
      setActivateDialog(null);
      clearSelection();
      toast({
        title: `Activated ${ids.length} account(s)`,
        description: activationExpiresAt
          ? `Expires ${formatActivationExpiry(activationExpiresAt)}`
          : "No expiration set",
      });
    } catch (err) {
      toast({
        title: "Activate failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  }

  async function runBulk(
    action: "activate" | "deactivate" | "tour" | "delete",
    idOverride?: string[],
  ) {
    const ids = (idOverride ?? [...selected]).filter((id) => id !== user?.id);
    if (ids.length === 0) {
      toast({
        title: "Nothing selected",
        description: idOverride
          ? "No matched accounts available for this action."
          : "Select one or more students first.",
        variant: "destructive",
      });
      return;
    }

    if (action === "activate") {
      openActivateDialog(
        ids,
        ids.length === 1
          ? "Activate account"
          : `Activate ${ids.length} accounts`,
      );
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

      if (action === "deactivate") {
        await bulkUpdate.mutateAsync({
          ids,
          isActive: false,
          activationExpiresAt: null,
        });
        toast({
          title: `Deactivated ${ids.length} account(s)`,
          description: "They cannot log in until activated again.",
        });
      } else {
        await bulkUpdate.mutateAsync({ ids, onboardingCompleted: true });
        toast({ title: `Marked tour done for ${ids.length} student(s)` });
      }
      if (!idOverride) clearSelection();
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  }

  function selectMatchedInTable() {
    const ids = pasteMatch.actionableIds;
    if (ids.length === 0) {
      toast({
        title: "No matched accounts",
        description: "Capture emails first, or none of them are in the classroom list.",
        variant: "destructive",
      });
      return;
    }
    setSelected(new Set(ids));
    setPasteEmailsOpen(false);
    toast({
      title: `Selected ${ids.length} account${ids.length === 1 ? "" : "s"}`,
      description: "Use the bulk action bar on the classroom table.",
    });
  }

  async function createMissingAccounts() {
    const emails = pasteMatch.unmatched;
    if (emails.length === 0) {
      toast({
        title: "Nothing to create",
        description: "All pasted emails already match classroom accounts.",
        variant: "destructive",
      });
      return;
    }
    const password = createMissingPassword.trim();
    if (password.length < 6) {
      toast({
        title: "Password required",
        description: "Set a password of at least 6 characters for the new accounts.",
        variant: "destructive",
      });
      return;
    }
    const ok = window.confirm(
      `Create ${emails.length} staff account${emails.length === 1 ? "" : "s"} with the same password?\n\n` +
        emails.slice(0, 8).join("\n") +
        (emails.length > 8 ? `\n…and ${emails.length - 8} more` : ""),
    );
    if (!ok) return;

    try {
      const result = await bulkCreateUsers.mutateAsync({
        paste: emails.join("\n"),
        samePassword: true,
        password,
        role: "staff",
        isActive: createMissingActive,
      });
      await refetch();
      toast({
        title: `Created ${result.created} account${result.created === 1 ? "" : "s"}`,
        description:
          result.failed > 0
            ? `${result.failed} failed — ${result.failures
                .slice(0, 2)
                .map((f) => f.message)
                .join("; ")}`
            : "They now appear under Matched. You can activate/deactivate from here.",
      });
      if (result.created > 0) setCreateMissingPassword("");
    } catch (err) {
      toast({
        title: "Could not create accounts",
        description:
          err instanceof Error
            ? err.message
            : "Check SUPABASE_SERVICE_ROLE_KEY is set for the app.",
        variant: "destructive",
      });
    }
  }

  async function runResetProgress(
    scope: "selected" | "all_staff",
    idOverride?: string[],
  ) {
    const ids =
      idOverride?.filter((id) => id !== user?.id) ??
      (scope === "selected"
        ? [...selected].filter((id) => id !== user?.id)
        : (data ?? []).filter((s) => s.role === "staff").map((s) => s.id));

    if (ids.length === 0) {
      toast({
        title:
          scope === "selected" || idOverride
            ? "Nothing selected"
            : "No staff accounts",
        description:
          scope === "selected" || idOverride
            ? "Select or match one or more students first."
            : "There are no staff/student accounts to reset.",
        variant: "destructive",
      });
      return;
    }

    const label = idOverride
      ? `${ids.length} matched account${ids.length === 1 ? "" : "s"}`
      : scope === "selected"
        ? `${ids.length} selected account${ids.length === 1 ? "" : "s"}`
        : `all ${ids.length} staff/student account${ids.length === 1 ? "" : "s"}`;

    const ok = window.confirm(
      `Reset PMS + POS practice progress for ${label}?\n\n` +
        "Guests, reservations, payments, POS orders, and activity will be erased. " +
        "Accounts, rooms, and menus stay. Tour status will be reset.\n\n" +
        "A history snapshot is saved so you can restore later.",
    );
    if (!ok) return;

    try {
      const result = await resetProgress.mutateAsync({
        userIds: ids,
        resetTour: true,
        note: idOverride
          ? `Reset pasted emails (${ids.length})`
          : scope === "selected"
            ? `Reset selected (${ids.length})`
            : `Reset all staff (${ids.length})`,
      });
      if (!idOverride) clearSelection();
      toast({
        title: `Progress reset for ${result.users_reset ?? ids.length} account(s)`,
        description: "Saved to Progress history — you can restore anytime.",
      });
    } catch (err) {
      toast({
        title: "Reset failed",
        description:
          err instanceof Error
            ? err.message
            : "Run 013_admin_progress_reset.sql in Supabase, then try again.",
        variant: "destructive",
      });
    }
  }

  async function runRestoreSnapshot(snap: ProgressSnapshot) {
    if (snap.action !== "reset") {
      toast({
        title: "Cannot restore this entry",
        description: "Only reset snapshots can be restored.",
        variant: "destructive",
      });
      return;
    }

    const ok = window.confirm(
      `Restore progress from ${formatSnapshotWhen(snap.createdAt)}?\n\n` +
        `This replaces current PMS/POS practice data for ${snap.userCount} account(s). ` +
        "Current progress is backed up in history first.",
    );
    if (!ok) return;

    try {
      const result = await restoreProgress.mutateAsync({
        snapshotId: snap.id,
        note: `Restore ${snap.id.slice(0, 8)}`,
      });
      toast({
        title: `Restored ${result.restored_users ?? snap.userCount} account(s)`,
        description: "Current progress was backed up in history.",
      });
    } catch (err) {
      toast({
        title: "Restore failed",
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
            disabled={busy}
            onClick={() => setPasteEmailsOpen(true)}
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Paste emails
          </Button>
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
            variant="outline"
            className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
            disabled={busy || selected.size === 0}
            onClick={() => void runResetProgress("selected")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset progress
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
            disabled={busy}
            onClick={() => void runResetProgress("all_staff")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset all staff
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
                      openActivateDialog(
                        [student.id],
                        `Activate ${student.fullName || student.email || "account"}`,
                      )
                    }
                    onDeactivate={() =>
                      void patchOne(
                        student.id,
                        { isActive: false, activationExpiresAt: null },
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

      <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Progress history</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Each reset is logged here. Restore brings back PMS and POS practice
                data (guests, reservations, payments, orders). Accounts and catalogs
                are never deleted by reset.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void refetchHistory()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh history
          </Button>
        </div>

        {historyError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Could not load progress history. Run{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">
              013_admin_progress_reset.sql
            </code>{" "}
            in Supabase, then refresh.
            {historyErr instanceof Error ? ` (${historyErr.message})` : null}
          </div>
        ) : null}

        {historyLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (progressHistory ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No resets yet. Use Reset progress or Reset all staff to create a
            restorable snapshot.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead>Cleared</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(progressHistory ?? []).map((snap) => {
                  const totals = snapshotTotals(snap);
                  const isReset = snap.action === "reset";
                  return (
                    <TableRow key={snap.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span>{formatSnapshotWhen(snap.createdAt)}</span>
                          <span className="text-xs text-muted-foreground">
                            {snap.createdByName || "Admin"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isReset ? "secondary" : "outline"}>
                          {isReset ? "Reset" : "Pre-restore backup"}
                        </Badge>
                        {snap.restoredAt ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Restored {formatSnapshotWhen(snap.restoredAt)}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {snap.userCount}
                      </TableCell>
                      <TableCell>
                        {isReset ? (
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{totals.guests} guests</span>
                            <span>{totals.reservations} res</span>
                            <span>{totals.payments} pay</span>
                            <span>{totals.posOrders} POS</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate text-sm text-muted-foreground">
                        {snap.note || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {isReset ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void runRestoreSnapshot(snap)}
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            Restore
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Backup</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog
        open={activateDialog != null}
        onOpenChange={(open) => {
          if (!open) setActivateDialog(null);
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>{activateDialog?.label ?? "Activate"}</DialogTitle>
            <DialogDescription>
              Optionally limit how long these accounts stay active. Leave unlimited
              if they should remain active until you deactivate them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={activateLimitEnabled}
                onCheckedChange={(v) => setActivateLimitEnabled(v === true)}
                className="mt-0.5"
              />
              <span>
                Set activation expiration
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  After this period they cannot log in until activated again.
                </span>
              </span>
            </label>

            {activateLimitEnabled ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="activate-amount" className="text-xs">
                    Duration
                  </Label>
                  <Input
                    id="activate-amount"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={activateAmount}
                    onChange={(e) => setActivateAmount(e.target.value)}
                    className="h-9 w-24"
                  />
                </div>
                <div className="min-w-[8.5rem] flex-1 space-y-1.5">
                  <Label className="text-xs">Unit</Label>
                  <Select
                    value={activateUnit}
                    onValueChange={(v) =>
                      setActivateUnit(v as ActivationDurationUnit)
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVATION_DURATION_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          <SelectItemText>{u.label}</SelectItemText>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            {activateLimitEnabled ? (
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const expires = computeActivationExpiresAt({
                    amount: Number(activateAmount),
                    unit: activateUnit,
                  });
                  return expires
                    ? `Expires around ${formatActivationExpiry(expires.toISOString())}`
                    : "Enter a whole number of 1 or more.";
                })()}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setActivateDialog(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void confirmActivate()}
            >
              <Power className="h-3.5 w-3.5" />
              Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pasteEmailsOpen} onOpenChange={setPasteEmailsOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Paste emails</DialogTitle>
            <DialogDescription>
              Paste a list of student emails (commas, spaces, or new lines). Matches
              update as you paste — then activate, deactivate, or other bulk actions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              value={pasteEmailsRaw}
              onChange={(e) => setPasteEmailsRaw(e.target.value)}
              placeholder={
                "student1@school.edu\nstudent2@school.edu, student3@school.edu"
              }
              className="min-h-[140px] font-mono text-xs"
              autoFocus
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {pasteEmailsRaw.trim()
                  ? parsedEmails.length > 0
                    ? `${parsedEmails.length} email${parsedEmails.length === 1 ? "" : "s"} detected · updates as you paste`
                    : "No valid emails detected yet — keep pasting or typing"
                  : "Paste a list — emails are detected automatically"}
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!pasteEmailsRaw}
                onClick={() => setPasteEmailsRaw("")}
              >
                Clear
              </Button>
            </div>

            {parsedPaste.healed.length > 0 || parsedPaste.skipped.length > 0 ? (
              <div className="space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
                {parsedPaste.healed.map((h) => (
                  <p key={h.from} className="text-amber-800 dark:text-amber-200">
                    Fixed missing @:{" "}
                    <span className="font-mono">{h.from}</span>
                    {" → "}
                    <span className="font-mono font-medium">{h.to}</span>
                  </p>
                ))}
                {parsedPaste.skipped.map((s) => (
                  <p key={s} className="text-destructive">
                    Skipped (invalid email):{" "}
                    <span className="font-mono">{s}</span>
                  </p>
                ))}
              </div>
            ) : null}

            {parsedEmails.length > 0 ? (
              <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">
                    {parsedEmails.length} captured
                  </Badge>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                    {pasteMatch.matched.length} matched
                  </Badge>
                  {pasteMatch.unmatched.length > 0 ? (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                      {pasteMatch.unmatched.length} not found
                    </Badge>
                  ) : null}
                  {parsedPaste.skipped.length > 0 ? (
                    <Badge variant="destructive">
                      {parsedPaste.skipped.length} invalid
                    </Badge>
                  ) : null}
                </div>

                {pasteMatch.matched.length > 0 ? (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/60 bg-background p-2 text-xs">
                    {pasteMatch.matched.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-2 border-b border-border/40 py-1 last:border-0"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{s.fullName || "—"}</div>
                          <div className="truncate text-muted-foreground">
                            {s.email || s.username}
                          </div>
                        </div>
                        <Badge
                          variant={s.isActive ? "outline" : "destructive"}
                          className="shrink-0 text-[10px]"
                        >
                          {s.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No classroom accounts match these emails yet.
                  </p>
                )}

                {pasteMatch.unmatched.length > 0 ? (
                  <details className="text-xs" open>
                    <summary className="cursor-pointer font-medium text-foreground">
                      Not found ({pasteMatch.unmatched.length}) — create accounts
                    </summary>
                    <div className="mt-2 space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                      <ul className="max-h-28 list-inside list-disc overflow-y-auto font-mono text-muted-foreground">
                        {pasteMatch.unmatched.map((email) => (
                          <li key={email}>{email}</li>
                        ))}
                      </ul>
                      <div className="space-y-1.5">
                        <Label htmlFor="create-missing-password" className="text-xs">
                          Shared password for new accounts
                        </Label>
                        <Input
                          id="create-missing-password"
                          type="text"
                          autoComplete="off"
                          placeholder="Min. 6 characters"
                          value={createMissingPassword}
                          onChange={(e) => setCreateMissingPassword(e.target.value)}
                          className="h-9 font-mono text-xs"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Names/usernames are derived from each email. Role: staff.
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={createMissingActive}
                          onCheckedChange={(v) => setCreateMissingActive(v === true)}
                        />
                        Activate accounts after create (can log in)
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={
                          busy || createMissingPassword.trim().length < 6
                        }
                        onClick={() => void createMissingAccounts()}
                      >
                        {bulkCreateUsers.isPending ? (
                          <>Creating…</>
                        ) : (
                          <>
                            <UserPlus className="h-3.5 w-3.5" />
                            Create {pasteMatch.unmatched.length} account
                            {pasteMatch.unmatched.length === 1 ? "" : "s"}
                          </>
                        )}
                      </Button>
                    </div>
                  </details>
                ) : null}

                <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || pasteMatch.actionableIds.length === 0}
                    onClick={selectMatchedInTable}
                  >
                    Select in table
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || pasteMatch.actionableIds.length === 0}
                    onClick={() =>
                      void runBulk("activate", pasteMatch.actionableIds)
                    }
                  >
                    <Power className="h-3.5 w-3.5" />
                    Activate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || pasteMatch.actionableIds.length === 0}
                    onClick={() =>
                      void runBulk("deactivate", pasteMatch.actionableIds)
                    }
                  >
                    <PowerOff className="h-3.5 w-3.5" />
                    Deactivate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || pasteMatch.actionableIds.length === 0}
                    onClick={() => void runBulk("tour", pasteMatch.actionableIds)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Mark tour done
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                    disabled={busy || pasteMatch.actionableIds.length === 0}
                    onClick={() =>
                      void runResetProgress("selected", pasteMatch.actionableIds)
                    }
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset progress
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy || pasteMatch.actionableIds.length === 0}
                    onClick={() =>
                      void runBulk("delete", pasteMatch.actionableIds)
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPasteEmailsOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
