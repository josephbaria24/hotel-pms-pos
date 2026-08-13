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
  CreateReservationPayload,
  CreateRoomPayload,
  Guest,
  Payment,
  Reservation,
  Room,
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
};

export const getListGuestsQueryKey = () => qk.guests;
export const getListRoomsQueryKey = () => qk.rooms;
export const getListReservationsQueryKey = () => qk.reservations;
export const getListPaymentsQueryKey = () => qk.payments;
export const getListUsersQueryKey = () => qk.users;
export const getRoomOptionsQueryKey = (kind: "type" | "status") =>
  qk.roomOptions(kind);

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
  await qc.prefetchQuery({ queryKey: qk.reservations, queryFn: fetchReservationViews });
}
export async function prefetchGuestHubStaysData(qc: QueryClient) {
  await qc.prefetchQuery({ queryKey: qk.reservations, queryFn: fetchReservationViews });
}

/* ─── Rooms ─── */

export function useListRooms() {
  return useQuery({
    queryKey: qk.rooms,
    queryFn: async (): Promise<Room[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("room_number");
      if (error) throw error;
      return (data ?? []).map((r) => mapRoom(r as Record<string, unknown>));
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

export function useListRoomOptions(kind: "type" | "status") {
  return useQuery({
    queryKey: qk.roomOptions(kind),
    queryFn: async () => {
      const supabase = createClient();
      const table =
        kind === "type" ? "room_type_options" : "room_status_options";
      const { data, error } = await supabase.from(table).select("*").order("value");
      if (error) throw error;
      return (data ?? []).map((r) => mapRoomOption(r as Record<string, unknown>));
    },
  });
}

export function useCreateRoomOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      kind: "type" | "status";
      value: string;
      disablesRoom?: boolean;
    }) => {
      const value = input.value.trim();
      if (!value) throw new Error("Option value cannot be empty.");
      const supabase = createClient();
      const table =
        input.kind === "type" ? "room_type_options" : "room_status_options";
      const row: Record<string, unknown> = { id: newId(), value };
      if (input.kind === "status")
        row.disables_room = Boolean(input.disablesRoom);
      const { error } = await supabase.from(table).insert(row);
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
      kind: "type" | "status";
      id: string;
      value: string;
      disablesRoom?: boolean;
    }) => {
      const supabase = createClient();
      const table =
        input.kind === "type" ? "room_type_options" : "room_status_options";
      const patch: Record<string, unknown> = {
        value: input.value,
        updated_at: new Date().toISOString(),
      };
      if (input.kind === "status" && input.disablesRoom !== undefined)
        patch.disables_room = input.disablesRoom;
      const { error } = await supabase.from(table).update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: qk.roomOptions(v.kind) }),
  });
}

export function useDeleteRoomOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { kind: "type" | "status"; id: string }) => {
      const supabase = createClient();
      const table =
        input.kind === "type" ? "room_type_options" : "room_status_options";
      const { error } = await supabase.from(table).delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: qk.roomOptions(v.kind) }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.reservations }),
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
        supabase.from("settings").select("*").eq("id", "main").maybeSingle(),
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
          supabase.from("settings").select("*").eq("id", "main").maybeSingle(),
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
      const { error } = await supabase.from("payments").insert({
        id: newId(),
        reservation_id: d.reservationId,
        amount: d.amount,
        method: d.method,
        reference_no: d.referenceNo ?? null,
        note: d.note ?? null,
        received_by: d.receivedBy ?? null,
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
        .eq("id", "main")
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
      const patch: Record<string, unknown> = {
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
      const { error } = await supabase
        .from("settings")
        .upsert({ id: "main", ...patch });
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
      return (data ?? []).map((r) => mapUser(r as Record<string, unknown>));
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_input: {
      data: {
        fullName: string;
        username: string;
        password: string;
        role: string;
        isActive: boolean;
      };
    }) => {
      throw new Error(
        "Create staff in Supabase Auth (Dashboard → Authentication → Users).",
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }),
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
        role?: string;
        isActive?: boolean;
        password?: string;
      };
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: input.data.fullName,
          username: input.data.username,
          role: input.data.role,
          is_active: input.data.isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }),
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

export function setBaseUrl(_url: string) {
  // no-op for Next/Supabase
}
