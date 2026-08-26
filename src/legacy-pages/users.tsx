"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { 
  useListUsers, 
  useCreateUser,
  useBulkCreateUsers,
  useUpdateUser, 
  useDeleteUser,
  getListUsersQueryKey
} from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  ArrowDown,
  ArrowUp,
  ClipboardPaste,
  Edit2,
  Eye,
  EyeOff,
  Key,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ScrollableTablePane } from "@/components/layout/ScrollableTablePane";
import { parseBulkUserPaste } from "@/lib/bulk-users";

interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isActive?: boolean;
  password?: string;
  email?: string | null;
}

type StatusFilter = "all" | "active" | "inactive";
type RoleFilter = "all" | "admin" | "staff";
type SortKey = "name" | "email" | "username" | "role" | "status";
type SortDir = "asc" | "desc";

function isUserActive(user: User) {
  return user.isActive !== false;
}

function compareUsers(a: User, b: User, key: SortKey) {
  switch (key) {
    case "email":
      return (a.email || "").localeCompare(b.email || "", undefined, { sensitivity: "base" });
    case "username":
      return (a.username || "").localeCompare(b.username || "", undefined, { sensitivity: "base" });
    case "role":
      return (a.role || "").localeCompare(b.role || "", undefined, { sensitivity: "base" });
    case "status":
      return Number(isUserActive(b)) - Number(isUserActive(a));
    case "name":
    default:
      return (a.fullName || a.username || "").localeCompare(
        b.fullName || b.username || "",
        undefined,
        { sensitivity: "base" },
      );
  }
}

export default function Users() {
  const router = useRouter();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const { data: users, isLoading, isError, error, refetch } = useListUsers();
  const createUserMutation = useCreateUser();
  const bulkCreateUsers = useBulkCreateUsers();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"add" | "edit">("add");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("staff");
  const [isActive, setIsActive] = useState(true);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPaste, setBulkPaste] = useState("");
  const [samePassword, setSamePassword] = useState(true);
  const [bulkPassword, setBulkPassword] = useState("");
  const [bulkRole, setBulkRole] = useState("staff");

  // Password visibility map
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const counts = useMemo(() => {
    const list = users ?? [];
    return {
      total: list.length,
      active: list.filter(isUserActive).length,
      inactive: list.filter((u) => !isUserActive(u)).length,
      admin: list.filter((u) => u.role === "admin").length,
      staff: list.filter((u) => u.role === "staff").length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const list = users ?? [];
    const q = query.trim().toLowerCase();
    const next = list.filter((user) => {
      const active = isUserActive(user);
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && active) return false;
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!q) return true;
      const hay = `${user.fullName} ${user.username} ${user.email ?? ""} ${user.role}`.toLowerCase();
      return hay.includes(q);
    });
    next.sort((a, b) => {
      const cmp = compareUsers(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return next;
  }, [users, query, statusFilter, roleFilter, sortKey, sortDir]);

  const filtersActive =
    query.trim() !== "" || statusFilter !== "all" || roleFilter !== "all";

  const bulkPreview = useMemo(
    () => parseBulkUserPaste(bulkPaste, { samePassword, password: bulkPassword }),
    [bulkPaste, samePassword, bulkPassword],
  );

  function handleOpenBulk() {
    setBulkPaste("");
    setSamePassword(true);
    setBulkPassword("");
    setBulkRole("staff");
    setBulkOpen(true);
  }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (bulkPreview.entries.length === 0) {
      toast({
        title: "Nothing to add",
        description:
          bulkPreview.errors[0] ||
          (samePassword
            ? "Paste emails and enter a password (at least 6 characters)."
            : "Put one email and password per line, like maria@gmail.com, pms123."),
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await bulkCreateUsers.mutateAsync({
        paste: bulkPaste,
        samePassword,
        password: bulkPassword,
        role: bulkRole,
        isActive: true,
      });
      const failNote =
        result.failures.length > 0
          ? result.failures
              .slice(0, 4)
              .map((f) => (f.email ? `${f.email}: ${f.message}` : f.message))
              .join(" · ")
          : undefined;
      toast({
        title: `Added ${result.created} user${result.created === 1 ? "" : "s"}`,
        description:
          result.failed > 0
            ? `${result.failed} failed. ${failNote ?? ""}`
            : `${result.created} staff login${result.created === 1 ? "" : "s"} created.`,
        variant: result.created === 0 ? "destructive" : "default",
      });
      if (result.created > 0) setBulkOpen(false);
    } catch (err: unknown) {
      toast({
        title: "Bulk add failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  }

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir("asc");
  }

  function SortButton({ column, children }: { column: SortKey; children: string }) {
    const active = sortKey === column;
    return (
      <button
        type="button"
        onClick={() => handleSort(column)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-0 py-0 text-left font-medium transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {children}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : null}
      </button>
    );
  }

  const handleOpenAdd = () => {
    setDialogType("add");
    setSelectedUserId(null);
    setFullName("");
    setEmail("");
    setUsername("");
    setPassword("");
    setRole("staff");
    setIsActive(true);
    setIsOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setDialogType("edit");
    setSelectedUserId(user.id);
    setFullName(user.fullName || "");
    setEmail(user.email || "");
    setUsername(user.username || "");
    setPassword(user.password || "");
    setRole(user.role || "staff");
    setIsActive(user.isActive !== false);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailValue = email.trim().toLowerCase();
    if (!fullName.trim() || !emailValue || !password.trim()) {
      toast({
        title: "Validation error",
        description: "Full name, email, and password are required.",
        variant: "destructive",
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      toast({
        title: "Validation error",
        description: "Enter a valid email address. Staff sign in with email.",
        variant: "destructive",
      });
      return;
    }
    if (password.trim().length < 6) {
      toast({
        title: "Validation error",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (dialogType === "add") {
        await createUserMutation.mutateAsync({
          data: {
            fullName: fullName.trim(),
            username: username.trim() || emailValue.split("@")[0] || "",
            email: emailValue,
            password: password.trim(),
            role,
            isActive,
          },
        });
        toast({
          title: "User created successfully! 🎉",
          description: `Staff user ${fullName} has been added.`,
        });
      } else if (dialogType === "edit" && selectedUserId) {
        await updateUserMutation.mutateAsync({
          id: selectedUserId,
          data: {
            fullName: fullName.trim(),
            username: username.trim() || emailValue.split("@")[0] || "",
            email: emailValue,
            password: password.trim(),
            role,
            isActive,
          },
        });
        toast({
          title: "User updated successfully! ✨",
          description: `Staff user ${fullName} has been updated.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setIsOpen(false);
    } catch (err: any) {
      toast({
        title: "Action failed",
        description: err.message || "An error occurred while saving the user.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (user: User) => {
    if (user.role === "admin" && user.username === "admin") {
      toast({
        title: "Protection Active 🛡️",
        description: "The primary administrator account cannot be deleted.",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete ${user.fullName}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await deleteUserMutation.mutateAsync(user.id);
      toast({
        title: "User deleted",
        description: `${user.fullName} has been removed.`,
      });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message || "Could not delete user.",
        variant: "destructive",
      });
    }
  };

  if (!authLoading && !isAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Staff users</h1>
        <p className="text-sm text-muted-foreground">
          You need an admin account to manage staff logins.
        </p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Users</h1>
          <p className="text-muted-foreground">
            Edit staff profile details. Classroom progress lives under Admin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button type="button" variant="outline" onClick={handleOpenBulk}>
            <ClipboardPaste className="w-4 h-4 mr-2" />
            Bulk Add
          </Button>
          <Button type="button" onClick={handleOpenAdd} className="shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, or username…"
              className="h-9 pl-9 bg-background"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <SelectItemText>All statuses</SelectItemText>
                </SelectItem>
                <SelectItem value="active">
                  <SelectItemText>Active ({counts.active})</SelectItemText>
                </SelectItem>
                <SelectItem value="inactive">
                  <SelectItemText>Inactive ({counts.inactive})</SelectItemText>
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <SelectItemText>All roles</SelectItemText>
                </SelectItem>
                <SelectItem value="admin">
                  <SelectItemText>Admin ({counts.admin})</SelectItemText>
                </SelectItem>
                <SelectItem value="staff">
                  <SelectItemText>Staff ({counts.staff})</SelectItemText>
                </SelectItem>
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
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name:asc">
                  <SelectItemText>Name A–Z</SelectItemText>
                </SelectItem>
                <SelectItem value="name:desc">
                  <SelectItemText>Name Z–A</SelectItemText>
                </SelectItem>
                <SelectItem value="email:asc">
                  <SelectItemText>Email A–Z</SelectItemText>
                </SelectItem>
                <SelectItem value="role:asc">
                  <SelectItemText>Role</SelectItemText>
                </SelectItem>
                <SelectItem value="status:asc">
                  <SelectItemText>Active first</SelectItemText>
                </SelectItem>
                <SelectItem value="status:desc">
                  <SelectItemText>Inactive first</SelectItemText>
                </SelectItem>
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
                }}
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all" as const, label: "All", count: counts.total },
              { id: "active" as const, label: "Active", count: counts.active },
              { id: "inactive" as const, label: "Inactive", count: counts.inactive },
            ] as const
          ).map((chip) => {
            const selected = statusFilter === chip.id;
            return (
              <button
                key={`status-${chip.id}`}
                type="button"
                onClick={() => setStatusFilter(chip.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {chip.label}
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                    selected
                      ? "border-white/30 bg-white/20 text-white"
                      : chip.id === "active"
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : chip.id === "inactive"
                          ? "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300"
                          : "border-border",
                  )}
                >
                  {isLoading ? "—" : chip.count}
                </Badge>
              </button>
            );
          })}
          <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
          {(
            [
              { id: "all" as const, label: "All roles", count: counts.total },
              { id: "admin" as const, label: "Admin", count: counts.admin },
              { id: "staff" as const, label: "Staff", count: counts.staff },
            ] as const
          ).map((chip) => {
            const selected = roleFilter === chip.id;
            return (
              <button
                key={`role-${chip.id}`}
                type="button"
                onClick={() => setRoleFilter(chip.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {chip.label}
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                    selected
                      ? "border-white/30 bg-white/20 text-white"
                      : chip.id === "admin"
                        ? "border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300"
                        : chip.id === "staff"
                          ? "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300"
                          : "border-border",
                  )}
                >
                  {isLoading ? "—" : chip.count}
                </Badge>
              </button>
            );
          })}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {isLoading
              ? "Loading…"
              : `Showing ${filteredUsers.length} of ${counts.total}`}
          </span>
        </div>
      </div>

      <ScrollableTablePane offsetRem={16} minVh={28}>
        <Table>
          <TableHeader className="sticky top-0 z-[1] bg-card shadow-sm">
            <TableRow>
              <TableHead>
                <SortButton column="name">Name</SortButton>
              </TableHead>
              <TableHead>
                <SortButton column="email">Email</SortButton>
              </TableHead>
              <TableHead>
                <SortButton column="username">Username</SortButton>
              </TableHead>
              <TableHead>Password</TableHead>
              <TableHead>
                <SortButton column="role">Role</SortButton>
              </TableHead>
              <TableHead>
                <SortButton column="status">Status</SortButton>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-[150px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[180px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[100px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[120px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[80px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-[80px]" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-[120px] ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-destructive">
                  Could not load staff users.{" "}
                  {error instanceof Error ? error.message : "Please try again."}{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void refetch()}
                  >
                    Retry
                  </button>
                </TableCell>
              </TableRow>
            ) : !users?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No staff users in the database yet.
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No users match this search or filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user: User) => {
                const active = user.isActive !== false;
                const isPasswordVisible = !!visiblePasswords[user.id];
                const initials = (user.fullName || user.username || "?").slice(0, 2);
                return (
                  <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-semibold text-foreground flex items-center gap-2 py-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                        {initials}
                      </div>
                      {user.fullName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.email || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono">{user.username}</TableCell>
                    <TableCell className="font-mono">
                      <div className="flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5 text-muted-foreground/60" />
                        <span className="bg-muted/60 px-1.5 py-0.5 rounded text-[11px] font-semibold tracking-wider">
                          {isPasswordVisible
                            ? user.password || "Not stored — re-run seed"
                            : "••••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(user.id)}
                          className="text-muted-foreground hover:text-foreground focus:outline-none ml-1 p-0.5 rounded hover:bg-muted cursor-pointer"
                          title={isPasswordVisible ? "Hide Password" : "Show Password"}
                        >
                          {isPasswordVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.role === "admin" ? "default" : "secondary"} 
                        className={cn(
                          "uppercase text-[9px] tracking-wider font-bold px-2 py-0.5",
                          user.role === "admin" && "bg-primary text-primary-foreground"
                        )}
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={active ? "outline" : "destructive"} className="text-[10px]">
                        {active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          type="button" 
                          onClick={() => handleOpenEdit(user)}
                          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          type="button" 
                          onClick={() => handleDelete(user)}
                          className="h-8 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </ScrollableTablePane>

      {/* Add / Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                {dialogType === "add" ? (
                  <>
                    <Plus className="w-5 h-5 text-primary" />
                    Add Staff User
                  </>
                ) : (
                  <>
                    <Edit2 className="w-5 h-5 text-primary" />
                    Edit Staff User
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {dialogType === "add" 
                  ? "Staff sign in with this email and password on the login page."
                  : "Update login email, password, and role. Sign-in uses email, not username."
                }
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="fullName" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="e.g. Maria Santos"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-muted/30 focus-visible:ring-primary"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="off"
                  placeholder="e.g. maria.santos@gmail.com"
                  value={email}
                  onChange={(e) => {
                    const next = e.target.value;
                    setEmail(next);
                    if (dialogType === "add" && !username.trim()) {
                      const local = next.split("@")[0]?.replace(/[^a-zA-Z0-9._-]/g, "") ?? "";
                      setUsername(local);
                    }
                  }}
                  className="bg-muted/30 focus-visible:ring-primary"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="username" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Username</Label>
                <Input
                  id="username"
                  placeholder="Optional display name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-muted/30 focus-visible:ring-primary font-mono"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
                <Input
                  id="password"
                  placeholder="Enter access password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-muted/30 focus-visible:ring-primary font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="role" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Role</Label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="status" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
                  <select
                    id="status"
                    value={isActive ? "active" : "inactive"}
                    onChange={(e) => setIsActive(e.target.value === "active")}
                    className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                {createUserMutation.isPending || updateUserMutation.isPending 
                  ? "Saving..." 
                  : (dialogType === "add" ? "Create User" : "Save Changes")
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleBulkSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <ClipboardPaste className="w-5 h-5 text-primary" />
                Bulk Add Users
              </DialogTitle>
              <DialogDescription>
                Paste emails, then set a password. Names are filled from each email.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="bulkEmails" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Emails
                </Label>
                <Textarea
                  id="bulkEmails"
                  value={bulkPaste}
                  onChange={(e) => setBulkPaste(e.target.value)}
                  placeholder={
                    samePassword
                      ? "Paste emails, one per line or separated by commas:\nmaria@gmail.com\njuan@gmail.com"
                      : "One email and password per line:\nmaria@gmail.com, pms123\njuan@gmail.com, pms123"
                  }
                  className="min-h-[160px] bg-muted/30 font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                <div>
                  <Label htmlFor="samePassword" className="text-sm font-medium">
                    Same password for all
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {samePassword
                      ? "The password below is used for every email."
                      : "Put email, password on each line, or use the field below as a fallback."}
                  </p>
                </div>
                <Switch
                  id="samePassword"
                  checked={samePassword}
                  onCheckedChange={setSamePassword}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bulkPassword" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Password
                </Label>
                <Input
                  id="bulkPassword"
                  type="text"
                  autoComplete="off"
                  placeholder="At least 6 characters, e.g. pms123"
                  value={bulkPassword}
                  onChange={(e) => setBulkPassword(e.target.value)}
                  className="bg-muted/30 font-mono"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bulkRole" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Role
                </Label>
                <select
                  id="bulkRole"
                  value={bulkRole}
                  onChange={(e) => setBulkRole(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <p className="text-xs text-muted-foreground tabular-nums">
                {bulkPreview.entries.length} email{bulkPreview.entries.length === 1 ? "" : "s"} ready
                {bulkPreview.errors.length > 0
                  ? ` · ${bulkPreview.errors.length} issue${bulkPreview.errors.length === 1 ? "" : "s"}`
                  : ""}
              </p>
              {bulkPreview.errors.length > 0 ? (
                <ul className="max-h-24 overflow-y-auto rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {bulkPreview.errors.slice(0, 8).map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={bulkCreateUsers.isPending || bulkPreview.entries.length === 0}>
                {bulkCreateUsers.isPending
                  ? "Adding…"
                  : bulkPreview.entries.length === 0
                    ? "Add users"
                    : `Add ${bulkPreview.entries.length} user${bulkPreview.entries.length === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
