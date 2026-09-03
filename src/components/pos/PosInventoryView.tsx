"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownToLine,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  MoreHorizontal,
  PackagePlus,
  Search,
  Settings2,
  SlidersHorizontal,
  Warehouse,
} from "lucide-react";
import { PosPageShell } from "@/components/pos/PosPageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput, numberOrZero } from "@/components/ui/number-input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useGetSettings } from "@/lib/api-client";
import {
  formatPeso,
  useAdjustPosStock,
  usePosCategories,
  usePosProducts,
  usePosStockMovements,
  useUpdatePosProduct,
} from "@/lib/api-client/pos";
import type { PosProduct, PosStockMovementType } from "@/lib/api-client/pos-types";
import { formatPhDateTime } from "@/lib/datetime";
import {
  DEFAULT_REORDER_POINT,
  INVENTORY_STATUS_LABEL,
  STOCK_MOVE_REASONS,
  formatStockQty,
  inventoryStatus,
  inventoryValue,
  movementTypeLabel,
  productReorderPoint,
  summarizeInventory,
} from "@/lib/pos-inventory";
import { cn } from "@/lib/utils";

type DialogMode = "receive" | "adjust" | "count" | "reorder" | "track" | null;
type StockFilter = "all" | "in_stock" | "low" | "out" | "untracked";

function statusClass(status: string) {
  if (status === "out") return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  if (status === "low") return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  if (status === "in_stock") return "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300";
  return "border-border bg-muted text-muted-foreground";
}

function movementClass(type: PosStockMovementType | string) {
  if (type === "receive") return "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300";
  if (type === "waste") return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  if (type === "sale") return "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300";
  if (type === "count") return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
  if (type === "void_sale") return "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
}

export function PosInventoryView() {
  const { data: products = [], isLoading } = usePosProducts();
  const { data: categories = [] } = usePosCategories();
  const { data: movements = [], isLoading: movementsLoading } = usePosStockMovements();
  const adjustStock = useAdjustPosStock();
  const updateProduct = useUpdatePosProduct();
  const { data: settings } = useGetSettings();
  const { toast } = useToast();

  const [tab, setTab] = useState("on-hand");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [moveType, setMoveType] = useState("all");
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<PosProduct | null>(null);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState<number | "">("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [reason, setReason] = useState("purchase");
  const [referenceNo, setReferenceNo] = useState("");
  const [note, setNote] = useState("");
  const [reorder, setReorder] = useState<number | "">(DEFAULT_REORDER_POINT);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const stats = useMemo(() => summarizeInventory(products), [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (q) {
        const hay = `${p.name} ${p.sku ?? ""} ${p.categoryName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (categoryFilter === "none" && p.categoryId) return false;
      if (categoryFilter !== "all" && categoryFilter !== "none" && p.categoryId !== categoryFilter) {
        return false;
      }
      if (stockFilter !== "all" && inventoryStatus(p) !== stockFilter) return false;
      return true;
    });
  }, [products, query, categoryFilter, stockFilter]);

  const filteredMoves = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movements.filter((m) => {
      if (moveType !== "all" && m.type !== moveType) return false;
      if (!q) return true;
      const hay = `${m.productName} ${m.sku ?? ""} ${m.reason ?? ""} ${m.referenceNo ?? ""} ${m.note ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [movements, query, moveType]);

  const exportInventory = async (format: "pdf" | "excel") => {
    if (format === "pdf" && filtered.length === 0 && filteredMoves.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No inventory rows match the current filters.",
        variant: "destructive",
      });
      return;
    }
    setExporting(format);
    try {
      const payload = {
        products: format === "excel" ? products : filtered,
        movements: format === "excel" ? movements : filteredMoves,
        categories,
        hotel: {
          hotelName: settings?.hotelName || "PalawanSU Hotel",
          address: settings?.address,
          contactNumber: settings?.contactNumber,
        },
      };
      if (format === "excel") {
        if (products.length === 0 && movements.length === 0 && categories.length === 0) {
          toast({
            title: "Nothing to export",
            description: "There is no catalog or stock data yet.",
            variant: "destructive",
          });
          setExporting(null);
          return;
        }
        const { downloadInventoryExcel } = await import("@/lib/pos-inventory-export");
        await downloadInventoryExcel(payload);
      } else {
        const { downloadInventoryPdf } = await import("@/lib/pos-inventory-export");
        await downloadInventoryPdf(payload);
      }
      toast({ title: format === "excel" ? "Excel downloaded" : "PDF downloaded" });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const openDialog = (mode: DialogMode, product?: PosProduct) => {
    setDialog(mode);
    setSelected(product ?? null);
    setProductId(product?.id ?? "");
    setQty(mode === "count" ? product?.stockQty ?? "" : "");
    setDirection("in");
    setReason(mode === "receive" ? "purchase" : mode === "count" ? "count" : "correction");
    setReferenceNo("");
    setNote("");
    setReorder(product ? productReorderPoint(product) : DEFAULT_REORDER_POINT);
  };

  const closeDialog = () => {
    setDialog(null);
    setSelected(null);
    setQty("");
  };

  const activeProduct = products.find((p) => p.id === productId) ?? selected;

  const submit = async () => {
    try {
      if (dialog === "reorder") {
        if (!productId) throw new Error("Select a product.");
        await updateProduct.mutateAsync({
          id: productId,
          reorderPoint: Math.max(0, numberOrZero(reorder)),
        });
        toast({ title: "Reorder point saved" });
        closeDialog();
        return;
      }
      if (dialog === "track") {
        if (!productId) throw new Error("Select a product.");
        const opening = Math.max(0, numberOrZero(qty));
        if (opening > 0) {
          await adjustStock.mutateAsync({
            productId,
            type: "receive",
            quantity: opening,
            reason: "opening",
            note: note.trim() || "Start tracking",
            enableTracking: true,
          });
        } else {
          await updateProduct.mutateAsync({ id: productId, trackStock: true, stockQty: 0 });
        }
        toast({ title: "Stock tracking enabled" });
        closeDialog();
        return;
      }
      if (!productId) throw new Error("Select a product.");
      if (dialog === "count") {
        await adjustStock.mutateAsync({
          productId,
          type: "count",
          quantity: 0,
          countedQty: Math.max(0, numberOrZero(qty)),
          reason: "count",
          note: note.trim() || null,
        });
        toast({ title: "Physical count saved" });
      } else if (dialog === "receive") {
        await adjustStock.mutateAsync({
          productId,
          type: "receive",
          quantity: numberOrZero(qty),
          reason,
          referenceNo: referenceNo.trim() || null,
          note: note.trim() || null,
          enableTracking: true,
        });
        toast({ title: "Stock received" });
      } else if (dialog === "adjust") {
        const amount = numberOrZero(qty);
        const waste = reason === "spoilage" || reason === "damage" || reason === "theft";
        await adjustStock.mutateAsync({
          productId,
          type: waste ? "waste" : "adjust",
          quantity: waste || direction === "out" ? -Math.abs(amount) : Math.abs(amount),
          reason,
          referenceNo: referenceNo.trim() || null,
          note: note.trim() || null,
        });
        toast({ title: "Stock adjusted" });
      }
      closeDialog();
    } catch (err) {
      toast({
        title: "Inventory update failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const dialogTitle =
    dialog === "receive"
      ? "Receive stock"
      : dialog === "adjust"
        ? "Adjust stock"
        : dialog === "count"
          ? "Physical count"
          : dialog === "reorder"
            ? "Reorder point"
            : dialog === "track"
              ? "Start tracking"
              : "";

  return (
    <PosPageShell
      title="Inventory"
      description="On-hand stock, receiving, adjustments, counts, and movement history."
      icon={Warehouse}
      action={
        <div className="flex gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full"
                disabled={Boolean(exporting) || isLoading}
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void exportInventory("excel")}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportInventory("pdf")}>
                <FileText className="h-4 w-4" />
                PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => openDialog("adjust")}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Adjust</span>
          </Button>
          <Button size="sm" className="h-8 rounded-full" onClick={() => openDialog("receive")}>
            <ArrowDownToLine className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Receive</span>
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Tracked SKUs" value={stats.tracked} />
        <Kpi label="In stock" value={stats.inStock} tone="teal" />
        <Kpi label="Low stock" value={stats.low} tone="amber" />
        <Kpi label="Out of stock" value={stats.out} tone="rose" />
        <Kpi label="Untracked" value={stats.untracked} />
        <Kpi label="Stock value" value={formatPeso(stats.value)} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-3">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="h-9 w-full sm:w-auto">
            <TabsTrigger value="on-hand" className="gap-1.5 text-xs sm:text-sm">
              <Warehouse className="h-3.5 w-3.5" />
              On hand
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
              <History className="h-3.5 w-3.5" />
              Movements
            </TabsTrigger>
          </TabsList>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tab === "history" ? "Search movements…" : "Search SKU or item…"}
                className="h-8 bg-card pl-8 text-sm"
              />
            </div>
            {tab === "on-hand" ? (
              <>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 w-[9.5rem] bg-card text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <SelectItemText>All categories</SelectItemText>
                    </SelectItem>
                    <SelectItem value="none">
                      <SelectItemText>Uncategorized</SelectItemText>
                    </SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <SelectItemText>{c.name}</SelectItemText>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
                  <SelectTrigger className="h-8 w-[8.5rem] bg-card text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <SelectItemText>All status</SelectItemText>
                    </SelectItem>
                    <SelectItem value="in_stock">
                      <SelectItemText>In stock</SelectItemText>
                    </SelectItem>
                    <SelectItem value="low">
                      <SelectItemText>Low stock</SelectItemText>
                    </SelectItem>
                    <SelectItem value="out">
                      <SelectItemText>Out of stock</SelectItemText>
                    </SelectItem>
                    <SelectItem value="untracked">
                      <SelectItemText>Not tracked</SelectItemText>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : (
              <Select value={moveType} onValueChange={setMoveType}>
                <SelectTrigger className="h-8 w-[9rem] bg-card text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <SelectItemText>All types</SelectItemText>
                  </SelectItem>
                  {(["receive", "sale", "adjust", "count", "waste", "void_sale"] as const).map((t) => (
                    <SelectItem key={t} value={t}>
                      <SelectItemText>{movementTypeLabel(t)}</SelectItemText>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <TabsContent value="on-hand" className="mt-0">
          <div className="overflow-auto rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Reorder</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Loading inventory…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No products match these filters.{" "}
                      <Link href="/pos/products" className="text-primary underline-offset-2 hover:underline">
                        Add products
                      </Link>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => {
                    const status = inventoryStatus(p);
                    return (
                      <TableRow key={p.id} className={cn(!p.isActive && "bg-muted/30")}>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {p.sku || "No SKU"} · {p.unit || "each"}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {p.categoryName || "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {p.trackStock ? formatStockQty(p.stockQty) : "—"}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                          {p.trackStock ? formatStockQty(productReorderPoint(p)) : "—"}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums lg:table-cell">
                          {p.trackStock ? formatPeso(inventoryValue(p)) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("h-5 rounded-full px-2 text-[10px] font-bold uppercase", statusClass(status))}>
                            {INVENTORY_STATUS_LABEL[status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDialog("receive", p)}>
                                <ArrowDownToLine className="h-4 w-4" />
                                Receive
                              </DropdownMenuItem>
                              {p.trackStock ? (
                                <>
                                  <DropdownMenuItem onClick={() => openDialog("adjust", p)}>
                                    <SlidersHorizontal className="h-4 w-4" />
                                    Adjust
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openDialog("count", p)}>
                                    <ClipboardCheck className="h-4 w-4" />
                                    Count
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openDialog("reorder", p)}>
                                    <Settings2 className="h-4 w-4" />
                                    Reorder point
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem onClick={() => openDialog("track", p)}>
                                  <PackagePlus className="h-4 w-4" />
                                  Start tracking
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {stats.low + stats.out > 0 ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {stats.out} out of stock and {stats.low} below reorder point.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <div className="overflow-auto rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="hidden text-right md:table-cell">After</TableHead>
                  <TableHead className="hidden lg:table-cell">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Loading movements…
                    </TableCell>
                  </TableRow>
                ) : filteredMoves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No stock movements yet. Receive stock or complete a POS sale to start the ledger.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMoves.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {m.createdAt ? formatPhDateTime(m.createdAt) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{m.productName || "Item"}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{m.sku || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("h-5 rounded-full px-2 text-[10px] font-bold uppercase", movementClass(m.type))}>
                          {movementTypeLabel(m.type)}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold tabular-nums",
                          m.quantity < 0 && "text-rose-600 dark:text-rose-400",
                          m.quantity > 0 && "text-teal-700 dark:text-teal-300",
                        )}
                      >
                        {m.quantity > 0 ? "+" : ""}
                        {formatStockQty(m.quantity)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">
                        {formatStockQty(m.qtyAfter)}
                      </TableCell>
                      <TableCell className="hidden max-w-[16rem] truncate text-xs text-muted-foreground lg:table-cell">
                        {[m.reason, m.referenceNo, m.note].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(dialog)} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialog === "receive"
                ? "Add incoming stock from a purchase or delivery."
                : dialog === "adjust"
                  ? "Correct on-hand quantity for waste, loss, or a manual fix."
                  : dialog === "count"
                    ? "Set the actual counted quantity. Variance is posted automatically."
                    : dialog === "reorder"
                      ? "Alert when on-hand stock falls to this quantity."
                      : "Turn on quantity tracking and optionally set an opening balance."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <SelectItemText>
                        {p.name}
                        {p.sku ? ` (${p.sku})` : ""}
                      </SelectItemText>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeProduct?.trackStock ? (
                <p className="text-xs text-muted-foreground">
                  On hand: {formatStockQty(activeProduct.stockQty)} {activeProduct.unit}
                </p>
              ) : activeProduct ? (
                <p className="text-xs text-muted-foreground">This item is not tracking stock yet.</p>
              ) : null}
            </div>

            {dialog === "adjust" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Direction</Label>
                  <Select value={direction} onValueChange={(v) => setDirection(v as "in" | "out")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">
                        <SelectItemText>Add stock</SelectItemText>
                      </SelectItem>
                      <SelectItem value="out">
                        <SelectItemText>Remove stock</SelectItemText>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Reason</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_MOVE_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          <SelectItemText>{r.label}</SelectItemText>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            {dialog === "receive" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Quantity</Label>
                  <NumberInput min={0} step="0.001" value={qty} onValueChange={setQty} />
                </div>
                <div className="space-y-1.5">
                  <Label>Reference</Label>
                  <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="PO / invoice" />
                </div>
              </div>
            ) : null}

            {dialog === "adjust" || dialog === "count" || dialog === "track" ? (
              <div className="space-y-1.5">
                <Label>{dialog === "count" ? "Counted quantity" : dialog === "track" ? "Opening quantity" : "Quantity"}</Label>
                <NumberInput min={0} step="0.001" value={qty} onValueChange={setQty} />
              </div>
            ) : null}

            {dialog === "reorder" ? (
              <div className="space-y-1.5">
                <Label>Reorder point</Label>
                <NumberInput min={0} step="0.001" value={reorder} onValueChange={setReorder} />
              </div>
            ) : null}

            {dialog === "receive" || dialog === "adjust" || dialog === "count" || dialog === "track" ? (
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional" />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={adjustStock.isPending || updateProduct.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PosPageShell>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "teal" | "amber" | "rose";
}) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-lg font-bold tabular-nums sm:text-xl",
          tone === "teal" && "text-teal-700 dark:text-teal-300",
          tone === "amber" && "text-amber-800 dark:text-amber-300",
          tone === "rose" && "text-rose-700 dark:text-rose-300",
        )}
      >
        {value}
      </p>
    </div>
  );
}
