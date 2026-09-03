/** POS domain types (camelCase for UI) */

export type PosCategory = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  color: string | null;
};

export type PosProduct = {
  id: string;
  categoryId: string | null;
  categoryName?: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  trackStock: boolean;
  stockQty: number;
  reorderPoint: number;
  unit: string;
  isActive: boolean;
  isQuickSell: boolean;
  sortOrder: number;
  imageUrl: string | null;
};

export type PosTableStatus =
  | "available"
  | "occupied"
  | "reserved"
  | "dirty"
  | "inactive";

export type PosTable = {
  id: string;
  name: string;
  zone: string;
  seats: number;
  status: PosTableStatus;
  posX: number | null;
  posY: number | null;
  sortOrder: number;
  notes: string | null;
  openOrderId?: string | null;
  openOrderNumber?: string | null;
};

export type PosOrderStatus = "open" | "held" | "paid" | "void" | "refunded";
export type PosOrderType =
  | "walk_in"
  | "dine_in"
  | "takeout"
  | "room_charge"
  | "other";

export type PosPaymentMethod =
  | "cash"
  | "card"
  | "gcash"
  | "maya"
  | "bank_transfer"
  | "room_charge"
  | "other";

export type PosOrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  notes: string | null;
  sortOrder: number;
};

export type PosPayment = {
  id: string;
  orderId: string;
  amount: number;
  method: PosPaymentMethod | string;
  referenceNo: string | null;
  note: string | null;
  receivedBy: string | null;
  createdAt: string;
};

export type PosOrder = {
  id: string;
  orderNumber: string;
  status: PosOrderStatus;
  orderType: PosOrderType;
  tableId: string | null;
  tableName?: string | null;
  guestId: string | null;
  reservationId: string | null;
  roomId: string | null;
  roomNumber?: string | null;
  customerName: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  notes: string | null;
  openedBy: string | null;
  closedBy: string | null;
  openedAt: string;
  closedAt: string | null;
  items: PosOrderItem[];
  payments: PosPayment[];
};

export type PosCartLine = {
  key: string;
  productId: string | null;
  productName: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  trackStock?: boolean;
  stockQty?: number;
};

export type CreatePosCategoryInput = {
  name: string;
  description?: string | null;
  sortOrder?: number;
  color?: string | null;
  isActive?: boolean;
};

export type UpdatePosCategoryInput = Partial<CreatePosCategoryInput> & {
  id: string;
};

export type CreatePosProductInput = {
  name: string;
  categoryId?: string | null;
  sku?: string | null;
  description?: string | null;
  price: number;
  cost?: number;
  trackStock?: boolean;
  stockQty?: number;
  reorderPoint?: number;
  unit?: string;
  isActive?: boolean;
  isQuickSell?: boolean;
  sortOrder?: number;
};

export type UpdatePosProductInput = Partial<CreatePosProductInput> & {
  id: string;
};

export type CreatePosTableInput = {
  name: string;
  zone?: string;
  seats?: number;
  status?: PosTableStatus;
  notes?: string | null;
  sortOrder?: number;
};

export type UpdatePosTableInput = Partial<CreatePosTableInput> & {
  id: string;
};

export type SavePosOrderInput = {
  orderId?: string | null;
  orderType: PosOrderType;
  tableId?: string | null;
  roomId?: string | null;
  customerName?: string | null;
  notes?: string | null;
  discountAmount?: number;
  taxRate?: number;
  status: "open" | "held" | "paid";
  items: Array<{
    productId: string | null;
    productName: string;
    unitPrice: number;
    quantity: number;
    notes?: string | null;
  }>;
  payment?: {
    amount: number;
    method: PosPaymentMethod;
    referenceNo?: string | null;
    note?: string | null;
  } | null;
};

export type PosStockMovementType =
  | "receive"
  | "adjust"
  | "count"
  | "sale"
  | "void_sale"
  | "waste";

export type PosStockMovement = {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  type: PosStockMovementType;
  quantity: number;
  qtyBefore: number;
  qtyAfter: number;
  reason: string | null;
  referenceNo: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type AdjustPosStockInput = {
  productId: string;
  type: Exclude<PosStockMovementType, "sale" | "void_sale">;
  quantity: number;
  countedQty?: number;
  reason?: string | null;
  referenceNo?: string | null;
  note?: string | null;
  enableTracking?: boolean;
};
