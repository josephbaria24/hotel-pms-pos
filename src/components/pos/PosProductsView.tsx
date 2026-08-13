"use client";

import { useMemo, useState } from "react";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  formatPeso,
  useCreatePosProduct,
  useDeletePosProduct,
  usePosCategories,
  usePosProducts,
  useUpdatePosProduct,
} from "@/lib/api-client/pos";
import type { PosProduct } from "@/lib/api-client/pos-types";

type FormState = {
  name: string;
  categoryId: string;
  sku: string;
  price: string;
  cost: string;
  trackStock: boolean;
  stockQty: string;
  isActive: boolean;
  isQuickSell: boolean;
};

const emptyForm: FormState = {
  name: "",
  categoryId: "none",
  sku: "",
  price: "0",
  cost: "0",
  trackStock: false,
  stockQty: "0",
  isActive: true,
  isQuickSell: false,
};

export function PosProductsView() {
  const { data: products = [], isLoading } = usePosProducts();
  const { data: categories = [] } = usePosCategories();
  const createProduct = useCreatePosProduct();
  const updateProduct = useUpdatePosProduct();
  const deleteProduct = useDeletePosProduct();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PosProduct | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleting, setDeleting] = useState<PosProduct | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.categoryName ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: PosProduct) => {
    setEditing(p);
    setForm({
      name: p.name,
      categoryId: p.categoryId ?? "none",
      sku: p.sku ?? "",
      price: String(p.price),
      cost: String(p.cost),
      trackStock: p.trackStock,
      stockQty: String(p.stockQty),
      isActive: p.isActive,
      isQuickSell: p.isQuickSell,
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
      categoryId: form.categoryId === "none" ? null : form.categoryId,
      sku: form.sku || null,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      trackStock: form.trackStock,
      stockQty: Number(form.stockQty) || 0,
      isActive: form.isActive,
      isQuickSell: form.isQuickSell,
    };
    try {
      if (editing) {
        await updateProduct.mutateAsync({ id: editing.id, ...payload });
        toast({ title: "Product updated" });
      } else {
        await createProduct.mutateAsync(payload);
        toast({ title: "Product created" });
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

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteProduct.mutateAsync(deleting.id);
      toast({ title: "Product deleted" });
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
      title="Products"
      description="Manage sellable items, prices, and stock for the POS catalog."
      icon={Package}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          className="max-w-sm"
          placeholder="Search products…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add product
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No products found.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto overflow-hidden rounded-xl border border-border/70">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Flags</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border/60">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.sku || "No SKU"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.categoryName || "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatPeso(p.price)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.trackStock ? p.stockQty : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {[
                      p.isActive ? "Active" : "Inactive",
                      p.isQuickSell ? "Quick" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Input
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Price</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cost</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Stock qty</Label>
              <Input
                type="number"
                min={0}
                step="1"
                disabled={!form.trackStock}
                value={form.stockQty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stockQty: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2 sm:col-span-2">
              <Label>Track stock</Label>
              <Switch
                checked={form.trackStock}
                onCheckedChange={(v) => setForm((f) => ({ ...f, trackStock: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label>Active</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label>Quick sell</Label>
              <Switch
                checked={form.isQuickSell}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isQuickSell: v }))}
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
              disabled={createProduct.isPending || updateProduct.isPending}
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
              Past order lines keep the product name; this removes it from the catalog.
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
