import type { Payment, Reservation, Room } from "@/lib/api-client/types";
import type { PosOrder } from "@/lib/api-client/pos-types";
import { formatPhDate, formatPhDateTime, formatPhTime, ymdPh } from "@/lib/datetime";
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
import { appendPosToPaymentDetails, posOrdersForReservation } from "@/lib/pos-folio";
import { latestPaymentMethod } from "@/lib/reservation-excel";
import {
  peso,
  remainingBalance,
  reservationPaymentStatus,
} from "@/lib/reservation-payment";
import {
  dateInRange,
  isCancelled,
  stayOverlapsRange,
  ymd,
} from "@/lib/stays-summary-stats";

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

function agencyLabel(source?: string | null) {
  const raw = String(source ?? "").trim();
  if (!raw) return "—";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function checkInTimeLabel(res: Reservation, scheduledCheckInTime?: string) {
  if (res.actualCheckInAt) return formatPhDateTime(res.actualCheckInAt);
  const day = formatPhDate(res.checkInDate);
  const time = scheduledCheckInTime?.trim();
  if (time) {
    // settings.checkInTime is usually "14:00" — show with the scheduled day
    try {
      const [hh, mm] = time.split(":").map(Number);
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        const stamp = `${ymd(res.checkInDate)}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
        return `${formatPhDate(stamp)} ${formatPhTime(stamp)} (scheduled)`;
      }
    } catch {
      /* fall through */
    }
    return `${day} ${time} (scheduled)`;
  }
  return `${day} (scheduled)`;
}

function paymentDetailsLabel(
  res: Reservation,
  payments: Payment[],
  posOrders: PosOrder[] = [],
) {
  const total = Number(res.totalAmount || 0);
  const paid = Number(res.paidAmount || 0);
  const balance = remainingBalance(total, paid);
  const status = reservationPaymentStatus(total, paid);
  const method = latestPaymentMethod(res.id, payments);
  const parts = [
    status,
    `Total ${peso(total)}`,
    `Paid ${peso(paid)}`,
    `Balance ${peso(balance)}`,
  ];
  if (method) parts.push(method);
  return appendPosToPaymentDetails(parts.join(" · "), posOrdersForReservation(posOrders, res.id));
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

function moneyFmt(cell: import("exceljs").Cell) {
  cell.numFmt = '"₱"#,##0.00';
}

type StayRow = {
  reservationNumber: string;
  guestName: string;
  roomNumber: string;
  roomType: string;
  roomDetails: string;
  reservationDate: string;
  checkInTime: string;
  checkOutDate: string;
  agency: string;
  specialRequest: string;
  paymentDetails: string;
  paymentStatus: string;
  stayStatus: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
};

function roomDetailsLabel(res: Reservation, room?: Room) {
  const roomNumber = res.roomNumber || room?.roomNumber || "";
  const roomType = room?.type ? String(room.type) : "";
  const details = [roomType, roomNumber ? `Room ${roomNumber}` : ""]
    .filter(Boolean)
    .join(" ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    roomNumber: roomNumber || "—",
    roomType: roomType || "—",
    roomDetails: details || roomNumber || "—",
  };
}

function buildStayRows(
  reservations: Reservation[],
  payments: Payment[],
  roomsById: Map<string, Room>,
  roomsByNumber: Map<string, Room>,
  scheduledCheckInTime?: string,
  posOrders: PosOrder[] = [],
): StayRow[] {
  return reservations.map((res) => {
    const total = Number(res.totalAmount || 0);
    const paid = Number(res.paidAmount || 0);
    const room =
      roomsById.get(res.roomId) ||
      (res.roomNumber ? roomsByNumber.get(res.roomNumber) : undefined);
    const roomInfo = roomDetailsLabel(res, room);
    return {
      reservationNumber: res.reservationNumber || "—",
      guestName: res.guestName || "—",
      roomNumber: roomInfo.roomNumber,
      roomType: roomInfo.roomType,
      roomDetails: roomInfo.roomDetails,
      reservationDate: res.createdAt ? ymdPh(res.createdAt) : "—",
      checkInTime: checkInTimeLabel(res, scheduledCheckInTime),
      checkOutDate: res.checkOutDate.slice(0, 10),
      agency: agencyLabel(res.source),
      specialRequest: String(res.notes || "").trim() || "—",
      paymentDetails: paymentDetailsLabel(res, payments, posOrders),
      paymentStatus: reservationPaymentStatus(total, paid),
      stayStatus: stayStatusLabel(res.status),
      totalAmount: total,
      paidAmount: paid,
      remainingBalance: remainingBalance(total, paid),
    };
  });
}

export async function downloadStaySummaryExcel(opts: {
  hotel?: ExcelHotel & { checkInTime?: string; email?: string };
  from: string;
  to: string;
  reservations: Reservation[];
  rooms: Room[];
  payments?: Payment[];
  posOrders?: PosOrder[];
  filename?: string;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PalawanSU Hotel PMS";
  workbook.lastModifiedBy = "PalawanSU Hotel PMS";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = opts.hotel?.hotelName?.trim() || "PalawanSU Hotel";

  const hotelName = workbook.company;
  const hotel: ExcelHotel = {
    hotelName,
    address: opts.hotel?.address,
    contactNumber: opts.hotel?.contactNumber,
  };
  const from = ymd(opts.from);
  const to = ymd(opts.to);
  const fromLabel = formatPhDate(from);
  const toLabel = formatPhDate(to);
  const subtitle = `Stay Summary  ·  ${fromLabel} – ${toLabel}`;
  const payments = opts.payments ?? [];
  const posOrders = opts.posOrders ?? [];
  const scheduledCheckInTime = opts.hotel?.checkInTime;
  const roomsById = new Map(opts.rooms.map((room) => [room.id, room]));
  const roomsByNumber = new Map(opts.rooms.map((room) => [room.roomNumber, room]));

  const overlapping = [...opts.reservations]
    .filter((r) => stayOverlapsRange(r, from, to))
    .sort(
      (a, b) =>
        ymd(a.checkInDate).localeCompare(ymd(b.checkInDate)) ||
        a.guestName.localeCompare(b.guestName),
    );
  const checkIns = [...opts.reservations]
    .filter((r) => !isCancelled(r.status) && dateInRange(r.checkInDate, from, to))
    .sort(
      (a, b) =>
        ymd(a.checkInDate).localeCompare(ymd(b.checkInDate)) ||
        a.guestName.localeCompare(b.guestName),
    );
  const checkOuts = [...opts.reservations]
    .filter((r) => !isCancelled(r.status) && dateInRange(r.checkOutDate, from, to))
    .sort(
      (a, b) =>
        ymd(a.checkOutDate).localeCompare(ymd(b.checkOutDate)) ||
        a.guestName.localeCompare(b.guestName),
    );

  const rows = buildStayRows(
    overlapping,
    payments,
    roomsById,
    roomsByNumber,
    scheduledCheckInTime,
    posOrders,
  );
  const checkInRows = buildStayRows(
    checkIns,
    payments,
    roomsById,
    roomsByNumber,
    scheduledCheckInTime,
    posOrders,
  );
  const checkOutRows = buildStayRows(
    checkOuts,
    payments,
    roomsById,
    roomsByNumber,
    scheduledCheckInTime,
    posOrders,
  );

  const stayCounts = {
    reserved: 0,
    checkedIn: 0,
    checkedOut: 0,
    cancelled: 0,
  };
  let totalAmount = 0;
  let paidAmount = 0;
  let balanceAmount = 0;
  for (const row of rows) {
    totalAmount += row.totalAmount;
    paidAmount += row.paidAmount;
    balanceAmount += row.remainingBalance;
    if (row.stayStatus === "Reserved") stayCounts.reserved += 1;
    else if (row.stayStatus === "Checked In") stayCounts.checkedIn += 1;
    else if (row.stayStatus === "Checked Out") stayCounts.checkedOut += 1;
    else if (row.stayStatus === "Cancelled" || row.stayStatus === "No Show") stayCounts.cancelled += 1;
  }

  const pesoText = (n: number) =>
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
    { label: "RESERVATIONS", value: String(rows.length), bg: C.header, range: "A5:B6" },
    { label: "CHECK-INS", value: String(checkIns.length), bg: "FF047857", range: "C5:D6" },
    { label: "CHECK-OUTS", value: String(checkOuts.length), bg: C.deep, range: "E5:F6" },
    { label: "IN-HOUSE", value: String(stayCounts.checkedIn), bg: "FFD97706", range: "G5:H6" },
    { label: "RESERVED", value: String(stayCounts.reserved), bg: "FF9A3412", range: "A7:B8" },
    { label: "CANCELLED", value: String(stayCounts.cancelled), bg: "FFBE123C", range: "C7:D8" },
    { label: "TOTAL AMOUNT", value: pesoText(totalAmount), bg: C.dark, range: "E7:F8" },
    { label: "BALANCE DUE", value: pesoText(balanceAmount), bg: "FF9F1239", range: "G7:H8" },
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
  summary.getCell("A10").value = "Range snapshot";
  summary.getCell("A10").font = { name: "Calibri", size: 12, bold: true, color: { argb: C.deep } };
  summary.getCell("A10").alignment = { vertical: "middle", indent: 1 };

  const snapRow = summary.getRow(11);
  ["Metric", "Value", "Notes"].forEach((h, i) => {
    snapRow.getCell(i + 1).value = h;
  });
  styleExcelHeader(snapRow, 3, C);
  summary.mergeCells("C11:H11");
  const snapshot: [string, string | number, string][] = [
    ["Date range", `${from} – ${to}`, "Inclusive hotel calendar dates"],
    ["Overlapping stays", rows.length, "Any stay touching this range"],
    ["Check-ins in range", checkIns.length, "Scheduled check-in date in range"],
    ["Check-outs in range", checkOuts.length, "Scheduled check-out date in range"],
    ["Currently checked in", stayCounts.checkedIn, "In-house among overlapping stays"],
    ["Total amount", totalAmount, "Gross value of overlapping stays"],
    ["Amount collected", paidAmount, "Deposits and payments received"],
    ["Remaining balance", balanceAmount, "Still due from guests"],
    ["Rooms in list", new Set(rows.map((r) => r.roomNumber).filter((n) => n !== "—")).size, "Distinct room numbers"],
  ];
  snapshot.forEach((row, i) => {
    const r = summary.getRow(12 + i);
    r.getCell(1).value = row[0];
    r.getCell(2).value = row[1];
    r.getCell(3).value = row[2];
    summary.mergeCells(12 + i, 3, 12 + i, 8);
    styleExcelDataRow(r, 8, i, C);
    r.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: C.ink } };
    if (i === 5 || i === 6 || i === 7) moneyFmt(r.getCell(2));
  });
  summary.views = [{ showGridLines: false }];
  summary.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };

  const detailCols = [
    { header: "Reservation Num", width: 16 },
    { header: "Guest Name", width: 24 },
    { header: "Room Details", width: 22 },
    { header: "Room", width: 12 },
    { header: "Room Type", width: 16 },
    { header: "Reservation Date", width: 15 },
    { header: "Check-in Time", width: 26 },
    { header: "Check-out Date", width: 14 },
    { header: "Agency", width: 16 },
    { header: "Special Request", width: 32 },
    { header: "Payment Details", width: 48 },
    { header: "Stay Status", width: 14 },
    { header: "Payment Status", width: 16 },
  ];

  function addDetailSheet(name: string, sheetSubtitle: string, data: StayRow[]) {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = detailCols.map((col) => ({ width: col.width }));
    paintExcelBanner(sheet, detailCols.length, C, hotelName, sheetSubtitle, hotel);
    sheet.getRow(4).height = 8;
    const header = sheet.getRow(5);
    detailCols.forEach((col, i) => {
      header.getCell(i + 1).value = col.header;
    });
    styleExcelHeader(header, detailCols.length, C);
    setupExcelSheet(sheet, detailCols.length, C, hotelName, "PMS Stay Summary");

    if (data.length === 0) {
      excelEmptyRow(sheet, 6, detailCols.length, "No stays in this section for the selected range.", C);
      return;
    }

    data.forEach((row, i) => {
      const r = sheet.getRow(6 + i);
      const values = [
        row.reservationNumber,
        row.guestName,
        row.roomDetails,
        row.roomNumber,
        row.roomType,
        row.reservationDate,
        row.checkInTime,
        row.checkOutDate,
        row.agency,
        row.specialRequest,
        row.paymentDetails,
        row.stayStatus,
        row.paymentStatus,
      ];
      values.forEach((v, c) => {
        r.getCell(c + 1).value = v;
      });
      styleExcelDataRow(r, detailCols.length, i, C);
      r.getCell(10).alignment = { vertical: "middle", wrapText: true };
      r.getCell(11).alignment = { vertical: "middle", wrapText: true };
      if (row.specialRequest.length > 40 || row.paymentDetails.length > 50) {
        r.height = 32;
      }
      const stay = stayFill(row.stayStatus);
      styleExcelChip(r.getCell(12), stay.bg, stay.fg);
      const pay = payFill(row.paymentStatus);
      styleExcelChip(r.getCell(13), pay.bg, pay.fg);
    });
  }

  addDetailSheet("Reservations", "All overlapping stays — guest, room, agency & payment", rows);
  addDetailSheet("Check-ins", "Check-ins scheduled in this range", checkInRows);
  addDetailSheet("Check-outs", "Check-outs scheduled in this range", checkOutRows);

  // ── Rooms ────────────────────────────────────────────────
  const occupancyStays = overlapping.filter((r) => !isCancelled(r.status));
  const byRoom = new Map<string, StayRow[]>();
  for (const row of buildStayRows(
    occupancyStays,
    payments,
    roomsById,
    roomsByNumber,
    scheduledCheckInTime,
    posOrders,
  )) {
    const key = row.roomNumber || "Unassigned";
    const list = byRoom.get(key) ?? [];
    list.push(row);
    byRoom.set(key, list);
  }
  const roomCols = [
    { header: "Room Details", width: 22 },
    { header: "Room", width: 12 },
    { header: "Room Type", width: 16 },
    { header: "Guest Name", width: 24 },
    { header: "Reservation Num", width: 16 },
    { header: "Check-in Time", width: 26 },
    { header: "Check-out Date", width: 14 },
    { header: "Agency", width: 14 },
    { header: "Special Request", width: 28 },
    { header: "Payment Details", width: 42 },
  ];
  const roomSheet = workbook.addWorksheet("By Room");
  roomSheet.columns = roomCols.map((col) => ({ width: col.width }));
  paintExcelBanner(roomSheet, roomCols.length, C, hotelName, "Guests by room in this range", hotel);
  roomSheet.getRow(4).height = 8;
  const roomHeader = roomSheet.getRow(5);
  roomCols.forEach((col, i) => {
    roomHeader.getCell(i + 1).value = col.header;
  });
  styleExcelHeader(roomHeader, roomCols.length, C);
  setupExcelSheet(roomSheet, roomCols.length, C, hotelName, "PMS Stay Summary");

  const roomEntries = [...byRoom.entries()].sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  if (roomEntries.length === 0) {
    excelEmptyRow(roomSheet, 6, roomCols.length, "No occupied rooms in this range.", C);
  } else {
    let rowNo = 6;
    let alt = 0;
    for (const [, stays] of roomEntries) {
      for (const stay of stays) {
        const r = roomSheet.getRow(rowNo);
        const values = [
          stay.roomDetails,
          stay.roomNumber,
          stay.roomType,
          stay.guestName,
          stay.reservationNumber,
          stay.checkInTime,
          stay.checkOutDate,
          stay.agency,
          stay.specialRequest,
          stay.paymentDetails,
        ];
        values.forEach((v, c) => {
          r.getCell(c + 1).value = v;
        });
        styleExcelDataRow(r, roomCols.length, alt, C);
        r.getCell(9).alignment = { vertical: "middle", wrapText: true };
        r.getCell(10).alignment = { vertical: "middle", wrapText: true };
        rowNo += 1;
        alt += 1;
      }
    }
  }

  await excelWriteDownload(
    workbook,
    opts.filename ?? `stay-summary-${from}-to-${to}.xlsx`,
  );
}
