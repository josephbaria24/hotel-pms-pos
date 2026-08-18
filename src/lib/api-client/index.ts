"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  mapActivity,
  mapGuest,
  mapHousekeeper,
  mapPayment,
  mapReservation,
  mapRoom,
  mapRoomOption,
  mapSettings,
  mapUser,
  newId,
} from "./mappers";
import type {
  ClassroomUser,
  CreateReservationPayload,
  CreateRoomPayload,
  Guest,
  OperationMode,
  Payment,
  Reservation,
  Room,
  RoomOptionKind,
  Settings,
  User,
} from "./types";

export * from "./types";

const qk = {
  guests: ["guests"] as const,
  rooms: ["rooms"] as const,
  reservations: ["reservations"] as const,
  payments: ["payments"] as const,
  settings: ["settings"] as const,
  users: ["users"] as const,
  housekeepers: ["housekeepers"] as const,
  roomOptions: (kind: string) => ["room-options", kind] as const,
  dashboardSummary: ["dashboard-summary"] as const,
  occupancy: ["occupancy"] as const,
  activity: ["activity"] as const,
  revenue: ["revenue"] as const,
  reservationReport: ["reservation-report"] as const,
  classroom: ["admin", "classroom"] as const,
  operationMode: ["admin", "operation-mode"] as const,
};

export const getListGuestsQueryKey = () => qk.guests;
export const getListRoomsQueryKey = () => qk.rooms;
export const getListReservationsQueryKey = () => qk.reservations;
export const getListPaymentsQueryKey = () => qk.payments;
export const getListUsersQueryKey = () => qk.users;
export const getRoomOptionsQueryKey = (kind: RoomOptionKind) =>
  qk.roomOptions(kind);

const FALLBACK_CONDITION_OPTIONS = [
  { id: "builtin-clean", value: "clean", disablesRoom: false },
  { id: "builtin-dirty", value: "dirty", disablesRoom: false },
];

function roomOptionsTable(kind: RoomOptionKind) {
  if (kind === "type") return "room_type_options";
  if (kind === "status") return "room_status_options";
  return "room_condition_options";
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

async function logActivity(
  action: string,
  entity: string,
  entityId?: string,
  details?: string,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("activity_logs").insert({
    id: newId(),
    user_id: user?.id ?? null,
    action,
    entity,
    entity_id: entityId ?? null,
    details: details ?? null,
  });
}

async function fetchReservationViews(): Promise<Reservation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(
      `*, guests ( first_name, last_name ), rooms ( room_number )`,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const g = row.guests as { first_name?: string; last_name?: string } | null;
    const r = row.rooms as { room_number?: string } | null;
    const guestName = g
      ? `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim()
      : "";
    return mapReservation(row as Record<string, unknown>, guestName, r?.room_number ?? "");
  });
}

async function fetchPaymentViews(): Promise<Payment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      `*, reservations ( reservation_number, guests ( first_name, last_name ), rooms ( room_number ) )`,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const res = row.reservations as {
      reservation_number?: string;
      guests?: { first_name?: string; last_name?: string } | null;
      rooms?: { room_number?: string } | null;
    } | null;
    const guestName = res?.guests
      ? `${res.guests.first_name ?? ""} ${res.guests.last_name ?? ""}`.trim()
      : "";
    return mapPayment(
      row as Record<string, unknown>,
      guestName,
      res?.rooms?.room_number ?? "",
      res?.reservation_number ?? "",
    );
  });
}

/* ─── Auth (legacy stubs; real auth is Supabase AuthProvider) ─── */

export function useLogin() {
  return useMutation({
    mutationFn: async () => {
      throw new Error("Use Supabase email login on /login");
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
    },
  });
}

/* ─── Guests ─── */

export function useListGuests() {
  return useQuery({
    queryKey: qk.guests,
    queryFn: async (): Promise<Guest[]> => {
      const supabase = createClient();
      const [{ data: guests, error }, { data: reservations }] = await Promise.all([
        supabase.from("guests").select("*").order("created_at", { ascending: false }),
        supabase.from("reservations").select("guest_id, status"),
      ]);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const r of reservations ?? []) {
        if (r.status === "cancelled") continue;
        counts.set(r.guest_id, (counts.get(r.guest_id) ?? 0) + 1);
      }
      return (guests ?? []).map((g) =>
        mapGuest(g as Record<string, unknown>, counts.get(String(g.id)) ?? 0),
      );
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
  });
}

export function useUpdateGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      firstName?: string;
      lastName?: string;
      contactNumber?: string;
      email?: string;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("guests")
        .update({
          first_name: input.firstName,
          last_name: input.lastName,
          phone: input.contactNumber,
          email: input.email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.guests }),
  });
}

export function useDeleteGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("guests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.guests }),
  });
}

export async function prefetchGuestHubBookingsData(qc: QueryClient) {
  await qc.prefetchQuery({
    queryKey: qk.reservations,
    queryFn: fetchReservationViews,
    staleTime: 5 * 60_000,
  });
}
export async function prefetchGuestHubStaysData(qc: QueryClient) {
  await qc.prefetchQuery({
    queryKey: qk.reservations,
    queryFn: fetchReservationViews,
    staleTime: 5 * 60_000,
  });
}

export async function prefetchGuestHubDirectoryData(qc: QueryClient) {
  await qc.prefetchQuery({
    queryKey: qk.guests,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Guest[]> => {
      const supabase = createClient();
      const [{ data: guests, error }, { data: reservations }] = await Promise.all([
        supabase.from("guests").select("*").order("created_at", { ascending: false }),
        supabase.from("reservations").select("guest_id, status"),
      ]);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const r of reservations ?? []) {
        if (r.status === "cancelled") continue;
        counts.set(r.guest_id, (counts.get(r.guest_id) ?? 0) + 1);
      }
      return (guests ?? []).map((g) =>
        mapGuest(g as Record<string, unknown>, counts.get(String(g.id)) ?? 0),
      );
    },
  });
}

/* ─── Rooms ─── */

export function useListRooms() {
  return useQuery({
    queryKey: qk.rooms,
    queryFn: async (): Promise<Room[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id;
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("room_number");
      if (error) throw error;
      // Lab mode: own + admin rooms can share room numbers — keep one (prefer own).
      const rows = [...(data ?? [])].sort((a, b) => {
        const aOwn = String((a as { tenant_id?: string }).tenant_id ?? "") === userId ? 0 : 1;
        const bOwn = String((b as { tenant_id?: string }).tenant_id ?? "") === userId ? 0 : 1;
        return aOwn - bOwn;
      });
      const seen = new Set<string>();
      const out: Room[] = [];
      for (const row of rows) {
        const num = String((row as { room_number?: string }).room_number ?? "")
          .trim()
          .toLowerCase();
        if (!num || seen.has(num)) continue;
        seen.add(num);
        out.push(mapRoom(row as Record<string, unknown>));
      }
      return out;
    },
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRoomPayload) => {
      const supabase = createClient();
      const { error } = await supabase.from("rooms").insert({
        id: newId(),
        room_number: payload.roomNumber,
        type: payload.type,
        capacity: payload.capacity,
        rate: payload.pricePerNight,
        status: payload.status ?? "available",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rooms }),
  });
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      roomNumber?: string;
      type?: string;
      capacity?: number;
      pricePerNight?: number;
      status?: string;
      condition?: string;
      doNotDisturb?: boolean;
      assignedHousekeeperId?: string | null;
    }) => {
      const supabase = createClient();
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.roomNumber !== undefined) patch.room_number = input.roomNumber;
      if (input.type !== undefined) patch.type = input.type;
      if (input.capacity !== undefined) patch.capacity = input.capacity;
      if (input.pricePerNight !== undefined) patch.rate = input.pricePerNight;
      if (input.status !== undefined) patch.status = input.status;
      if (input.condition !== undefined) patch.condition = input.condition;
      if (input.doNotDisturb !== undefined)
        patch.do_not_disturb = input.doNotDisturb;
      if (input.assignedHousekeeperId !== undefined)
        patch.assigned_housekeeper_id = input.assignedHousekeeperId;
      const { error } = await supabase.from("rooms").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.rooms });
      qc.invalidateQueries({ queryKey: qk.occupancy });
    },
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rooms }),
  });
}

export function useListRoomOptions(kind: RoomOptionKind) {
  return useQuery({
    queryKey: qk.roomOptions(kind),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(roomOptionsTable(kind))
        .select("*")
        .order("value");
      if (error) {
        if (kind === "condition" && isMissingRelationError(error)) {
          return FALLBACK_CONDITION_OPTIONS;
        }
        throw error;
      }
      // Lab mode can return the same value from own + admin tenants; Radix
      // SelectItem values must be unique or the trigger shows "AvailableAvailable".
      const seen = new Set<string>();
      const options: ReturnType<typeof mapRoomOption>[] = [];
      for (const row of data ?? []) {
        const mapped = mapRoomOption(row as Record<string, unknown>);
        const key = mapped.value.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        options.push(mapped);
      }
      if (kind === "condition" && options.length === 0) {
        return FALLBACK_CONDITION_OPTIONS;
      }
      return options;
    },
  });
}

export function useCreateRoomOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      kind: RoomOptionKind;
      value: string;
      disablesRoom?: boolean;
    }) => {
      const value = input.value.trim();
      if (!value) throw new Error("Option value cannot be empty.");
      const supabase = createClient();
      const row: Record<string, unknown> = { id: newId(), value };
      if (input.kind === "status")
        row.disables_room = Boolean(input.disablesRoom);
      const { error } = await supabase.from(roomOptionsTable(input.kind)).insert(row);
      if (error) throw error;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: qk.roomOptions(v.kind) }),
  });
}

export function useUpdateRoomOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      kind: RoomOptionKind;
      id: string;
      value: string;
      disablesRoom?: boolean;
      previousValue?: string;
    }) => {
      const supabase = createClient();
      const patch: Record<string, unknown> = {
        value: input.value,
        updated_at: new Date().toISOString(),
      };
      if (input.kind === "status" && input.disablesRoom !== undefined)
        patch.disables_room = input.disablesRoom;
      const { error } = await supabase
        .from(roomOptionsTable(input.kind))
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
      if (
        input.kind === "condition" &&
        input.previousValue &&
        input.previousValue !== input.value
      ) {
        await supabase
          .from("rooms")
          .update({
            condition: input.value,
            updated_at: new Date().toISOString(),
          })
          .eq("condition", input.previousValue);
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.roomOptions(v.kind) });
      if (v.kind === "condition") qc.invalidateQueries({ queryKey: qk.rooms });
    },
  });
}

export function useDeleteRoomOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      kind: RoomOptionKind;
      id: string;
      value?: string;
    }) => {
      const supabase = createClient();
      if (input.kind === "condition" && input.value) {
        await supabase
          .from("rooms")
          .update({
            condition: "clean",
            updated_at: new Date().toISOString(),
          })
          .eq("condition", input.value);
      }
      const { error } = await supabase
        .from(roomOptionsTable(input.kind))
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.roomOptions(v.kind) });
      if (v.kind === "condition") qc.invalidateQueries({ queryKey: qk.rooms });
    },
  });
}

export function useListHousekeepers() {
  return useQuery({
    queryKey: qk.housekeepers,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("housekeepers")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((r) => mapHousekeeper(r as Record<string, unknown>));
    },
  });
}

export function useCreateHousekeeper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      phone?: string | null;
      status?: string;
    }) => {
      const supabase = createClient();
      const { error } = await supabase.from("housekeepers").insert({
        id: newId(),
        name: input.name,
        phone: input.phone ?? null,
        status: input.status ?? "active",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.housekeepers }),
  });
}

export function useUpdateHousekeeper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      phone?: string | null;
      status?: string;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("housekeepers")
        .update({
          name: input.name,
          phone: input.phone,
          status: input.status,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.housekeepers }),
  });
}

export function useDeleteHousekeeper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("housekeepers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.housekeepers }),
  });
}

/* ─── Reservations ─── */

export function useListReservations() {
  return useQuery({
    queryKey: qk.reservations,
    queryFn: fetchReservationViews,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    placeholderData: (previous) => previous,
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateReservationPayload) => {
      const supabase = createClient();
      let guestId = payload.guestId;
      if (!guestId) {
        guestId = newId();
        const { error: gErr } = await supabase.from("guests").insert({
          id: guestId,
          first_name: payload.firstName ?? "Guest",
          last_name: payload.lastName ?? "",
          phone: payload.phone ?? null,
          email: payload.email ?? null,
          address: payload.address ?? null,
        });
        if (gErr) throw gErr;
      }
      const id = newId();
      const reservationNumber = `RSV-${Date.now()}`;

      const { data: existingStays, error: clashErr } = await supabase
        .from("reservations")
        .select("id, reservation_number, check_in_date, check_out_date")
        .eq("room_id", payload.roomId)
        .in("status", ["reserved", "checked_in"]);
      if (clashErr) throw clashErr;
      const clash = (existingStays ?? []).find(
        (row) =>
          payload.checkInDate < String(row.check_out_date) &&
          String(row.check_in_date) < payload.checkOutDate,
      );
      if (clash) {
        throw new Error(
          `This room is already reserved for overlapping dates (${clash.reservation_number}). Pick another room or change the stay dates.`,
        );
      }

      const { error } = await supabase.from("reservations").insert({
        id,
        reservation_number: reservationNumber,
        guest_id: guestId,
        room_id: payload.roomId,
        check_in_date: payload.checkInDate,
        check_out_date: payload.checkOutDate,
        adults: payload.adults,
        children: payload.children,
        status: "reserved",
        source: "walk_in",
        total_amount: payload.totalAmount,
        paid_amount: 0,
        notes: payload.notes ?? null,
      });
      if (error) throw error;
      await logActivity(
        "Reservation created",
        "reservation",
        id,
        `${reservationNumber} created`,
      );
      return { id, reservationNumber };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.reservations });
      qc.invalidateQueries({ queryKey: qk.guests });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export function useUpdateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      checkInDate?: string;
      checkOutDate?: string;
      notes?: string | null;
      roomId?: string;
    }) => {
      const supabase = createClient();
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.checkInDate !== undefined) patch.check_in_date = input.checkInDate;
      if (input.checkOutDate !== undefined)
        patch.check_out_date = input.checkOutDate;
      if (input.notes !== undefined) patch.notes = input.notes;
      if (input.roomId !== undefined) patch.room_id = input.roomId;
      const { error } = await supabase
        .from("reservations")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.reservations });
      qc.invalidateQueries({ queryKey: qk.rooms });
    },
  });
}

export function useCancelReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const supabase = createClient();
      const { data: res } = await supabase
        .from("reservations")
        .select("reservation_number, room_id, status")
        .eq("id", input.id)
        .single();
      const { error } = await supabase
        .from("reservations")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw error;
      if (res?.status === "checked_in" && res.room_id) {
        await supabase
          .from("rooms")
          .update({ status: "cleaning", updated_at: new Date().toISOString() })
          .eq("id", res.room_id);
      }
      await logActivity(
        "Reservation cancelled",
        "reservation",
        input.id,
        `${res?.reservation_number ?? input.id} was cancelled`,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.reservations });
      qc.invalidateQueries({ queryKey: qk.rooms });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export function useDeleteReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("reservations").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.reservations });
      const previous = qc.getQueryData<Reservation[]>(qk.reservations);
      qc.setQueryData<Reservation[]>(qk.reservations, (old) =>
        (old ?? []).filter((row) => row.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.reservations, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.reservations });
      qc.invalidateQueries({ queryKey: qk.rooms });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; checkInAt?: string }) => {
      const supabase = createClient();
      const at = input.checkInAt ?? new Date().toISOString();
      const { data: res, error: fetchErr } = await supabase
        .from("reservations")
        .select("room_id, reservation_number")
        .eq("id", input.id)
        .single();
      if (fetchErr) throw fetchErr;
      const { error } = await supabase
        .from("reservations")
        .update({
          status: "checked_in",
          actual_check_in_at: at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw error;
      if (res?.room_id) {
        await supabase
          .from("rooms")
          .update({ status: "occupied", updated_at: new Date().toISOString() })
          .eq("id", res.room_id);
      }
      await logActivity(
        "Check in",
        "reservation",
        input.id,
        `${res?.reservation_number} checked in at ${at}`,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.reservations });
      qc.invalidateQueries({ queryKey: qk.rooms });
      qc.invalidateQueries({ queryKey: qk.dashboardSummary });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      checkOutAt?: string;
      paymentMethod?: string;
    }) => {
      const supabase = createClient();
      const at = input.checkOutAt ?? new Date().toISOString();
      const { data: res, error: fetchErr } = await supabase
        .from("reservations")
        .select("*")
        .eq("id", input.id)
        .single();
      if (fetchErr) throw fetchErr;
      const total = Number(res.total_amount ?? 0);
      const paid = Number(res.paid_amount ?? 0);
      const balance = Math.max(0, total - paid);
      if (balance > 0 && input.paymentMethod) {
        const method =
          input.paymentMethod === "e-wallet"
            ? "gcash"
            : input.paymentMethod === "bank"
              ? "bank_transfer"
              : input.paymentMethod;
        await supabase.from("payments").insert({
          id: newId(),
          reservation_id: input.id,
          amount: balance,
          method,
        });
      }
      const { error } = await supabase
        .from("reservations")
        .update({
          status: "checked_out",
          paid_amount: total,
          actual_check_out_at: at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw error;
      if (res.room_id) {
        await supabase
          .from("rooms")
          .update({
            status: "cleaning",
            condition: "dirty",
            updated_at: new Date().toISOString(),
          })
          .eq("id", res.room_id);
      }
      await logActivity(
        "Check out",
        "reservation",
        input.id,
        `${res.reservation_number} checked out at ${at}`,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.reservations });
      qc.invalidateQueries({ queryKey: qk.rooms });
      qc.invalidateQueries({ queryKey: qk.payments });
      qc.invalidateQueries({ queryKey: qk.dashboardSummary });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export function useGetReservationContractData() {
  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const supabase = createClient();
      const [{ data: settings }, { data: res, error }] = await Promise.all([
        supabase.from("settings").select("*").limit(1).maybeSingle(),
        supabase
          .from("reservations")
          .select(
            `*, guests (*), rooms ( room_number, type, rate )`,
          )
          .eq("id", input.id)
          .single(),
      ]);
      if (error) throw error;
      const g = res.guests as Record<string, unknown>;
      const room = res.rooms as Record<string, unknown>;
      const s = settings ? mapSettings(settings as Record<string, unknown>) : null;
      return {
        hotelName: s?.hotelName ?? "PalawanSU Hotel",
        hotelAddress: s?.address ?? "",
        hotelContactNumber: s?.contactNumber ?? "",
        reservationNumber: res.reservation_number,
        guestName: `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim(),
        phone: g.phone,
        email: g.email,
        nationality: g.nationality,
        idType: g.id_type,
        id_type: g.id_type,
        idNumber: g.id_number,
        id_number: g.id_number,
        address: g.address,
        roomNumber: room.room_number,
        roomType: room.type,
        roomRate: Number(room.rate ?? 0),
        checkInDate: String(res.check_in_date).slice(0, 10),
        checkOutDate: String(res.check_out_date).slice(0, 10),
        adults: res.adults,
        children: res.children,
        totalAmount: Number(res.total_amount ?? 0),
        paidAmount: Number(res.paid_amount ?? 0),
        notes: res.notes,
      };
    },
  });
}

export function useGetReservationBillData() {
  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const contract = await (async () => {
        const supabase = createClient();
        const [{ data: settings }, { data: res, error }] = await Promise.all([
          supabase.from("settings").select("*").limit(1).maybeSingle(),
          supabase
            .from("reservations")
            .select(`*, guests (*), rooms ( room_number, type )`)
            .eq("id", input.id)
            .single(),
        ]);
        if (error) throw error;
        const g = res.guests as Record<string, unknown>;
        const room = res.rooms as Record<string, unknown>;
        const s = settings
          ? mapSettings(settings as Record<string, unknown>)
          : null;
        const total = Number(res.total_amount ?? 0);
        const paid = Number(res.paid_amount ?? 0);
        return {
          currency: s?.currency ?? "Peso",
          balance: Math.max(0, total - paid),
          paidAmount: paid,
          reservationNumber: res.reservation_number,
          hotelName: s?.hotelName ?? "PalawanSU Hotel",
          hotelAddress: s?.address ?? "",
          hotelContactNumber: s?.contactNumber ?? "",
          guestName: `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim(),
          roomNumber: room.room_number,
          roomType: room.type,
          checkInDate: String(res.check_in_date).slice(0, 10),
          checkOutDate: String(res.check_out_date).slice(0, 10),
          adults: res.adults,
          children: res.children,
          totalAmount: total,
        };
      })();
      return contract;
    },
  });
}

/* ─── Payments ─── */

export function useListPayments() {
  return useQuery({
    queryKey: qk.payments,
    queryFn: fetchPaymentViews,
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      data: {
        reservationId: string;
        amount: number;
        method: string;
        referenceNo?: string;
        note?: string;
        receivedBy?: string;
      };
    }) => {
      const supabase = createClient();
      const { data: d } = input;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const receivedBy =
        d.receivedBy &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          d.receivedBy,
        )
          ? d.receivedBy
          : (user?.id ?? null);
      const { error } = await supabase.from("payments").insert({
        id: newId(),
        reservation_id: d.reservationId,
        amount: d.amount,
        method: d.method,
        reference_no: d.referenceNo ?? null,
        note: d.note ?? null,
        received_by: receivedBy,
      });
      if (error) throw error;
      const { data: res } = await supabase
        .from("reservations")
        .select("paid_amount")
        .eq("id", d.reservationId)
        .single();
      await supabase
        .from("reservations")
        .update({
          paid_amount: Number(res?.paid_amount ?? 0) + Number(d.amount),
          updated_at: new Date().toISOString(),
        })
        .eq("id", d.reservationId);
      await logActivity(
        "Payment recorded",
        "payment",
        d.reservationId,
        `Payment of ${d.amount} via ${d.method}`,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.payments });
      qc.invalidateQueries({ queryKey: qk.reservations });
      qc.invalidateQueries({ queryKey: qk.activity });
    },
  });
}

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      data: {
        amount?: number;
        method?: string;
        referenceNo?: string;
        note?: string;
      };
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("payments")
        .update({
          amount: input.data.amount,
          method: input.data.method,
          reference_no: input.data.referenceNo,
          note: input.data.note,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.payments });
      qc.invalidateQueries({ queryKey: qk.reservations });
    },
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.payments }),
  });
}

/* ─── Dashboard / reports ─── */

export function useGetDashboardSummary() {
  return useQuery({
    queryKey: qk.dashboardSummary,
    queryFn: async () => {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: rooms }, { data: reservations }] = await Promise.all([
        supabase.from("rooms").select("id, status"),
        supabase
          .from("reservations")
          .select("check_in_date, check_out_date, status"),
      ]);
      const totalRooms = rooms?.length ?? 0;
      const occupied =
        rooms?.filter((r) => r.status === "occupied").length ?? 0;
      const todayCheckIns =
        reservations?.filter(
          (r) =>
            String(r.check_in_date).slice(0, 10) === today &&
            r.status !== "cancelled",
        ).length ?? 0;
      const todayCheckOuts =
        reservations?.filter(
          (r) =>
            String(r.check_out_date).slice(0, 10) === today &&
            (r.status === "checked_in" || r.status === "checked_out"),
        ).length ?? 0;
      return {
        todayCheckIns,
        todayCheckOuts,
        totalRooms,
        occupancyRate: totalRooms ? Math.round((occupied / totalRooms) * 100) : 0,
      };
    },
  });
}

export function useGetOccupancyOverview() {
  return useQuery({
    queryKey: qk.occupancy,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("rooms")
        .select("room_number, status")
        .order("room_number");
      if (error) throw error;
      return {
        rooms: (data ?? []).map((r) => ({
          roomNumber: r.room_number,
          status: r.status,
        })),
      };
    },
  });
}

export function useGetRecentActivity() {
  return useQuery({
    queryKey: qk.activity,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []).map((r) => mapActivity(r as Record<string, unknown>));
    },
  });
}

export function useGetRevenueReport() {
  return useQuery({
    queryKey: qk.revenue,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("payments")
        .select("amount, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      let todayRevenue = 0;
      let weekRevenue = 0;
      let monthRevenue = 0;
      let totalRevenue = 0;
      const byDay = new Map<string, number>();

      for (const p of data ?? []) {
        const amount = Number(p.amount ?? 0);
        const created = new Date(p.created_at);
        totalRevenue += amount;
        if (created >= startOfToday) todayRevenue += amount;
        if (created >= weekAgo) weekRevenue += amount;
        if (created >= monthStart) monthRevenue += amount;
        const key = created.toISOString().slice(0, 10);
        byDay.set(key, (byDay.get(key) ?? 0) + amount);
      }

      return {
        todayRevenue,
        weekRevenue,
        monthRevenue,
        totalRevenue,
        dailyRevenue: Array.from(byDay.entries()).map(([date, amount]) => ({
          date,
          amount,
        })),
      };
    },
  });
}

export function useGetReservationReport() {
  return useQuery({
    queryKey: qk.reservationReport,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("reservations")
        .select("status");
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const r of data ?? []) {
        counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
      }
      return {
        statusCounts: Array.from(counts.entries()).map(([status, count]) => ({
          status,
          count,
        })),
      };
    },
  });
}

/* ─── Settings ─── */

export function useGetSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: async (): Promise<Settings> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return {
          id: "main",
          hotelName: "PalawanSU Hotel",
          address: "",
          contactNumber: "",
          email: "",
          checkInTime: "14:00",
          checkOutTime: "12:00",
          currency: "Peso",
          taxRate: 0,
        };
      }
      return mapSettings(data as Record<string, unknown>);
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<{
        hotelName: string;
        address: string;
        contactNumber: string;
        email: string;
        checkInTime: string;
        checkOutTime: string;
        currency: string;
        taxRate: number;
      }>,
    ) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const patch: Record<string, unknown> = {
        id: user.id,
        tenant_id: user.id,
        updated_at: new Date().toISOString(),
      };
      if (input.hotelName !== undefined) patch.hotel_name = input.hotelName;
      if (input.address !== undefined) patch.address = input.address;
      if (input.contactNumber !== undefined)
        patch.contact_number = input.contactNumber;
      if (input.email !== undefined) patch.email = input.email;
      if (input.checkInTime !== undefined) patch.check_in_time = input.checkInTime;
      if (input.checkOutTime !== undefined)
        patch.check_out_time = input.checkOutTime;
      if (input.currency !== undefined) patch.currency = input.currency;
      if (input.taxRate !== undefined) patch.tax_rate = input.taxRate;
      const { error } = await supabase.from("settings").upsert(patch);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.settings }),
  });
}

/* ─── Users (profiles) ─── */

export function useListUsers() {
  return useQuery({
    queryKey: qk.users,
    queryFn: async (): Promise<User[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const emailById = new Map<string, string | null>();
      const { data: classroom } = await supabase.rpc("admin_classroom_overview");
      if (Array.isArray(classroom)) {
        for (const row of classroom as Record<string, unknown>[]) {
          emailById.set(String(row.id), (row.email as string | null) ?? null);
        }
      }

      return (data ?? []).map((r) =>
        mapUser({
          ...(r as Record<string, unknown>),
          email: emailById.get(String((r as { id: string }).id)) ?? null,
        }),
      );
    },
  });
}

async function readApiError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error || fallback);
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      data: {
        fullName: string;
        username: string;
        email: string;
        password: string;
        role: string;
        isActive: boolean;
      };
    }) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data),
      });
      if (!res.ok) await readApiError(res, "Could not create user.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.users });
      qc.invalidateQueries({ queryKey: qk.classroom });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      data: {
        fullName?: string;
        username?: string;
        email?: string;
        role?: string;
        isActive?: boolean;
        password?: string;
      };
    }) => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: input.id, ...input.data }),
      });
      if (!res.ok) await readApiError(res, "Could not update user.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.users });
      qc.invalidateQueries({ queryKey: qk.classroom });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_id: string) => {
      throw new Error("Delete users from Supabase Auth dashboard.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }),
  });
}

export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) throw error;
    },
  });
}

export function useAdminClassroom() {
  return useQuery({
    queryKey: qk.classroom,
    queryFn: async (): Promise<ClassroomUser[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("admin_classroom_overview");
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        email: (row.email as string | null) ?? null,
        fullName: String(row.full_name ?? ""),
        username: String(row.username ?? ""),
        role: String(row.role ?? "staff"),
        isActive: Boolean(row.is_active ?? true),
        onboardingCompleted: Boolean(row.onboarding_completed),
        createdAt: String(row.created_at ?? ""),
        roomsCount: Number(row.rooms_count ?? 0),
        guestsCount: Number(row.guests_count ?? 0),
        reservationsCount: Number(row.reservations_count ?? 0),
        checkinsCount: Number(row.checkins_count ?? 0),
        paymentsCount: Number(row.payments_count ?? 0),
        posOrdersCount: Number(row.pos_orders_count ?? 0),
        posPaidCount: Number(row.pos_paid_count ?? 0),
      }));
    },
  });
}

export function useAdminUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      role?: string;
      isActive?: boolean;
      onboardingCompleted?: boolean;
    }) => {
      const supabase = createClient();
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.role !== undefined) patch.role = input.role;
      if (input.isActive !== undefined) patch.is_active = input.isActive;
      if (input.onboardingCompleted !== undefined) {
        patch.onboarding_completed = input.onboardingCompleted;
      }
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.classroom });
      qc.invalidateQueries({ queryKey: qk.users });
    },
  });
}

export function useAdminBulkUpdateStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      ids: string[];
      isActive?: boolean;
      onboardingCompleted?: boolean;
    }) => {
      if (input.ids.length === 0) return;
      const supabase = createClient();
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (input.isActive !== undefined) patch.is_active = input.isActive;
      if (input.onboardingCompleted !== undefined) {
        patch.onboarding_completed = input.onboardingCompleted;
      }
      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .in("id", input.ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.classroom });
      qc.invalidateQueries({ queryKey: qk.users });
    },
  });
}

export function useAdminDeleteStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/admin/students", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        deleted?: number;
        failures?: { id: string; message: string }[];
      };
      if (!res.ok) {
        throw new Error(json.error || "Delete failed");
      }
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.classroom });
      qc.invalidateQueries({ queryKey: qk.users });
    },
  });
}

export function useOperationMode() {
  return useQuery({
    queryKey: qk.operationMode,
    queryFn: async (): Promise<OperationMode> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("app_config")
        .select("operation_mode")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data?.operation_mode === "shared" ? "shared" : "lab";
    },
  });
}

export function useSetOperationMode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mode: OperationMode) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("set_app_operation_mode", {
        p_mode: mode,
      });
      if (error) throw error;
      return (data as OperationMode) ?? mode;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.operationMode });
      qc.invalidateQueries({ queryKey: qk.rooms });
      qc.invalidateQueries({ queryKey: qk.guests });
      qc.invalidateQueries({ queryKey: qk.reservations });
      qc.invalidateQueries({ queryKey: qk.payments });
      qc.invalidateQueries({ queryKey: qk.dashboardSummary });
      qc.invalidateQueries({ queryKey: qk.activity });
      qc.invalidateQueries({ queryKey: ["pos"] });
    },
  });
}

export function setBaseUrl(_url: string) {
  // no-op for Next/Supabase
}
