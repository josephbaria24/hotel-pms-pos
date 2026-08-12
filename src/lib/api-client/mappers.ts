import type {
  ActivityItem,
  Guest,
  Housekeeper,
  Payment,
  Reservation,
  Room,
  RoomOption,
  Settings,
  User,
} from "./types";

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;

export function mapGuest(
  row: Record<string, unknown>,
  stayCount = 0,
): Guest {
  const firstName = String(row.first_name ?? "");
  const lastName = String(row.last_name ?? "");
  return {
    id: String(row.id),
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    contactNumber: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    idType: (row.id_type as string | null) ?? null,
    idNumber: (row.id_number as string | null) ?? null,
    nationality: (row.nationality as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    totalStays: stayCount,
  };
}

export function mapRoom(row: Record<string, unknown>): Room {
  return {
    id: String(row.id),
    roomNumber: String(row.room_number ?? ""),
    type: String(row.type ?? ""),
    floor: (row.floor as string | null) ?? null,
    capacity: Number(row.capacity ?? 1),
    pricePerNight: Number(row.rate ?? 0),
    status: String(row.status ?? "available"),
    notes: (row.notes as string | null) ?? null,
    condition: String(row.condition ?? "clean"),
    doNotDisturb: Boolean(row.do_not_disturb),
    assignedHousekeeperId: (row.assigned_housekeeper_id as string | null) ?? null,
  };
}

export function mapRoomOption(row: Record<string, unknown>): RoomOption {
  return {
    id: String(row.id),
    value: String(row.value ?? ""),
    disablesRoom: Boolean(row.disables_room),
  };
}

export function mapHousekeeper(row: Record<string, unknown>): Housekeeper {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    phone: (row.phone as string | null) ?? null,
    status: String(row.status ?? "active"),
  };
}

export function mapReservation(
  row: Record<string, unknown>,
  guestName = "",
  roomNumber = "",
): Reservation {
  const totalAmount = Number(row.total_amount ?? 0);
  const paidAmount = Number(row.paid_amount ?? 0);
  return {
    id: String(row.id),
    reservationNumber: String(row.reservation_number ?? ""),
    guestId: String(row.guest_id ?? ""),
    roomId: String(row.room_id ?? ""),
    guestName,
    roomNumber,
    checkInDate: String(row.check_in_date ?? "").slice(0, 10),
    checkOutDate: String(row.check_out_date ?? "").slice(0, 10),
    adults: Number(row.adults ?? 1),
    children: Number(row.children ?? 0),
    status: String(row.status ?? "reserved"),
    source: (row.source as string | null) ?? null,
    totalAmount,
    paidAmount,
    balance: Math.max(0, totalAmount - paidAmount),
    notes: (row.notes as string | null) ?? null,
    actualCheckInAt: (row.actual_check_in_at as string | null) ?? null,
    actualCheckOutAt: (row.actual_check_out_at as string | null) ?? null,
  };
}

export function mapPayment(
  row: Record<string, unknown>,
  guestName = "",
  roomNumber = "",
): Payment {
  const method = String(row.method ?? "cash");
  return {
    id: String(row.id),
    reservationId: String(row.reservation_id ?? ""),
    amount: Number(row.amount ?? 0),
    paymentMethod: method,
    method,
    referenceNo: (row.reference_no as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    receivedBy: (row.received_by as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    receiptNumber: `RCP-${String(row.id).slice(0, 8).toUpperCase()}`,
    guestName,
    roomNumber,
  };
}

export function mapSettings(row: Record<string, unknown>): Settings {
  return {
    id: String(row.id ?? "main"),
    hotelName: String(row.hotel_name ?? "PalawanSU Hotel"),
    address: String(row.address ?? ""),
    contactNumber: String(row.contact_number ?? ""),
    email: String(row.email ?? ""),
    checkInTime: String(row.check_in_time ?? "14:00"),
    checkOutTime: String(row.check_out_time ?? "12:00"),
    currency: String(row.currency ?? "Peso"),
    taxRate: Number(row.tax_rate ?? 0),
  };
}

export function mapUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    username: String(row.username ?? ""),
    fullName: String(row.full_name ?? ""),
    role: String(row.role ?? "staff"),
    isActive: Boolean(row.is_active ?? true),
    password: "",
  };
}

export function mapActivity(row: Record<string, unknown>): ActivityItem {
  const action = String(row.action ?? "").toLowerCase();
  let type: ActivityItem["type"] = "reservation";
  if (action.includes("check in")) type = "check_in";
  else if (action.includes("check out")) type = "check_out";
  else if (action.includes("cancel")) type = "cancellation";
  else if (action.includes("payment")) type = "payment";
  else if (action.includes("created")) type = "reservation";

  return {
    id: String(row.id),
    type,
    description: String(row.details ?? row.action ?? ""),
    timestamp: String(row.created_at ?? new Date().toISOString()),
    reservationNumber:
      row.entity === "reservation" ? String(row.entity_id ?? "") : undefined,
  };
}
