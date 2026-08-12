"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LayoutGrid, Pencil, Plus, Trash2 } from "lucide-react";
import { PosPageShell } from "@/components/pos/PosPageShell";
import { PosTableStatusBadge } from "@/components/pos/PosBadges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  seats: "4",
  status: "available",
  notes: "",
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
      toast({ title: `${table.name} → ${status}` });
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
    >
      <div className="mb-4 flex justify-end">
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add table
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading floor plan…</p>
      ) : zones.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No tables yet. Add dining or bar outlets to start.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {zones.map(([zone, zoneTables]) => (
            <section key={zone} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {zone}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {zoneTables.map((table) => (
                  <Card
                    key={table.id}
                    className={cn(
                      "border-border/70 transition-colors",
                      table.status === "occupied" && "border-orange-500/40 bg-orange-500/5",
                      table.status === "available" && "border-emerald-500/30",
                      table.status === "dirty" && "border-rose-500/35 bg-rose-500/5",
                    )}
                  >
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-lg font-semibold">{table.name}</div>
                          <p className="text-xs text-muted-foreground">
                            {table.seats} seats
                          </p>
                        </div>
                        <PosTableStatusBadge status={table.status} />
                      </div>

                      {table.openOrderNumber && (
                        <p className="text-xs text-muted-foreground">
                          Open: {table.openOrderNumber}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {table.openOrderId ? (
                          <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700">
                            <Link href={`/pos?order=${table.openOrderId}`}>
                              Resume order
                            </Link>
                          </Button>
                        ) : table.status !== "inactive" ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/pos?table=${table.id}`}>New order</Link>
                          </Button>
                        ) : null}

                        {table.status === "dirty" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus(table, "available")}
                          >
                            Mark clean
                          </Button>
                        )}
                        {table.status === "available" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus(table, "reserved")}
                          >
                            Reserve
                          </Button>
                        )}
                        {table.status === "reserved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus(table, "available")}
                          >
                            Unreserve
                          </Button>
                        )}
                      </div>

                      <div className="flex justify-end gap-1 border-t pt-2">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(table)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setDeleting(table)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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
