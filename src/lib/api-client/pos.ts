"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { newId } from "./mappers";
import { summarizePosOrders, type PosSalesSummary } from "@/lib/pos-sales-stats";
import type {
  AdjustPosStockInput,
  CreatePosCategoryInput,
  CreatePosProductInput,
  CreatePosTableInput,
  PosCategory,
  PosOrder,
  PosOrderItem,
  PosPayment,
  PosProduct,
  PosStockMovement,
  PosStockMovementType,
  PosTable,
  PosTableStatus,
  SavePosOrderInput,
  UpdatePosCategoryInput,
  UpdatePosProductInput,
  UpdatePosTableInput,
} from "./pos-types";
import { DEFAULT_REORDER_POINT, stockQty } from "@/lib/pos-inventory";

export type * from "./pos-types";
export type { PosSalesSummary };

const qk = {
  categories: ["pos", "categories", "deduped"] as const,
  products: ["pos", "products", "deduped"] as const,
  tables: ["pos", "tables", "deduped"] as const,
  orders: (filter?: string) => ["pos", "orders", filter ?? "all"] as const,
  order: (id: string) => ["pos", "order", id] as const,
  sales: (range: string) => ["pos", "sales", range] as const,
  movements: ["pos", "stock-movements"] as const,
};

function mapCategory(row: Record<string, unknown>): PosCategory {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: (row.description as string | null) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active ?? true),
    color: (row.color as string | null) ?? null,
  };
}

function mapProduct(row: Record<string, unknown>): PosProduct {
  const cat = row.pos_categories as { name?: string } | null;
  return {
    id: String(row.id),
    categoryId: (row.category_id as string | null) ?? null,
    categoryName: cat?.name ?? null,
    sku: (row.sku as string | null) ?? null,
    name: String(row.name ?? ""),
    description: (row.description as string | null) ?? null,
    price: Number(row.price ?? 0),
    cost: Number(row.cost ?? 0),
    trackStock: Boolean(row.track_stock),
    stockQty: Number(row.stock_qty ?? 0),
    reorderPoint:
      row.reorder_point == null ? DEFAULT_REORDER_POINT : Number(row.reorder_point),
    unit: String(row.unit ?? "each"),
    isActive: Boolean(row.is_active ?? true),
    isQuickSell: Boolean(row.is_quick_sell),
    sortOrder: Number(row.sort_order ?? 0),
    imageUrl: (row.image_url as string | null) ?? null,
  };
}

function mapTable(row: Record<string, unknown>): PosTable {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    zone: String(row.zone ?? "Main"),
    seats: Number(row.seats ?? 4),
    status: String(row.status ?? "available") as PosTableStatus,
    posX: row.pos_x == null ? null : Number(row.pos_x),
    posY: row.pos_y == null ? null : Number(row.pos_y),
    sortOrder: Number(row.sort_order ?? 0),
    notes: (row.notes as string | null) ?? null,
  };
}

/**
 * Lab mode RLS returns own + admin catalog rows. Prefer the signed-in user's
 * row when names/SKUs collide so the register does not show duplicates.
 */
function dedupePreferOwnTenant<T>(
  rows: Record<string, unknown>[],
  userId: string | undefined,
  keyFn: (row: Record<string, unknown>) => string,
  mapFn: (row: Record<string, unknown>) => T,
): T[] {
  const sorted = [...rows].sort((a, b) => {
    const aOwn = String(a.tenant_id ?? "") === userId ? 0 : 1;
    const bOwn = String(b.tenant_id ?? "") === userId ? 0 : 1;
    return aOwn - bOwn;
  });
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of sorted) {
    const key = keyFn(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(mapFn(row));
  }
  return out;
}

async function currentUserId(): Promise<string | undefined> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id;
}

function mapItem(row: Record<string, unknown>): PosOrderItem {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    productId: (row.product_id as string | null) ?? null,
    productName: String(row.product_name ?? ""),
    unitPrice: Number(row.unit_price ?? 0),
    quantity: Number(row.quantity ?? 1),
    lineTotal: Number(row.line_total ?? 0),
    notes: (row.notes as string | null) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapPayment(row: Record<string, unknown>): PosPayment {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    amount: Number(row.amount ?? 0),
    method: String(row.method ?? "cash"),
    referenceNo: (row.reference_no as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    receivedBy: (row.received_by as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
  };
}

function mapOrder(row: Record<string, unknown>): PosOrder {
  const table = row.pos_tables as { name?: string } | null;
  const room = row.rooms as { room_number?: string } | null;
  const items = (row.pos_order_items as Record<string, unknown>[] | null) ?? [];
  const payments = (row.pos_payments as Record<string, unknown>[] | null) ?? [];
  return {
    id: String(row.id),
    orderNumber: String(row.order_number ?? ""),
    status: String(row.status ?? "open") as PosOrder["status"],
    orderType: String(row.order_type ?? "walk_in") as PosOrder["orderType"],
    tableId: (row.table_id as string | null) ?? null,
    tableName: table?.name ?? null,
    guestId: (row.guest_id as string | null) ?? null,
    reservationId: (row.reservation_id as string | null) ?? null,
    roomId: (row.room_id as string | null) ?? null,
    roomNumber: room?.room_number ?? null,
    customerName: (row.customer_name as string | null) ?? null,
    subtotal: Number(row.subtotal ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    paidAmount: Number(row.paid_amount ?? 0),
    notes: (row.notes as string | null) ?? null,
    openedBy: (row.opened_by as string | null) ?? null,
    closedBy: (row.closed_by as string | null) ?? null,
    openedAt: String(row.opened_at ?? row.created_at ?? ""),
    closedAt: (row.closed_at as string | null) ?? null,
    items: items.map(mapItem).sort((a, b) => a.sortOrder - b.sortOrder),
    payments: payments.map(mapPayment),
  };
}

const ORDER_SELECT = `
  *,
  pos_tables ( name ),
  rooms ( room_number ),
  pos_order_items ( * ),
  pos_payments ( * )
`;

async function fetchOrderNumber(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.rpc("next_pos_order_number");
  if (!error && data) return String(data);
  const stamp = new Date();
  const y = String(stamp.getFullYear()).slice(-2);
  const m = String(stamp.getMonth() + 1).padStart(2, "0");
  const d = String(stamp.getDate()).padStart(2, "0");
  return `POS-${y}${m}${d}-${String(Date.now()).slice(-4)}`;
}

function calcTotals(
  items: SavePosOrderInput["items"],
  discountAmount = 0,
  taxRate = 0,
) {
  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.unitPrice) * Number(i.quantity),
    0,
  );
  const discount = Math.min(Math.max(0, discountAmount), subtotal);
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(taxable * (taxRate / 100) * 100) / 100;
  const totalAmount = Math.round((taxable + taxAmount) * 100) / 100;
  return { subtotal, discountAmount: discount, taxAmount, totalAmount };
}

function isMissingRelationError(error: { code?: string; message?: string }) {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

function isMissingColumnError(error: { code?: string; message?: string }, column: string) {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    message.includes(column.toLowerCase())
  );
}

async function recordStockMovement(
  supabase: ReturnType<typeof createClient>,
  input: {
    productId: string;
    type: PosStockMovementType;
    quantity: number;
    qtyBefore: number;
    qtyAfter: number;
    reason?: string | null;
    referenceNo?: string | null;
    note?: string | null;
  },
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("pos_stock_movements").insert({
    id: newId(),
    product_id: input.productId,
    type: input.type,
    quantity: stockQty(input.quantity),
    qty_before: stockQty(input.qtyBefore),
    qty_after: stockQty(input.qtyAfter),
    reason: input.reason ?? null,
    reference_no: input.referenceNo ?? null,
    note: input.note ?? null,
    created_by: user?.id ?? null,
  });
  if (error && !isMissingRelationError(error)) throw error;
}

async function applyProductStockDelta(
  supabase: ReturnType<typeof createClient>,
  input: {
    productId: string;
    delta: number;
    type: PosStockMovementType;
    reason?: string | null;
    referenceNo?: string | null;
    note?: string | null;
    enableTracking?: boolean;
    countedQty?: number;
  },
) {
  const { data: product, error } = await supabase
    .from("pos_products")
    .select("track_stock, stock_qty")
    .eq("id", input.productId)
    .maybeSingle();
  if (error) throw error;
  if (!product) throw new Error("Product not found.");

  const tracking = Boolean(product.track_stock) || Boolean(input.enableTracking);
  if (!tracking) return null;

  const current = stockQty(Number(product.stock_qty ?? 0));
  const delta =
    input.type === "count" && input.countedQty != null
      ? stockQty(input.countedQty) - current
      : stockQty(input.delta);
  const next = stockQty(Math.max(0, current + delta));
  const patch: Record<string, unknown> = {
    stock_qty: next,
    updated_at: new Date().toISOString(),
  };
  if (input.enableTracking && !product.track_stock) patch.track_stock = true;

  const { error: updErr } = await supabase
    .from("pos_products")
    .update(patch)
    .eq("id", input.productId);
  if (updErr) throw updErr;

  await recordStockMovement(supabase, {
    productId: input.productId,
    type: input.type,
    quantity: delta,
    qtyBefore: current,
    qtyAfter: next,
    reason: input.reason,
    referenceNo: input.referenceNo,
    note: input.note,
  });
  return { qtyBefore: current, qtyAfter: next, delta };
}

async function replaceOrderItems(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  items: SavePosOrderInput["items"],
) {
  await supabase.from("pos_order_items").delete().eq("order_id", orderId);
  if (!items.length) return;
  const rows = items.map((item, idx) => ({
    id: newId(),
    order_id: orderId,
    product_id: item.productId,
    product_name: item.productName,
    unit_price: item.unitPrice,
    quantity: item.quantity,
    line_total: Math.round(item.unitPrice * item.quantity * 100) / 100,
    notes: item.notes ?? null,
    sort_order: idx,
  }));
  const { error } = await supabase.from("pos_order_items").insert(rows);
  if (error) throw error;
}

async function adjustStock(
  supabase: ReturnType<typeof createClient>,
  items: SavePosOrderInput["items"],
  direction: "decrement" | "increment",
  referenceNo?: string | null,
) {
  for (const item of items) {
    if (!item.productId) continue;
    const qty = Number(item.quantity);
    if (!qty) continue;
    await applyProductStockDelta(supabase, {
      productId: item.productId,
      delta: direction === "decrement" ? -qty : qty,
      type: direction === "decrement" ? "sale" : "void_sale",
      referenceNo: referenceNo ?? null,
      note: item.productName,
    });
  }
}

// --- Categories ---

export function usePosCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: async () => {
      const supabase = createClient();
      const userId = await currentUserId();
      const { data, error } = await supabase
        .from("pos_categories")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return dedupePreferOwnTenant(
        (data ?? []) as Record<string, unknown>[],
        userId,
        (row) => String(row.name ?? "").trim().toLowerCase(),
        mapCategory,
      );
    },
  });
}

export function useCreatePosCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePosCategoryInput) => {
      const supabase = createClient();
      const id = newId();
      const { error } = await supabase.from("pos_categories").insert({
        id,
        name: input.name.trim(),
        description: input.description ?? null,
        sort_order: input.sortOrder ?? 0,
        color: input.color ?? null,
        is_active: input.isActive ?? true,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.categories }),
  });
}

export function useUpdatePosCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePosCategoryInput) => {
      const supabase = createClient();
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.description !== undefined) patch.description = input.description;
      if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
      if (input.color !== undefined) patch.color = input.color;
      if (input.isActive !== undefined) patch.is_active = input.isActive;
      const { error } = await supabase
        .from("pos_categories")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories });
      qc.invalidateQueries({ queryKey: qk.products });
    },
  });
}

export function useDeletePosCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("pos_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories });
      qc.invalidateQueries({ queryKey: qk.products });
    },
  });
}

// --- Products ---

export function usePosProducts() {
  return useQuery({
    queryKey: qk.products,
    queryFn: async () => {
      const supabase = createClient();
      const userId = await currentUserId();
      const { data, error } = await supabase
        .from("pos_products")
        .select("*, pos_categories ( name )")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return dedupePreferOwnTenant(
        (data ?? []) as Record<string, unknown>[],
        userId,
        (row) => {
          const sku = String(row.sku ?? "").trim().toLowerCase();
          if (sku) return `sku:${sku}`;
          const name = String(row.name ?? "").trim().toLowerCase();
          const price = Number(row.price ?? 0);
          return `name:${name}|${price}`;
        },
        mapProduct,
      );
    },
  });
}

export function useCreatePosProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePosProductInput) => {
      const supabase = createClient();
      const id = newId();
      const { error } = await supabase.from("pos_products").insert({
        id,
        category_id: input.categoryId ?? null,
        sku: input.sku?.trim() || null,
        name: input.name.trim(),
        description: input.description ?? null,
        price: input.price,
        cost: input.cost ?? 0,
        track_stock: input.trackStock ?? false,
        stock_qty: input.stockQty ?? 0,
        reorder_point: input.reorderPoint ?? DEFAULT_REORDER_POINT,
        unit: input.unit ?? "each",
        is_active: input.isActive ?? true,
        is_quick_sell: input.isQuickSell ?? false,
        sort_order: input.sortOrder ?? 0,
      });
      if (error) {
        if (isMissingColumnError(error, "reorder_point")) {
          const { error: retryErr } = await supabase.from("pos_products").insert({
            id,
            category_id: input.categoryId ?? null,
            sku: input.sku?.trim() || null,
            name: input.name.trim(),
            description: input.description ?? null,
            price: input.price,
            cost: input.cost ?? 0,
            track_stock: input.trackStock ?? false,
            stock_qty: input.stockQty ?? 0,
            unit: input.unit ?? "each",
            is_active: input.isActive ?? true,
            is_quick_sell: input.isQuickSell ?? false,
            sort_order: input.sortOrder ?? 0,
          });
          if (retryErr) throw retryErr;
        } else {
          throw error;
        }
      }
      const opening = Number(input.stockQty ?? 0);
      if (input.trackStock && opening > 0) {
        await recordStockMovement(supabase, {
          productId: id,
          type: "receive",
          quantity: opening,
          qtyBefore: 0,
          qtyAfter: opening,
          reason: "opening",
          note: "Opening stock",
        });
      }
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.products });
      qc.invalidateQueries({ queryKey: qk.movements });
    },
  });
}

export function useUpdatePosProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePosProductInput) => {
      const supabase = createClient();
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.categoryId !== undefined) patch.category_id = input.categoryId;
      if (input.sku !== undefined) patch.sku = input.sku?.trim() || null;
      if (input.description !== undefined) patch.description = input.description;
      if (input.price !== undefined) patch.price = input.price;
      if (input.cost !== undefined) patch.cost = input.cost;
      if (input.trackStock !== undefined) patch.track_stock = input.trackStock;
      if (input.stockQty !== undefined) patch.stock_qty = input.stockQty;
      if (input.reorderPoint !== undefined) patch.reorder_point = input.reorderPoint;
      if (input.unit !== undefined) patch.unit = input.unit;
      if (input.isActive !== undefined) patch.is_active = input.isActive;
      if (input.isQuickSell !== undefined) patch.is_quick_sell = input.isQuickSell;
      if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
      const { error } = await supabase
        .from("pos_products")
        .update(patch)
        .eq("id", input.id);
      if (error) {
        if (patch.reorder_point !== undefined && isMissingColumnError(error, "reorder_point")) {
          delete patch.reorder_point;
          const { error: retryErr } = await supabase
            .from("pos_products")
            .update(patch)
            .eq("id", input.id);
          if (retryErr) throw retryErr;
        } else {
          throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.products });
      qc.invalidateQueries({ queryKey: qk.movements });
    },
  });
}

export function useDeletePosProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("pos_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.products }),
  });
}

// --- Tables ---

export function usePosTables() {
  return useQuery({
    queryKey: qk.tables,
    queryFn: async () => {
      const supabase = createClient();
      const userId = await currentUserId();
      const [{ data: tables, error }, { data: openOrders }] = await Promise.all([
        supabase
          .from("pos_tables")
          .select("*")
          .order("sort_order")
          .order("name"),
        supabase
          .from("pos_orders")
          .select("id, order_number, table_id")
          .in("status", ["open", "held"])
          .not("table_id", "is", null),
      ]);
      if (error) throw error;
      const byTable = new Map(
        (openOrders ?? []).map((o) => [
          String(o.table_id),
          { id: String(o.id), number: String(o.order_number) },
        ]),
      );
      const deduped = dedupePreferOwnTenant(
        (tables ?? []) as Record<string, unknown>[],
        userId,
        (row) => String(row.name ?? "").trim().toLowerCase(),
        mapTable,
      );
      return deduped.map((t) => {
        const open = byTable.get(t.id);
        return {
          ...t,
          openOrderId: open?.id ?? null,
          openOrderNumber: open?.number ?? null,
        };
      });
    },
  });
}

export function useCreatePosTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePosTableInput) => {
      const supabase = createClient();
      const id = newId();
      const { error } = await supabase.from("pos_tables").insert({
        id,
        name: input.name.trim(),
        zone: input.zone ?? "Main",
        seats: input.seats ?? 4,
        status: input.status ?? "available",
        notes: input.notes ?? null,
        sort_order: input.sortOrder ?? 0,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tables }),
  });
}

export function useUpdatePosTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePosTableInput) => {
      const supabase = createClient();
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.zone !== undefined) patch.zone = input.zone;
      if (input.seats !== undefined) patch.seats = input.seats;
      if (input.status !== undefined) patch.status = input.status;
      if (input.notes !== undefined) patch.notes = input.notes;
      if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
      const { error } = await supabase
        .from("pos_tables")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tables }),
  });
}

export function useDeletePosTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("pos_tables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tables }),
  });
}

// --- Orders ---

export function usePosOrders(statusFilter?: string) {
  return useQuery({
    queryKey: qk.orders(statusFilter),
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("pos_orders")
        .select(ORDER_SELECT)
        .order("opened_at", { ascending: false })
        .limit(200);
      if (statusFilter && statusFilter !== "all") {
        if (statusFilter === "active") {
          query = query.in("status", ["open", "held"]);
        } else {
          query = query.eq("status", statusFilter);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((r) => mapOrder(r as Record<string, unknown>));
    },
  });
}

export function usePosOrder(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.order(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pos_orders")
        .select(ORDER_SELECT)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return mapOrder(data as Record<string, unknown>);
    },
  });
}

export function useSavePosOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SavePosOrderInput) => {
      if (!input.items.length && input.status !== "held") {
        throw new Error("Add at least one item.");
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const totals = calcTotals(
        input.items,
        input.discountAmount ?? 0,
        input.taxRate ?? 0,
      );
      const now = new Date().toISOString();
      let orderId = input.orderId ?? null;

      if (orderId) {
        const { error } = await supabase
          .from("pos_orders")
          .update({
            status: input.status,
            order_type: input.orderType,
            table_id: input.tableId ?? null,
            room_id: input.roomId ?? null,
            customer_name: input.customerName ?? null,
            notes: input.notes ?? null,
            subtotal: totals.subtotal,
            discount_amount: totals.discountAmount,
            tax_amount: totals.taxAmount,
            total_amount: totals.totalAmount,
            updated_at: now,
            ...(input.status === "paid"
              ? {
                  paid_amount: totals.totalAmount,
                  closed_at: now,
                  closed_by: user?.id ?? null,
                }
              : {}),
          })
          .eq("id", orderId);
        if (error) throw error;
        await replaceOrderItems(supabase, orderId, input.items);
      } else {
        orderId = newId();
        const orderNumber = await fetchOrderNumber(supabase);
        const { error } = await supabase.from("pos_orders").insert({
          id: orderId,
          order_number: orderNumber,
          status: input.status,
          order_type: input.orderType,
          table_id: input.tableId ?? null,
          room_id: input.roomId ?? null,
          customer_name: input.customerName ?? null,
          notes: input.notes ?? null,
          subtotal: totals.subtotal,
          discount_amount: totals.discountAmount,
          tax_amount: totals.taxAmount,
          total_amount: totals.totalAmount,
          paid_amount: input.status === "paid" ? totals.totalAmount : 0,
          opened_by: user?.id ?? null,
          closed_by: input.status === "paid" ? user?.id ?? null : null,
          closed_at: input.status === "paid" ? now : null,
          opened_at: now,
        });
        if (error) throw error;
        await replaceOrderItems(supabase, orderId, input.items);
      }

      if (input.tableId) {
        const tableStatus =
          input.status === "paid" || input.status === "held"
            ? input.status === "paid"
              ? "dirty"
              : "occupied"
            : "occupied";
        await supabase
          .from("pos_tables")
          .update({
            status: tableStatus,
            updated_at: now,
          })
          .eq("id", input.tableId);
      }

      if (input.status === "paid" && input.payment) {
        const { error: payErr } = await supabase.from("pos_payments").insert({
          id: newId(),
          order_id: orderId,
          amount: input.payment.amount,
          method: input.payment.method,
          reference_no: input.payment.referenceNo ?? null,
          note: input.payment.note ?? null,
          received_by: user?.id ?? null,
        });
        if (payErr) throw payErr;
        await adjustStock(supabase, input.items, "decrement", orderId);
      }

      return { orderId, ...totals };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos"] });
    },
  });
}

export function useVoidPosOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const supabase = createClient();
      const { data: order, error: fetchErr } = await supabase
        .from("pos_orders")
        .select("*, pos_order_items ( * )")
        .eq("id", orderId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!order) throw new Error("Order not found");
      if (order.status === "void") return;
      if (order.status === "paid") {
        throw new Error("Paid orders cannot be voided. Use refund workflow.");
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("pos_orders")
        .update({ status: "void", closed_at: now, updated_at: now })
        .eq("id", orderId);
      if (error) throw error;

      if (order.table_id) {
        await supabase
          .from("pos_tables")
          .update({ status: "available", updated_at: now })
          .eq("id", order.table_id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos"] }),
  });
}

export async function fetchPosSalesSummary(
  fromIso: string,
  toIso = fromIso,
): Promise<PosSalesSummary> {
  const supabase = createClient();
  const startLocal = new Date(`${fromIso}T00:00:00`);
  const endLocal = new Date(`${toIso}T00:00:00`);
  endLocal.setDate(endLocal.getDate() + 1);
  const start = startLocal.toISOString();
  const end = endLocal.toISOString();

  const [openedRes, closedRes] = await Promise.all([
    supabase
      .from("pos_orders")
      .select(ORDER_SELECT)
      .gte("opened_at", start)
      .lt("opened_at", end)
      .order("opened_at", { ascending: false })
      .limit(1500),
    supabase
      .from("pos_orders")
      .select(ORDER_SELECT)
      .gte("closed_at", start)
      .lt("closed_at", end)
      .order("closed_at", { ascending: false })
      .limit(1500),
  ]);
  if (openedRes.error) throw openedRes.error;
  if (closedRes.error) throw closedRes.error;

  const byId = new Map<string, PosOrder>();
  for (const row of [...(openedRes.data ?? []), ...(closedRes.data ?? [])]) {
    const order = mapOrder(row as Record<string, unknown>);
    byId.set(order.id, order);
  }
  const orders = [...byId.values()].sort(
    (a, b) =>
      new Date(b.closedAt ?? b.openedAt).getTime() -
      new Date(a.closedAt ?? a.openedAt).getTime(),
  );
  return summarizePosOrders(orders, fromIso, toIso);
}

export function usePosSalesSummary(fromIso: string, toIso?: string, enabled = true) {
  const to = toIso ?? fromIso;
  return useQuery({
    queryKey: qk.sales(`${fromIso}:${to}`),
    enabled: Boolean(enabled && fromIso && to),
    queryFn: () => fetchPosSalesSummary(fromIso, to),
  });
}

function mapStockMovement(row: Record<string, unknown>): PosStockMovement {
  const product = row.pos_products as { name?: string; sku?: string | null } | null;
  return {
    id: String(row.id),
    productId: String(row.product_id ?? ""),
    productName: product?.name ?? "",
    sku: product?.sku ?? null,
    type: String(row.type ?? "adjust") as PosStockMovementType,
    quantity: Number(row.quantity ?? 0),
    qtyBefore: Number(row.qty_before ?? 0),
    qtyAfter: Number(row.qty_after ?? 0),
    reason: (row.reason as string | null) ?? null,
    referenceNo: (row.reference_no as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
  };
}

export function usePosStockMovements(productId?: string | null) {
  return useQuery({
    queryKey: [...qk.movements, productId ?? "all"],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("pos_stock_movements")
        .select("*, pos_products ( name, sku )")
        .order("created_at", { ascending: false })
        .limit(200);
      if (productId) query = query.eq("product_id", productId);
      const { data, error } = await query;
      if (error) {
        if (isMissingRelationError(error)) return [] as PosStockMovement[];
        throw error;
      }
      return (data ?? []).map((row) => mapStockMovement(row as Record<string, unknown>));
    },
  });
}

export function useAdjustPosStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdjustPosStockInput) => {
      const qty = stockQty(Number(input.quantity));
      if (input.type !== "count" && stockQty(Math.abs(qty)) <= 0) {
        throw new Error("Enter a quantity greater than zero.");
      }
      if (input.type === "count" && (input.countedQty == null || !Number.isFinite(input.countedQty))) {
        throw new Error("Enter the counted on-hand quantity.");
      }
      const supabase = createClient();
      const wasteLike =
        input.type === "waste" ||
        input.reason === "spoilage" ||
        input.reason === "damage" ||
        input.reason === "theft";
      const type: PosStockMovementType =
        wasteLike && input.type !== "receive" && input.type !== "count" ? "waste" : input.type;
      const delta =
        type === "receive"
          ? Math.abs(qty)
          : type === "waste"
            ? -Math.abs(qty)
            : type === "count"
              ? 0
              : qty;
      const result = await applyProductStockDelta(supabase, {
        productId: input.productId,
        delta,
        type,
        countedQty: input.type === "count" ? stockQty(Number(input.countedQty)) : undefined,
        reason: input.reason ?? null,
        referenceNo: input.referenceNo ?? null,
        note: input.note ?? null,
        enableTracking: input.enableTracking ?? (type === "receive" || type === "count"),
      });
      if (!result) {
        throw new Error("This product is not tracking stock. Start tracking first.");
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.products });
      qc.invalidateQueries({ queryKey: qk.movements });
    },
  });
}

export function formatPeso(amount: number) {
  return `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
