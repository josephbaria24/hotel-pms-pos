"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EllipsisVertical,
  LayoutGrid,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { PosPageShell } from "@/components/pos/PosPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import {
  useCreatePosTable,
  useDeletePosTable,
  usePosTables,
  useUpdatePosTable,
} from "@/lib/api-client/pos";
import type { PosTable, PosTableStatus } from "@/lib/api-client/pos-types";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  zone: string;
  seats: string;
  status: PosTableStatus;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  zone: "Dining",
  seats: "",
  status: "available",
  notes: "",
};

const STATUS_LABEL: Record<PosTableStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  dirty: "Dirty",
  inactive: "Inactive",
};

const STATUS_DOT: Record<PosTableStatus, string> = {
  available: "bg-emerald-500",
  occupied: "bg-orange-500",
  reserved: "bg-sky-500",
  dirty: "bg-rose-500",
  inactive: "bg-muted-foreground/50",
};

const STATUS_CARD: Record<PosTableStatus, string> = {
  available: "border-emerald-500/25 bg-emerald-500/[0.04]",
  occupied: "border-orange-500/30 bg-orange-500/[0.06]",
  reserved: "border-sky-500/30 bg-sky-500/[0.05]",
  dirty: "border-rose-500/30 bg-rose-500/[0.05]",
  inactive: "border-border/60 bg-muted/30 opacity-70",
};

export function PosTablesView() {
  const { data: tables = [], isLoading } = usePosTables();
  const createTable = useCreatePosTable();
  const updateTable = useUpdatePosTable();
  const deleteTable = useDeletePosTable();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PosTable | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleting, setDeleting] = useState<PosTable | null>(null);

  const zones = useMemo(() => {
    const map = new Map<string, PosTable[]>();
    for (const t of tables) {
      const list = map.get(t.zone) ?? [];
      list.push(t);
      map.set(t.zone, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tables]);

  const statusCounts = useMemo(() => {
    const counts: Record<PosTableStatus, number> = {
      available: 0,
      occupied: 0,
      reserved: 0,
      dirty: 0,
      inactive: 0,
    };
    for (const t of tables) counts[t.status] += 1;
    return counts;
  }, [tables]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (t: PosTable) => {
    setEditing(t);
    setForm({
      name: t.name,
      zone: t.zone,
      seats: String(t.seats),
      status: t.status,
      notes: t.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name,
      zone: form.zone.trim() || "Main",
      seats: Number(form.seats) || 4,
      status: form.status,
      notes: form.notes || null,
    };
    try {
      if (editing) {
        await updateTable.mutateAsync({ id: editing.id, ...payload });
        toast({ title: "Table updated" });
      } else {
        await createTable.mutateAsync(payload);
        toast({ title: "Table created" });
      }
      setOpen(false);
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const setStatus = async (table: PosTable, status: PosTableStatus) => {
    try {
      await updateTable.mutateAsync({ id: table.id, status });
      toast({ title: `${table.name} → ${STATUS_LABEL[status]}` });
    } catch (err) {
      toast({
        title: "Status update failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTable.mutateAsync(deleting.id);
      toast({ title: "Table deleted" });
      setDeleting(null);
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <PosPageShell
      title="Floor plan"
      description="Table / outlet layout for restaurant-style POS service."
      icon={LayoutGrid}
      action={
        <Button
          className="h-8 rounded-full bg-teal-600 px-3 text-xs hover:bg-teal-700 sm:h-9 sm:px-4 sm:text-sm"
          onClick={openCreate}
        >
          <Plus className="h-3.5 w-3.5 sm:mr-1.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Add table</span>
          <span className="sm:hidden">Add</span>
        </Button>
      }
    >
      {tables.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {(["available", "occupied", "reserved", "dirty"] as const).map((status) =>
            statusCounts[status] > 0 ? (
              <span
                key={status}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:text-[11px]"
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
                {STATUS_LABEL[status]}
                <span className="tabular-nums text-foreground">{statusCounts[status]}</span>
              </span>
            ) : null,
          )}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading floor plan…</p>
      ) : zones.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No tables yet. Add dining or bar outlets to start.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {zones.map(([zone, zoneTables]) => (
            <section key={zone} className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">
                  {zone}
                </h2>
                <span className="rounded-full bg-muted px-1.5 py-px text-[10px] tabular-nums text-muted-foreground">
                  {zoneTables.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {zoneTables.map((table) => (
                  <article
                    key={table.id}
                    className={cn(
                      "flex flex-col rounded-xl border p-2.5 shadow-sm sm:rounded-2xl sm:p-3",
                      STATUS_CARD[table.status],
                    )}
                  >
                    <div className="flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[table.status])}
                          />
                          <h3 className="truncate text-sm font-semibold leading-none sm:text-base">
                            {table.name}
                          </h3>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground sm:text-[11px]">
                          <Users className="h-3 w-3 shrink-0" />
                          {table.seats}
                          <span aria-hidden>·</span>
                          <span className="truncate">{STATUS_LABEL[table.status]}</span>
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-muted-foreground"
                            aria-label={`Actions for ${table.name}`}
                          >
                            <EllipsisVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          {table.status === "dirty" ? (
                            <DropdownMenuItem onClick={() => setStatus(table, "available")}>
                              <Sparkles className="mr-2 h-3.5 w-3.5" />
                              Mark clean
                            </DropdownMenuItem>
                          ) : null}
                          {table.status === "available" ? (
                            <DropdownMenuItem onClick={() => setStatus(table, "reserved")}>
                              Reserve
                            </DropdownMenuItem>
                          ) : null}
                          {table.status === "reserved" ? (
                            <DropdownMenuItem onClick={() => setStatus(table, "available")}>
                              Unreserve
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onClick={() => openEdit(table)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleting(table)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {table.openOrderNumber ? (
                      <p className="mt-1 truncate text-[10px] font-medium text-orange-700 dark:text-orange-300">
                        {table.openOrderNumber}
                      </p>
                    ) : null}

                    <div className="mt-auto pt-2">
                      {table.openOrderId ? (
                        <Button
                          asChild
                          size="sm"
                          className="h-7 w-full rounded-lg bg-teal-600 text-[11px] hover:bg-teal-700 sm:h-8 sm:text-xs"
                        >
                          <Link href={`/pos?order=${table.openOrderId}`}>Resume</Link>
                        </Button>
                      ) : table.status !== "inactive" ? (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-7 w-full rounded-lg text-[11px] sm:h-8 sm:text-xs"
                        >
                          <Link href={`/pos?table=${table.id}`}>New order</Link>
                        </Button>
                      ) : (
                        <p className="py-1 text-center text-[10px] text-muted-foreground">Inactive</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit table" : "New table"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Zone</Label>
              <Input
                value={form.zone}
                onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Seats</Label>
              <Input
                type="number"
                min={1}
                placeholder="4"
                value={form.seats}
                onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as PosTableStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="dirty">Dirty</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={save}
              disabled={createTable.isPending || updateTable.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing orders keep history; the table is removed from the floor plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PosPageShell>
  );
}
