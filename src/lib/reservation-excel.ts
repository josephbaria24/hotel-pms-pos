import type { Guest, Payment, Reservation, Room } from "@/lib/api-client/types";
import { ymdPh } from "@/lib/datetime";
import {
  paymentMethodLabel,
  remainingBalance,
  reservationPaymentStatus,
} from "@/lib/reservation-payment";

export type ReservationExcelRow = {
  guestName: string;
  address: string;
  contactNumber: string;
  email: string;
  reservationDate: string;
  checkInDate: string;
  checkOutDate: string;
  roomDetails: string;
  numberOfGuests: number;
  reservationStatus: string;
  paymentStatus: string;
  totalAmount: number;
  depositAmount: number;
  remainingBalance: number;
  paymentMode: string;
};

function stayStatusLabel(status: string) {
  const map: Record<string, string> = {
    reserved: "Reserved",
    checked_in: "Checked In",
    checked_out: "Checked Out",
    cancelled: "Cancelled",
    no_show: "No Show",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

export function latestPaymentMethod(reservationId: string, payments: Payment[]) {
  const list = payments
    .filter((p) => p.reservationId === reservationId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (list.length === 0) return "";
  const unique = [...new Set(list.map((p) => p.paymentMethod).filter(Boolean))];
  return unique.map((m) => paymentMethodLabel(m)).join(", ");
}

export function buildReservationExcelRows(
  reservations: Reservation[],
  guests: Guest[],
  rooms: Room[],
  payments: Payment[],
): ReservationExcelRow[] {
  const guestById = new Map(guests.map((g) => [g.id, g]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  return reservations.map((res) => {
    const guest = guestById.get(res.guestId);
    const room = roomById.get(res.roomId);
    const roomNumber = res.roomNumber || room?.roomNumber || "";
    const roomType = room?.type ? String(room.type) : "";
    const roomDetails = [roomType, roomNumber ? `Room ${roomNumber}` : ""]
      .filter(Boolean)
      .join(" ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) || roomNumber || "—";
    const paid = Number(res.paidAmount || 0);
    const total = Number(res.totalAmount || 0);
    return {
      guestName: res.guestName || guest?.fullName || "—",
      address: guest?.address?.trim() || "—",
      contactNumber: guest?.contactNumber?.trim() || "—",
      email: guest?.email?.trim() || "—",
      reservationDate: res.createdAt ? ymdPh(res.createdAt) : "",
      checkInDate: res.checkInDate.slice(0, 10),
      checkOutDate: res.checkOutDate.slice(0, 10),
      roomDetails,
      numberOfGuests: Number(res.adults || 0) + Number(res.children || 0),
      reservationStatus: stayStatusLabel(res.status),
      paymentStatus: reservationPaymentStatus(total, paid),
      totalAmount: total,
      depositAmount: paid,
      remainingBalance: remainingBalance(total, paid),
      paymentMode: latestPaymentMethod(res.id, payments) || "—",
    };
  });
}

export async function downloadReservationsExcel(
  rows: ReservationExcelRow[],
  filename: string,
) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PalawanSU Hotel PMS";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Reservations", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Guest Name", key: "guestName", width: 24 },
    { header: "Address", key: "address", width: 36 },
    { header: "Contact Number", key: "contactNumber", width: 18 },
    { header: "Email", key: "email", width: 28 },
    { header: "Reservation Date", key: "reservationDate", width: 16 },
    { header: "Check-in Date", key: "checkInDate", width: 14 },
    { header: "Check-out Date", key: "checkOutDate", width: 14 },
    { header: "Room Details", key: "roomDetails", width: 22 },
    { header: "Number of Guests", key: "numberOfGuests", width: 16 },
    { header: "Reservation Status", key: "reservationStatus", width: 18 },
    { header: "Payment Status", key: "paymentStatus", width: 18 },
    { header: "Total Amount", key: "totalAmount", width: 14 },
    { header: "Deposit Amount", key: "depositAmount", width: 16 },
    { header: "Remaining Balance", key: "remainingBalance", width: 18 },
    { header: "Mode of Payment", key: "paymentMode", width: 18 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F766E" },
  };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 22;

  for (const row of rows) {
    const added = sheet.addRow(row);
    added.getCell("contactNumber").numFmt = "@";
    added.getCell("totalAmount").numFmt = '"₱"#,##0.00';
    added.getCell("depositAmount").numFmt = '"₱"#,##0.00';
    added.getCell("remainingBalance").numFmt = '"₱"#,##0.00';
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
