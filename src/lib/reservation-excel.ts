import type { Guest, Payment, Reservation, Room } from "@/lib/api-client/types";
import { ymdPh } from "@/lib/datetime";
import {
  excelEmptyRow,
  excelFill,
  excelWriteDownload,
  paintExcelBanner,
  PMS_EXCEL as C,
  setupExcelSheet,
  styleExcelChip,
  styleExcelDataRow,
  styleExcelHeader,
  type ExcelHotel,
} from "@/lib/excel-report";
import {
  paymentMethodLabel,
  remainingBalance,
  requiredDeposit,
  reservationPaymentStatus,
} from "@/lib/reservation-payment";

export type ReservationExcelRow = {
  reservationNumber: string;
  guestName: string;
  address: string;
  contactNumber: string;
  email: string;
  reservationDate: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  roomNumber: string;
  roomType: string;
  roomDetails: string;
  adults: number;
  children: number;
  numberOfGuests: number;
  reservationStatus: string;
  paymentStatus: string;
  totalAmount: number;
  requiredDeposit: number;
  depositAmount: number;
  remainingBalance: number;
  paymentMode: string;
  source: string;
  notes: string;
};

export type ReservationExcelFilters = {
  madeOn?: string;
  dateFrom?: string;
  dateTo?: string;
  statusFilter?: string;
  searchTerm?: string;
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

function stayNights(checkIn: string, checkOut: string) {
  const a = Date.parse(`${checkIn.slice(0, 10)}T00:00:00`);
  const b = Date.parse(`${checkOut.slice(0, 10)}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function latestPaymentMethod(reservationId: string, payments: Payment[]) {
  const list = payments
    .filter((p) => p.reservationId === reservationId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (list.length === 0) return "";
  const unique = [...new Set(list.map((p) => p.paymentMethod).filter(Boolean))];
  return unique.map((m) => paymentMethodLabel(m)).join(", ");
}

export function reservationExcelSubtitle(filters: ReservationExcelFilters = {}) {
  const bits: string[] = [];
  if (filters.madeOn) bits.push(`Made on ${filters.madeOn}`);
  if (filters.dateFrom || filters.dateTo) {
    bits.push(`Stay ${filters.dateFrom || "…"} – ${filters.dateTo || "…"}`);
  }
  if (filters.statusFilter && filters.statusFilter !== "all") {
    bits.push(stayStatusLabel(filters.statusFilter));
  }
  if (filters.searchTerm?.trim()) {
    bits.push(`Search “${filters.searchTerm.trim()}”`);
  }
  return bits.length
    ? `Reservations Report  ·  ${bits.join("  ·  ")}`
    : "Reservations Complete Report";
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
      reservationNumber: res.reservationNumber || "—",
      guestName: res.guestName || guest?.fullName || "—",
      address: guest?.address?.trim() || "—",
      contactNumber: guest?.contactNumber?.trim() || "—",
      email: guest?.email?.trim() || "—",
      reservationDate: res.createdAt ? ymdPh(res.createdAt) : "",
      checkInDate: res.checkInDate.slice(0, 10),
      checkOutDate: res.checkOutDate.slice(0, 10),
      nights: stayNights(res.checkInDate, res.checkOutDate),
      roomNumber: roomNumber || "—",
      roomType: roomType || "—",
      roomDetails,
      adults: Number(res.adults || 0),
      children: Number(res.children || 0),
      numberOfGuests: Number(res.adults || 0) + Number(res.children || 0),
      reservationStatus: stayStatusLabel(res.status),
      paymentStatus: reservationPaymentStatus(total, paid),
      totalAmount: total,
      requiredDeposit: requiredDeposit(total),
      depositAmount: paid,
      remainingBalance: remainingBalance(total, paid),
      paymentMode: latestPaymentMethod(res.id, payments) || "—",
      source: String(res.source || "").trim() || "—",
      notes: String(res.notes || "").trim() || "—",
    };
  });
}

function stayFill(status: string) {
  const s = status.toLowerCase();
  if (s.includes("checked in")) return { bg: C.greenBg, fg: C.greenFg };
  if (s.includes("checked out")) return { bg: C.slateBg, fg: C.slateFg };
  if (s.includes("cancel")) return { bg: C.roseBg, fg: C.roseFg };
  if (s.includes("no show")) return { bg: "FFE2E8F0", fg: "FF334155" };
  if (s.includes("reserved")) return { bg: C.amberBg, fg: C.amberFg };
  return { bg: C.slateBg, fg: C.slateFg };
}

function payFill(status: string) {
  if (status === "Fully Paid") return { bg: C.greenBg, fg: C.greenFg };
  if (status === "Unpaid") return { bg: C.roseBg, fg: C.roseFg };
  if (status === "Deposit Required") return { bg: C.amberBg, fg: C.amberFg };
  if (status === "Deposit Paid") return { bg: C.skyBg, fg: C.skyFg };
  if (status === "Partially Paid") return { bg: "FFEDE9FE", fg: "FF5B21B6" };
  return { bg: C.slateBg, fg: C.slateFg };
}

function roomFill(status: string) {
  const s = status.toLowerCase();
  if (s.includes("occupied") || s.includes("checked")) return { bg: C.amberBg, fg: C.amberFg };
  if (s.includes("available") || s.includes("vacant") || s.includes("clean")) {
    return { bg: C.greenBg, fg: C.greenFg };
  }
  if (s.includes("dirty") || s.includes("ooo") || s.includes("out of")) {
    return { bg: C.roseBg, fg: C.roseFg };
  }
  return { bg: C.slateBg, fg: C.slateFg };
}

function moneyFmt(cell: import("exceljs").Cell) {
  cell.numFmt = '"₱"#,##0.00';
}

function roomStatusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—";
}

export async function downloadReservationsExcel(input: {
  reservations: Reservation[];
  guests: Guest[];
  rooms: Room[];
  payments: Payment[];
  hotel?: ExcelHotel;
  filename: string;
  subtitle?: string;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PalawanSU Hotel PMS";
  workbook.lastModifiedBy = "PalawanSU Hotel PMS";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = input.hotel?.hotelName?.trim() || "PalawanSU Hotel";

  const hotelName = workbook.company;
  const hotel = input.hotel ?? { hotelName };
  const subtitle = input.subtitle?.trim() || "Reservations Complete Report";
  const reservations = [...input.reservations].sort((a, b) =>
    String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
  );
  const rows = buildReservationExcelRows(reservations, input.guests, input.rooms, input.payments);
  const ids = new Set(reservations.map((r) => r.id));
  const guestIds = new Set(reservations.map((r) => r.guestId).filter(Boolean));
  const roomIds = new Set(reservations.map((r) => r.roomId).filter(Boolean));
  const guests = input.guests
    .filter((g) => guestIds.has(g.id))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  const rooms = input.rooms
    .filter((r) => roomIds.has(r.id))
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
  const payments = [...input.payments]
    .filter((p) => ids.has(p.reservationId))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const rowsByGuest = new Map<string, ReservationExcelRow[]>();
  const rowsByRoom = new Map<string, ReservationExcelRow[]>();
  reservations.forEach((res, i) => {
    const row = rows[i];
    if (!row) return;
    if (res.guestId) {
      const list = rowsByGuest.get(res.guestId) ?? [];
      list.push(row);
      rowsByGuest.set(res.guestId, list);
    }
    if (res.roomId) {
      const list = rowsByRoom.get(res.roomId) ?? [];
      list.push(row);
      rowsByRoom.set(res.roomId, list);
    }
  });

  const stayCounts = {
    reserved: 0,
    checkedIn: 0,
    checkedOut: 0,
    cancelled: 0,
    noShow: 0,
  };
  const payCounts = {
    unpaid: 0,
    depositRequired: 0,
    depositPaid: 0,
    partiallyPaid: 0,
    fullyPaid: 0,
  };
  let totalAmount = 0;
  let paidAmount = 0;
  let balanceAmount = 0;
  let nights = 0;
  for (const row of rows) {
    totalAmount += row.totalAmount;
    paidAmount += row.depositAmount;
    balanceAmount += row.remainingBalance;
    nights += row.nights;
    const st = row.reservationStatus;
    if (st === "Reserved") stayCounts.reserved += 1;
    else if (st === "Checked In") stayCounts.checkedIn += 1;
    else if (st === "Checked Out") stayCounts.checkedOut += 1;
    else if (st === "Cancelled") stayCounts.cancelled += 1;
    else if (st === "No Show") stayCounts.noShow += 1;
    const pay = row.paymentStatus;
    if (pay === "Unpaid") payCounts.unpaid += 1;
    else if (pay === "Deposit Required") payCounts.depositRequired += 1;
    else if (pay === "Deposit Paid") payCounts.depositPaid += 1;
    else if (pay === "Partially Paid") payCounts.partiallyPaid += 1;
    else if (pay === "Fully Paid") payCounts.fullyPaid += 1;
  }

  const peso = (n: number) =>
    `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Summary ──────────────────────────────────────────────
  const summary = workbook.addWorksheet("Summary", {
    properties: { tabColor: { argb: C.dark } },
  });
  summary.columns = Array.from({ length: 8 }, () => ({ width: 16 }));
  paintExcelBanner(summary, 8, C, hotelName, subtitle, hotel);
  summary.mergeCells("A4:H4");
  summary.getCell("A4").value = "At a glance";
  summary.getCell("A4").font = { name: "Calibri", size: 12, bold: true, color: { argb: C.deep } };
  summary.getCell("A4").alignment = { vertical: "middle", indent: 1 };
  summary.getRow(4).height = 20;

  const kpis: { label: string; value: string; bg: string; range: string }[] = [
    { label: "TOTAL BOOKINGS", value: String(rows.length), bg: C.header, range: "A5:B6" },
    { label: "RESERVED", value: String(stayCounts.reserved), bg: "FFD97706", range: "C5:D6" },
    { label: "CHECKED IN", value: String(stayCounts.checkedIn), bg: "FF047857", range: "E5:F6" },
    { label: "CHECKED OUT", value: String(stayCounts.checkedOut), bg: C.deep, range: "G5:H6" },
    { label: "CANCELLED", value: String(stayCounts.cancelled + stayCounts.noShow), bg: "FFBE123C", range: "A7:B8" },
    { label: "UNPAID", value: String(payCounts.unpaid + payCounts.depositRequired), bg: "FF9F1239", range: "C7:D8" },
    { label: "TOTAL AMOUNT", value: peso(totalAmount), bg: C.dark, range: "E7:F8" },
    { label: "BALANCE DUE", value: peso(balanceAmount), bg: "FF9A3412", range: "G7:H8" },
  ];
  for (const kpi of kpis) {
    summary.mergeCells(kpi.range);
    const cell = summary.getCell(kpi.range.split(":")[0]!);
    cell.value = {
      richText: [
        {
          text: `${kpi.label}\n`,
          font: { name: "Calibri", size: 8, bold: true, color: { argb: C.bannerMeta } },
        },
        {
          text: kpi.value,
          font: { name: "Calibri", size: 16, bold: true, color: { argb: C.white } },
        },
      ],
    };
    cell.fill = excelFill(kpi.bg);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: C.dark } },
      left: { style: "thin", color: { argb: C.dark } },
      bottom: { style: "thin", color: { argb: C.dark } },
      right: { style: "thin", color: { argb: C.dark } },
    };
  }
  summary.getRow(5).height = 22;
  summary.getRow(6).height = 22;
  summary.getRow(7).height = 22;
  summary.getRow(8).height = 22;

  summary.mergeCells("A10:H10");
  summary.getCell("A10").value = "Bookings snapshot";
  summary.getCell("A10").font = { name: "Calibri", size: 12, bold: true, color: { argb: C.deep } };
  summary.getCell("A10").alignment = { vertical: "middle", indent: 1 };

  const snapHeaders = ["Metric", "Value", "Notes", "", "", "", "", ""];
  const snapRow = summary.getRow(11);
  snapHeaders.forEach((h, i) => {
    snapRow.getCell(i + 1).value = h || null;
  });
  styleExcelHeader(snapRow, 3, C);
  summary.mergeCells("C11:H11");
  const snapshot: [string, string | number, string][] = [
    ["Bookings in this export", rows.length, "Matches the current Bookings filters"],
    ["Reserved", stayCounts.reserved, "Confirmed, not yet arrived"],
    ["Checked in", stayCounts.checkedIn, "In-house guests"],
    ["Checked out", stayCounts.checkedOut, "Completed stays"],
    ["Cancelled / no-show", stayCounts.cancelled + stayCounts.noShow, `${stayCounts.cancelled} cancelled, ${stayCounts.noShow} no-show`],
    ["Unpaid / deposit due", payCounts.unpaid + payCounts.depositRequired, "No payment or below 50% deposit"],
    ["Deposit paid", payCounts.depositPaid, "At least 50% collected"],
    ["Partially paid", payCounts.partiallyPaid, "Above deposit, below full amount"],
    ["Fully paid", payCounts.fullyPaid, "Zero remaining balance"],
    ["Room nights", nights, "Sum of check-in to check-out nights"],
    ["Total amount", totalAmount, "Gross reservation value"],
    ["Amount collected", paidAmount, "Deposits and payments received"],
    ["Remaining balance", balanceAmount, "Still due from guests"],
    ["Guests in this list", guests.length, "Unique guest profiles"],
    ["Rooms in this list", rooms.length, "Distinct rooms booked"],
    ["Payment records", payments.length, "Individual receipts for these bookings"],
  ];
  snapshot.forEach((row, i) => {
    const r = summary.getRow(12 + i);
    r.getCell(1).value = row[0];
    r.getCell(2).value = row[1];
    r.getCell(3).value = row[2];
    summary.mergeCells(12 + i, 3, 12 + i, 8);
    styleExcelDataRow(r, 8, i, C);
    r.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: C.ink } };
    if (i === 10 || i === 11 || i === 12) moneyFmt(r.getCell(2));
    if (i === 5) {
      r.getCell(1).fill = excelFill(C.roseBg);
      r.getCell(2).fill = excelFill(C.roseBg);
    }
    if (i === 8) {
      r.getCell(1).fill = excelFill(C.greenBg);
      r.getCell(2).fill = excelFill(C.greenBg);
    }
    if (i === 12) {
      r.getCell(1).fill = excelFill(C.amberBg);
      r.getCell(2).fill = excelFill(C.amberBg);
    }
  });
  summary.views = [{ showGridLines: false }];
  summary.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };

  function addSheet(
    name: string,
    cols: { header: string; width: number }[],
    sheetSubtitle: string,
  ) {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = cols.map((col) => ({ width: col.width }));
    paintExcelBanner(sheet, cols.length, C, hotelName, sheetSubtitle, hotel);
    sheet.getRow(4).height = 8;
    const header = sheet.getRow(5);
    cols.forEach((col, i) => {
      header.getCell(i + 1).value = col.header;
    });
    styleExcelHeader(header, cols.length, C);
    setupExcelSheet(sheet, cols.length, C, hotelName, "PMS Reservations");
    return sheet;
  }

  // ── Reservations ─────────────────────────────────────────
  const resCols = [
    { header: "Reservation No.", width: 16 },
    { header: "Guest Name", width: 24 },
    { header: "Address", width: 32 },
    { header: "Contact Number", width: 16 },
    { header: "Email", width: 26 },
    { header: "Made On", width: 14 },
    { header: "Check-in", width: 13 },
    { header: "Check-out", width: 13 },
    { header: "Nights", width: 10 },
    { header: "Room", width: 12 },
    { header: "Room Type", width: 16 },
    { header: "Adults", width: 10 },
    { header: "Children", width: 11 },
    { header: "Guests", width: 10 },
    { header: "Stay Status", width: 14 },
    { header: "Payment Status", width: 16 },
    { header: "Total Amount", width: 14 },
    { header: "Required Deposit", width: 16 },
    { header: "Amount Paid", width: 14 },
    { header: "Remaining Balance", width: 16 },
    { header: "Mode of Payment", width: 18 },
    { header: "Source", width: 14 },
    { header: "Notes", width: 28 },
  ];
  const resSheet = addSheet("Reservations", resCols, "Bookings — guest, stay & payment");
  if (rows.length === 0) {
    excelEmptyRow(resSheet, 6, resCols.length, "No reservations in this export.", C);
  } else {
    rows.forEach((row, i) => {
      const r = resSheet.getRow(6 + i);
      const values = [
        row.reservationNumber,
        row.guestName,
        row.address,
        row.contactNumber,
        row.email,
        row.reservationDate,
        row.checkInDate,
        row.checkOutDate,
        row.nights,
        row.roomNumber,
        row.roomType,
        row.adults,
        row.children,
        row.numberOfGuests,
        row.reservationStatus,
        row.paymentStatus,
        row.totalAmount,
        row.requiredDeposit,
        row.depositAmount,
        row.remainingBalance,
        row.paymentMode,
        row.source,
        row.notes,
      ];
      values.forEach((v, c) => {
        r.getCell(c + 1).value = v;
      });
      styleExcelDataRow(r, resCols.length, i, C);
      r.getCell(4).numFmt = "@";
      moneyFmt(r.getCell(17));
      moneyFmt(r.getCell(18));
      moneyFmt(r.getCell(19));
      moneyFmt(r.getCell(20));
      const stay = stayFill(row.reservationStatus);
      styleExcelChip(r.getCell(15), stay.bg, stay.fg);
      const pay = payFill(row.paymentStatus);
      styleExcelChip(r.getCell(16), pay.bg, pay.fg);
    });
  }

  // ── Guests ───────────────────────────────────────────────
  const guestCols = [
    { header: "Guest Name", width: 26 },
    { header: "Contact Number", width: 16 },
    { header: "Email", width: 26 },
    { header: "Address", width: 32 },
    { header: "ID Type", width: 14 },
    { header: "ID Number", width: 16 },
    { header: "Nationality", width: 14 },
    { header: "Bookings", width: 12 },
    { header: "Total Amount", width: 14 },
    { header: "Amount Paid", width: 14 },
    { header: "Balance", width: 14 },
    { header: "Notes", width: 28 },
  ];
  const guestSheet = addSheet("Guests", guestCols, "Guests on these reservations");
  if (guests.length === 0) {
    excelEmptyRow(guestSheet, 6, guestCols.length, "No guest profiles in this export.", C);
  } else {
    guests.forEach((guest, i) => {
      const theirs = rowsByGuest.get(guest.id) ?? [];
      const r = guestSheet.getRow(6 + i);
      const values = [
        guest.fullName,
        guest.contactNumber?.trim() || "—",
        guest.email?.trim() || "—",
        guest.address?.trim() || "—",
        guest.idType?.trim() || "—",
        guest.idNumber?.trim() || "—",
        guest.nationality?.trim() || "—",
        theirs.length,
        theirs.reduce((sum, row) => sum + row.totalAmount, 0),
        theirs.reduce((sum, row) => sum + row.depositAmount, 0),
        theirs.reduce((sum, row) => sum + row.remainingBalance, 0),
        guest.notes?.trim() || "—",
      ];
      values.forEach((v, c) => {
        r.getCell(c + 1).value = v;
      });
      styleExcelDataRow(r, guestCols.length, i, C);
      r.getCell(2).numFmt = "@";
      moneyFmt(r.getCell(9));
      moneyFmt(r.getCell(10));
      moneyFmt(r.getCell(11));
    });
  }

  // ── Rooms ────────────────────────────────────────────────
  const roomCols = [
    { header: "Room", width: 12 },
    { header: "Type", width: 16 },
    { header: "Floor", width: 10 },
    { header: "Capacity", width: 12 },
    { header: "Rate / Night", width: 14 },
    { header: "Status", width: 14 },
    { header: "Condition", width: 12 },
    { header: "Bookings", width: 12 },
    { header: "Room Nights", width: 13 },
    { header: "Total Amount", width: 14 },
    { header: "Collected", width: 14 },
    { header: "Balance", width: 14 },
  ];
  const roomSheet = addSheet("Rooms", roomCols, "Rooms used in these reservations");
  if (rooms.length === 0) {
    excelEmptyRow(roomSheet, 6, roomCols.length, "No rooms in this export.", C);
  } else {
    rooms.forEach((room, i) => {
      const theirs = rowsByRoom.get(room.id) ?? [];
      const statusLabel = roomStatusLabel(room.status);
      const r = roomSheet.getRow(6 + i);
      const values = [
        room.roomNumber,
        room.type || "—",
        room.floor?.trim() || "—",
        room.capacity,
        Number(room.pricePerNight || 0),
        statusLabel,
        String(room.condition || "—"),
        theirs.length,
        theirs.reduce((sum, row) => sum + row.nights, 0),
        theirs.reduce((sum, row) => sum + row.totalAmount, 0),
        theirs.reduce((sum, row) => sum + row.depositAmount, 0),
        theirs.reduce((sum, row) => sum + row.remainingBalance, 0),
      ];
      values.forEach((v, c) => {
        r.getCell(c + 1).value = v;
      });
      styleExcelDataRow(r, roomCols.length, i, C);
      moneyFmt(r.getCell(5));
      moneyFmt(r.getCell(10));
      moneyFmt(r.getCell(11));
      moneyFmt(r.getCell(12));
      const tone = roomFill(String(room.status));
      styleExcelChip(r.getCell(6), tone.bg, tone.fg);
    });
  }

  // ── Payments ─────────────────────────────────────────────
  const payCols = [
    { header: "Receipt No.", width: 16 },
    { header: "Date", width: 18 },
    { header: "Reservation No.", width: 16 },
    { header: "Guest Name", width: 24 },
    { header: "Room", width: 12 },
    { header: "Method", width: 18 },
    { header: "Amount", width: 14 },
    { header: "Reference", width: 18 },
    { header: "Received By", width: 16 },
    { header: "Note", width: 28 },
  ];
  const paySheet = addSheet("Payments", payCols, "Payments for these reservations");
  if (payments.length === 0) {
    excelEmptyRow(paySheet, 6, payCols.length, "No payment records for these reservations.", C);
  } else {
    payments.forEach((p, i) => {
      const res = reservations.find((r) => r.id === p.reservationId);
      const r = paySheet.getRow(6 + i);
      const values = [
        p.receiptNumber || "—",
        p.createdAt ? ymdPh(p.createdAt) : "—",
        p.reservationNumber || res?.reservationNumber || "—",
        p.guestName || res?.guestName || "—",
        p.roomNumber || res?.roomNumber || "—",
        paymentMethodLabel(p.paymentMethod || p.method),
        Number(p.amount || 0),
        p.referenceNo?.trim() || "—",
        p.receivedBy?.trim() || "—",
        p.note?.trim() || "—",
      ];
      values.forEach((v, c) => {
        r.getCell(c + 1).value = v;
      });
      styleExcelDataRow(r, payCols.length, i, C);
      moneyFmt(r.getCell(7));
      const tone = { bg: C.greenBg, fg: C.greenFg };
      styleExcelChip(r.getCell(6), C.skyBg, C.skyFg);
      r.getCell(7).font = { name: "Calibri", size: 10, bold: true, color: { argb: tone.fg } };
    });
  }

  await excelWriteDownload(workbook, input.filename);
}
