import type { PosProduct, PosStockMovementType } from "@/lib/api-client/pos-types";

export const DEFAULT_REORDER_POINT = 5;

export type PosInventoryStatus = "in_stock" | "low" | "out" | "untracked";

export const INVENTORY_STATUS_LABEL: Record<PosInventoryStatus, string> = {
  in_stock: "In stock",
  low: "Low stock",
  out: "Out of stock",
  untracked: "Not tracked",
};

export const STOCK_MOVE_REASONS = [
  { value: "purchase", label: "Purchase / delivery" },
  { value: "opening", label: "Opening balance" },
  { value: "spoilage", label: "Spoilage" },
  { value: "damage", label: "Damage" },
  { value: "theft", label: "Theft / loss" },
  { value: "correction", label: "Correction" },
  { value: "count", label: "Physical count" },
  { value: "other", label: "Other" },
] as const;

export function stockQty(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

export function formatStockQty(value: number) {
  const n = stockQty(value);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function productReorderPoint(product: Pick<PosProduct, "reorderPoint">) {
  const n = Number(product.reorderPoint);
  return Number.isFinite(n) ? stockQty(n) : DEFAULT_REORDER_POINT;
}

export function inventoryStatus(
  product: Pick<PosProduct, "trackStock" | "stockQty" | "reorderPoint">,
): PosInventoryStatus {
  if (!product.trackStock) return "untracked";
  const qty = stockQty(product.stockQty);
  if (qty <= 0) return "out";
  const reorder = productReorderPoint(product);
  if (reorder > 0 && qty <= reorder) return "low";
  return "in_stock";
}

export function inventoryValue(product: Pick<PosProduct, "trackStock" | "stockQty" | "cost">) {
  if (!product.trackStock) return 0;
  return stockQty(product.stockQty) * Number(product.cost || 0);
}

export function summarizeInventory(products: PosProduct[]) {
  let tracked = 0;
  let inStock = 0;
  let low = 0;
  let out = 0;
  let untracked = 0;
  let onHandQty = 0;
  let value = 0;
  for (const p of products) {
    const status = inventoryStatus(p);
    if (status === "untracked") {
      untracked += 1;
      continue;
    }
    tracked += 1;
    onHandQty += stockQty(p.stockQty);
    value += inventoryValue(p);
    if (status === "in_stock") inStock += 1;
    else if (status === "low") low += 1;
    else out += 1;
  }
  return { total: products.length, tracked, inStock, low, out, untracked, onHandQty, value };
}

export function movementTypeLabel(type: PosStockMovementType | string) {
  const map: Record<string, string> = {
    receive: "Received",
    adjust: "Adjustment",
    count: "Count",
    sale: "Sale",
    void_sale: "Void / return",
    waste: "Waste",
  };
  return map[type] ?? type;
}
