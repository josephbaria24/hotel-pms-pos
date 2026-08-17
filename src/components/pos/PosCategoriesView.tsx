"use client";

import { useMemo, useState } from "react";
import { EyeOff, Pencil, Plus, Tags, Trash2 } from "lucide-react";
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
import { NumberInput, numberOrZero } from "@/components/ui/number-input";
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
  useCreatePosCategory,
  useDeletePosCategory,
  usePosCategories,
  usePosProducts,
  useUpdatePosCategory,
} from "@/lib/api-client/pos";
import type { PosCategory } from "@/lib/api-client/pos-types";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  description: string;
  sortOrder: number | "";
  isActive: boolean;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  sortOrder: "",
  isActive: true,
};

export function PosCategoriesView() {
  const { data: categories = [], isLoading } = usePosCategories();
  const { data: products = [] } = usePosProducts();
  const createCat = useCreatePosCategory();
  const updateCat = useUpdatePosCategory();
  const deleteCat = useDeletePosCategory();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PosCategory | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleting, setDeleting] = useState<PosCategory | null>(null);

  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories],
  );
  const activeCats = useMemo(() => sorted.filter((c) => c.isActive), [sorted]);
  const hiddenCats = useMemo(() => sorted.filter((c) => !c.isActive), [sorted]);
  const productCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      if (!product.categoryId) continue;
      counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (cat: PosCategory) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      description: cat.description ?? "",
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    try {
      if (editing) {
        await updateCat.mutateAsync({
          id: editing.id,
          name: form.name,
          description: form.description || null,
          sortOrder: numberOrZero(form.sortOrder),
          isActive: form.isActive,
        });
        toast({ title: "Category updated" });
      } else {
        await createCat.mutateAsync({
          name: form.name,
          description: form.description || null,
          sortOrder: numberOrZero(form.sortOrder),
          isActive: form.isActive,
        });
        toast({ title: "Category created" });
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
      await deleteCat.mutateAsync(deleting.id);
      toast({ title: "Category deleted" });
      setDeleting(null);
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (cat: PosCategory) => {
    try {
      await updateCat.mutateAsync({ id: cat.id, isActive: !cat.isActive });
      toast({
        title: cat.isActive ? "Hidden from register" : "Shown on register",
        description: cat.name,
      });
    } catch (err) {
      toast({
        title: "Could not update category",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const renderCards = (items: PosCategory[]) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((cat) => (
        <CategoryCard
          key={cat.id}
          cat={cat}
          productCount={productCountByCategory.get(cat.id) ?? 0}
          onEdit={() => openEdit(cat)}
          onDelete={() => setDeleting(cat)}
          onToggle={() => void toggleActive(cat)}
          toggling={updateCat.isPending}
        />
      ))}
    </div>
  );

  return (
    <PosPageShell
      title="Categories"
      description="Group products for faster register browsing."
      icon={Tags}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="h-6 rounded-full border-teal-500/30 bg-teal-500/10 px-2.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300"
          >
            {activeCats.length} active
          </Badge>
          <Badge
            variant="outline"
            className="h-6 rounded-full border-border bg-muted px-2.5 text-[11px] font-semibold text-muted-foreground"
          >
            {hiddenCats.length} hidden
          </Badge>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add category
            </Button>
          </TooltipTrigger>
          <TooltipContent>Create a new product group for the register</TooltipContent>
        </Tooltip>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : sorted.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No categories yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">On the register</h2>
              <span className="text-xs text-muted-foreground">Visible to cashiers</span>
            </div>
            {activeCats.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No active categories. Turn one on so it appears at the register.
                </CardContent>
              </Card>
            ) : (
              renderCards(activeCats)
            )}
          </section>

          {hiddenCats.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
                  Hidden from register
                </h2>
              </div>
              {renderCards(hiddenCats)}
            </section>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Beverages"
                  />
                </TooltipTrigger>
                <TooltipContent>Display name on register category chips</TooltipContent>
              </Tooltip>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Input
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  Optional staff note. Not shown on the register chips.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <NumberInput
                    placeholder="0"
                    value={form.sortOrder}
                    onValueChange={(sortOrder) =>
                      setForm((f) => ({ ...f, sortOrder }))
                    }
                  />
                </TooltipTrigger>
                <TooltipContent>
                  Lower numbers appear first. Leave blank to use 0.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label>Active</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Switch
                      checked={form.isActive}
                      onCheckedChange={(v) =>
                        setForm((f) => ({ ...f, isActive: v }))
                      }
                      className="data-[state=checked]:bg-teal-600 data-[state=unchecked]:bg-muted-foreground/40"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Inactive categories stay hidden on the register
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <DialogFooter>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close without saving</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    onClick={save}
                    disabled={createCat.isPending || updateCat.isPending}
                  >
                    Save
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Save this category</TooltipContent>
            </Tooltip>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Products in this category will keep their items but lose the category link.
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

function CategoryCard({
  cat,
  productCount,
  onEdit,
  onDelete,
  onToggle,
  toggling,
}: {
  cat: PosCategory;
  productCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  toggling: boolean;
}) {
  const active = cat.isActive;
  return (
    <Card
      className={cn(
        "relative overflow-hidden border shadow-sm transition-colors",
        active
          ? "border-teal-500/25 bg-card"
          : "border-dashed border-border/80 bg-muted/40",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          active ? "bg-teal-500" : "bg-muted-foreground/30",
        )}
      />
      <CardContent className="flex items-start gap-3 p-4 pl-5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            active
              ? "bg-teal-500/12 text-teal-700 dark:text-teal-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {active ? <Tags className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className={cn("truncate font-semibold", !active && "text-muted-foreground")}>
                {cat.name}
              </div>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                {cat.description || "No description"}
              </p>
            </div>
            <div className="flex shrink-0 gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit category</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete category</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "h-5 rounded-full px-2 text-[10px] font-bold uppercase tracking-wide",
                active
                  ? "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                  : "border-border bg-background/70 text-muted-foreground",
              )}
            >
              {active ? "Active" : "Hidden"}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              Sort {cat.sortOrder}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {productCount} {productCount === 1 ? "product" : "products"}
            </span>
            <span className="ml-auto inline-flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {active ? "Shown" : "Hidden"}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Switch
                      checked={active}
                      disabled={toggling}
                      onCheckedChange={onToggle}
                      className="data-[state=checked]:bg-teal-600 data-[state=unchecked]:bg-muted-foreground/40"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {active ? "Hide this category from the register" : "Show this category on the register"}
                </TooltipContent>
              </Tooltip>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
