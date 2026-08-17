"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { PosPageShell } from "@/components/pos/PosPageShell";
import { Badge } from "@/components/ui/badge";
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
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

function pageWindow(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

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
  price: "",
  cost: "",
  trackStock: false,
  stockQty: "",
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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [flagFilter, setFlagFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PosProduct | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleting, setDeleting] = useState<PosProduct | null>(null);

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof categories = [];
    for (const c of categories) {
      const key = c.name.trim().toLowerCase();
      if (!key || !c.id?.trim() || seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }, [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (q) {
        const hay = `${p.name} ${p.sku ?? ""} ${p.categoryName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (categoryFilter === "none") {
        if (p.categoryId) return false;
      } else if (categoryFilter !== "all" && p.categoryId !== categoryFilter) {
        return false;
      }
      if (statusFilter === "active" && !p.isActive) return false;
      if (statusFilter === "inactive" && p.isActive) return false;
      if (flagFilter === "quick" && !p.isQuickSell) return false;
      if (flagFilter === "standard" && p.isQuickSell) return false;
      if (stockFilter === "untracked" && p.trackStock) return false;
      if (stockFilter === "in" && (!p.trackStock || p.stockQty <= 0)) return false;
      if (stockFilter === "low" && (!p.trackStock || p.stockQty <= 0 || p.stockQty > 5)) {
        return false;
      }
      if (stockFilter === "out" && (!p.trackStock || p.stockQty > 0)) return false;
      return true;
    });
  }, [products, query, categoryFilter, statusFilter, flagFilter, stockFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [query, categoryFilter, statusFilter, flagFilter, stockFilter]);

  const counts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let quick = 0;
    for (const p of products) {
      if (p.isActive) active += 1;
      else inactive += 1;
      if (p.isQuickSell) quick += 1;
    }
    return { total: products.length, active, inactive, quick };
  }, [products]);

  const hasFilters =
    Boolean(query.trim()) ||
    categoryFilter !== "all" ||
    statusFilter !== "all" ||
    flagFilter !== "all" ||
    stockFilter !== "all";

  const resolveCategoryId = (product: PosProduct) => {
    const raw = product.categoryId ?? "none";
    if (raw === "none" || !raw) return "none";
    if (categoryOptions.some((c) => c.id === raw)) return raw;
    const byName = categoryOptions.find(
      (c) =>
        c.name.trim().toLowerCase() ===
        (product.categoryName ?? "").trim().toLowerCase(),
    );
    return byName?.id ?? "none";
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: PosProduct) => {
    setEditing(p);
    setForm({
      name: p.name,
      categoryId: resolveCategoryId(p),
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

  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <PosPageShell
      title="Products"
      description="Manage sellable items, prices, and stock for the POS catalog."
      icon={Package}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="h-6 rounded-full px-2.5 text-[11px] font-semibold"
          >
            {counts.total} total
          </Badge>
          <Badge
            variant="outline"
            className="h-6 rounded-full border-teal-500/30 bg-teal-500/10 px-2.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300"
          >
            {counts.active} active
          </Badge>
          <Badge
            variant="outline"
            className="h-6 rounded-full px-2.5 text-[11px] font-semibold text-muted-foreground"
          >
            {counts.inactive} hidden
          </Badge>
          <Badge
            variant="outline"
            className="h-6 rounded-full border-amber-500/30 bg-amber-500/10 px-2.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300"
          >
            {counts.quick} quick sell
          </Badge>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add product
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add an item to the register catalog</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            placeholder="Search name, SKU, or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[170px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <SelectItemText>All categories</SelectItemText>
            </SelectItem>
            <SelectItem value="none">
              <SelectItemText>Uncategorized</SelectItemText>
            </SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <SelectItemText>{c.name}</SelectItemText>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <SelectItemText>All statuses</SelectItemText>
            </SelectItem>
            <SelectItem value="active">
              <SelectItemText>Active</SelectItemText>
            </SelectItem>
            <SelectItem value="inactive">
              <SelectItemText>Hidden</SelectItemText>
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={flagFilter} onValueChange={setFlagFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[150px]">
            <SelectValue placeholder="Flags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <SelectItemText>All flags</SelectItemText>
            </SelectItem>
            <SelectItem value="quick">
              <SelectItemText>Quick sell</SelectItemText>
            </SelectItem>
            <SelectItem value="standard">
              <SelectItemText>Standard</SelectItemText>
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[150px]">
            <SelectValue placeholder="Stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <SelectItemText>All stock</SelectItemText>
            </SelectItem>
            <SelectItem value="in">
              <SelectItemText>In stock</SelectItemText>
            </SelectItem>
            <SelectItem value="low">
              <SelectItemText>Low (1–5)</SelectItemText>
            </SelectItem>
            <SelectItem value="out">
              <SelectItemText>Out of stock</SelectItemText>
            </SelectItem>
            <SelectItem value="untracked">
              <SelectItemText>Not tracked</SelectItemText>
            </SelectItem>
          </SelectContent>
        </Select>
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            className="h-9"
            onClick={() => {
              setQuery("");
              setCategoryFilter("all");
              setStatusFilter("all");
              setFlagFilter("all");
              setStockFilter("all");
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {hasFilters
              ? "No products match these filters."
              : "No products yet. Add one to start selling."}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[88px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((p) => {
                const low = p.trackStock && p.stockQty > 0 && p.stockQty <= 5;
                const out = p.trackStock && p.stockQty <= 0;
                return (
                  <TableRow key={p.id} className={cn(!p.isActive && "bg-muted/30")}>
                    <TableCell>
                      <div className={cn("font-medium", !p.isActive && "text-muted-foreground")}>
                        {p.name}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {p.sku || "No SKU"}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.categoryName || "Uncategorized"}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {formatPeso(p.price)}
                    </TableCell>
                    <TableCell>
                      {!p.trackStock ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            "tabular-nums",
                            out && "font-semibold text-rose-600 dark:text-rose-400",
                            low && "font-semibold text-amber-700 dark:text-amber-300",
                          )}
                        >
                          {p.stockQty}
                          {out ? " out" : low ? " low" : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 rounded-full px-2 text-[10px] font-bold uppercase tracking-wide",
                            p.isActive
                              ? "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                              : "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          {p.isActive ? "Active" : "Hidden"}
                        </Badge>
                        {p.isQuickSell ? (
                          <Badge
                            variant="outline"
                            className="h-5 rounded-full border-amber-500/30 bg-amber-500/10 px-2 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300"
                          >
                            Quick
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit product</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleting(p)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete product</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-2 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {rangeStart}–{rangeEnd} of {filtered.length}
              {hasFilters ? ` (filtered from ${products.length})` : ""}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Prev
              </Button>
              {pageWindow(currentPage, pageCount).map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={n === currentPage ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(n)}
                >
                  {n}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
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
              <Label>SKU (Stock Keeping Unit)</Label>
              <Input
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                placeholder="e.g. BEV-WATER"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <SelectItemText>Uncategorized</SelectItemText>
                  </SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <SelectItemText>{c.name}</SelectItemText>
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
                placeholder="0"
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
                placeholder="0"
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
                placeholder="0"
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
