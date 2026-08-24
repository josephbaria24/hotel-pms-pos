"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { 
  useListUsers, 
  useCreateUser, 
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
import { Plus, Edit2, Trash2, Key, Eye, EyeOff } from "lucide-react";
import { ScrollableTablePane } from "@/components/layout/ScrollableTablePane";

interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isActive?: boolean;
  password?: string;
  email?: string | null;
}

export default function Users() {
  const router = useRouter();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const { data: users, isLoading, isError, error, refetch } = useListUsers();
  const createUserMutation = useCreateUser();
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

  // Password visibility map
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Users</h1>
          <p className="text-muted-foreground">
            Edit staff profile details. Classroom progress lives under Admin.
          </p>
        </div>
        <Button type="button" onClick={handleOpenAdd} className="shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <ScrollableTablePane offsetRem={16} minVh={28}>
        <Table>
          <TableHeader className="sticky top-0 z-[1] bg-card shadow-sm">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Password</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
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
            ) : (
              users.map((user: User) => {
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
    </div>
  );
}
