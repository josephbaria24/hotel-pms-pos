export type OccupancyRoomInput = {
  id?: string;
  roomNumber: string;
  status?: string | null;
};

export type OccupancyReservationInput = {
  roomId?: string;
  roomNumber: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
};

export type OccupancyCounts = {
  total: number;
  occupied: number;
  reserved: number;
  vacant: number;
  occupancyRate: number;
};

export function ymd(value: string): string {
  return String(value ?? "").slice(0, 10);
}

export function roomNumberKey(value: string): string {
  return value.trim().toLowerCase();
}

function isInactiveStay(status: string): boolean {
  return status === "cancelled" || status === "no_show";
}

/** In-house tonight, including checkout day until the stay is checked out. */
export function isOccupiedTonight(
  status: string,
  checkInDate: string,
  checkOutDate: string,
  today: string,
): boolean {
  if (status !== "checked_in") return false;
  const inD = ymd(checkInDate);
  const outD = ymd(checkOutDate);
  return Boolean(inD && outD && inD <= today && outD >= today);
}

/** Reserved stay that still holds the room: covering tonight or arriving later. */
export function isReservedHold(
  status: string,
  checkOutDate: string,
  today: string,
): boolean {
  if (status !== "reserved") return false;
  const outD = ymd(checkOutDate);
  return Boolean(outD && outD > today);
}

/**
 * Vacant / occupied / reserved by unique room number.
 * Occupied and reserved come from reservations, not `rooms.status`,
 * because creating a booking leaves the room row as `available`.
 */
export function computeOccupancyCounts(
  rooms: OccupancyRoomInput[],
  reservations: OccupancyReservationInput[],
  today: string,
): OccupancyCounts {
  const numberById = new Map<string, string>();
  for (const room of rooms) {
    if (!room.id) continue;
    const key = roomNumberKey(room.roomNumber);
    if (key) numberById.set(room.id, key);
  }

  const byRoom = new Map<string, OccupancyReservationInput[]>();
  for (const res of reservations) {
    if (isInactiveStay(res.status)) continue;
    const key =
      roomNumberKey(res.roomNumber) ||
      (res.roomId ? numberById.get(res.roomId) ?? "" : "");
    if (!key) continue;
    const list = byRoom.get(key);
    if (list) list.push(res);
    else byRoom.set(key, [res]);
  }

  let occupied = 0;
  let reserved = 0;
  const seen = new Set<string>();

  for (const room of rooms) {
    const key = roomNumberKey(room.roomNumber);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const list = byRoom.get(key) ?? [];
    const occupiedStay = list.some((r) =>
      isOccupiedTonight(r.status, r.checkInDate, r.checkOutDate, today),
    );
    const reservedStay = list.some((r) => isReservedHold(r.status, r.checkOutDate, today));

    if (occupiedStay || room.status === "occupied") occupied += 1;
    else if (reservedStay) reserved += 1;
  }

  const total = seen.size;
  const vacant = Math.max(0, total - occupied - reserved);
  const occupancyRate =
    total > 0 ? Math.round(((occupied + reserved) / total) * 1000) / 10 : 0;

  return { total, occupied, reserved, vacant, occupancyRate };
}
