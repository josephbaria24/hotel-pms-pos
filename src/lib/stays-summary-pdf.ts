import { jsPDF } from "jspdf";
import type { Reservation, Room } from "@/lib/api-client/types";
import { formatPhDate, formatPhDateTime, staysOverlap } from "@/lib/datetime";

export type StaySummaryHotel = {
  hotelName: string;
  address?: string;
  contactNumber?: string;
  email?: string;
};

type Rgb = [number, number, number];

const PAGE_W = 210;
const PAGE_H = 297;
const MX = 16;
const MY_TOP = 16;
const MY_BOTTOM = 18;
const CONTENT_W = PAGE_W - MX * 2;

const INK: Rgb = [15, 23, 41];
const MUTED: Rgb = [100, 116, 139];
const LINE: Rgb = [226, 232, 240];
/** PMS sidebar navy — hsl(220 26% 13%) */
const NAVY: Rgb = [24, 31, 42];
/** PMS primary orange — #FF4400 */
const ORANGE: Rgb = [255, 68, 0];
const ORANGE_SOFT: Rgb = [255, 186, 140];
const HEADER_BG: Rgb = NAVY;
const ROW_ALT: Rgb = [248, 249, 252];
const WHITE: Rgb = [255, 255, 255];
const ORANGE_WASH: Rgb = [255, 247, 242];
const ORANGE_EDGE: Rgb = [255, 205, 184];

const STATUS_RGB: Record<string, Rgb> = {
  reserved: ORANGE,
  checked_in: NAVY,
  checked_out: [37, 49, 71],
  cancelled: [185, 28, 28],
  no_show: [113, 113, 122],
};

function ymd(value: string): string {
  return value.slice(0, 10);
}

function dayAfter(date: string): string {
  const [y, m, d] = ymd(date).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + 1));
  return dt.toISOString().slice(0, 10);
}

function stayOverlapsRange(res: Reservation, from: string, to: string): boolean {
  return staysOverlap(ymd(res.checkInDate), ymd(res.checkOutDate), from, dayAfter(to));
}

function dateInRange(iso: string, from: string, to: string): boolean {
  const day = ymd(iso);
  return day >= from && day <= to;
}

function isCancelled(status: string): boolean {
  return status === "cancelled" || status === "no_show";
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function paxLabel(res: Reservation): string {
  const adults = Number(res.adults || 0);
  const children = Number(res.children || 0);
  if (children > 0) return `${adults} ad / ${children} ch`;
  return `${adults} guest${adults === 1 ? "" : "s"}`;
}

function fitText(doc: jsPDF, text: string, maxWidth: number): string {
  if (!text) return "—";
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function fill(doc: jsPDF, rgb: Rgb) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function stroke(doc: jsPDF, rgb: Rgb) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function ink(doc: jsPDF, rgb: Rgb) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

type Col = {
  label: string;
  width: number;
  align?: "left" | "right" | "center";
};

class PdfLayout {
  doc: jsPDF;
  y: number;
  fromLabel: string;
  toLabel: string;
  hotelName: string;

  constructor(doc: jsPDF, hotelName: string, fromLabel: string, toLabel: string) {
    this.doc = doc;
    this.y = MY_TOP;
    this.hotelName = hotelName;
    this.fromLabel = fromLabel;
    this.toLabel = toLabel;
  }

  ensureSpace(height: number): boolean {
    if (this.y + height <= PAGE_H - MY_BOTTOM) return false;
    this.doc.addPage();
    this.drawRunningHeader();
    return true;
  }

  drawRunningHeader() {
    const { doc } = this;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    ink(doc, NAVY);
    doc.text(this.hotelName, MX, 10);
    doc.setFont("helvetica", "normal");
    ink(doc, MUTED);
    doc.text(`${this.fromLabel}  –  ${this.toLabel}`, PAGE_W - MX, 10, { align: "right" });
    stroke(doc, ORANGE);
    doc.setLineWidth(0.45);
    doc.line(MX, 12.5, PAGE_W - MX, 12.5);
    this.y = 18;
  }
}

function drawCover(
  layout: PdfLayout,
  hotel: StaySummaryHotel,
  from: string,
  to: string,
) {
  const { doc } = layout;
  fill(doc, HEADER_BG);
  doc.roundedRect(MX, layout.y, CONTENT_W, 38, 3, 3, "F");
  fill(doc, ORANGE);
  doc.rect(MX, layout.y, 3.2, 38, "F");

  ink(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(hotel.hotelName || "Hotel", MX + 10, layout.y + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  ink(doc, [203, 213, 225]);
  const meta: string[] = [];
  if (hotel.address?.trim()) meta.push(hotel.address.trim());
  if (hotel.contactNumber?.trim()) meta.push(hotel.contactNumber.trim());
  if (hotel.email?.trim()) meta.push(hotel.email.trim());
  const metaLine = meta.join("  ·  ") || "Front office stay report";
  doc.text(fitText(doc, metaLine, CONTENT_W - 18), MX + 10, layout.y + 19);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  ink(doc, WHITE);
  doc.text("Stay Movement Summary", MX + 10, layout.y + 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  ink(doc, ORANGE_SOFT);
  doc.text(
    `${formatPhDate(from)}  –  ${formatPhDate(to)}`,
    PAGE_W - MX - 8,
    layout.y + 30,
    { align: "right" },
  );

  layout.y += 46;

  doc.setFontSize(8);
  ink(doc, MUTED);
  doc.text(`Generated ${formatPhDateTime(new Date().toISOString())}`, MX, layout.y);
  layout.y += 8;
}

function drawKpis(
  layout: PdfLayout,
  items: { label: string; value: string; accent: Rgb }[],
) {
  const gap = 3.5;
  const w = (CONTENT_W - gap * (items.length - 1)) / items.length;
  const h = 18;
  layout.ensureSpace(h + 6);

  items.forEach((item, i) => {
    const x = MX + i * (w + gap);
    fill(layout.doc, [248, 250, 252]);
    stroke(layout.doc, LINE);
    layout.doc.setLineWidth(0.25);
    layout.doc.roundedRect(x, layout.y, w, h, 2, 2, "FD");
    fill(layout.doc, item.accent);
    layout.doc.rect(x, layout.y, w, 1.4, "F");

    layout.doc.setFont("helvetica", "normal");
    layout.doc.setFontSize(7);
    ink(layout.doc, MUTED);
    layout.doc.text(item.label.toUpperCase(), x + 4, layout.y + 7);

    layout.doc.setFont("helvetica", "bold");
    layout.doc.setFontSize(13);
    ink(layout.doc, INK);
    layout.doc.text(item.value, x + 4, layout.y + 14.5);
  });

  layout.y += h + 8;
}

function drawSectionTitle(layout: PdfLayout, title: string, count: number) {
  layout.ensureSpace(14);
  layout.doc.setFont("helvetica", "bold");
  layout.doc.setFontSize(11);
  ink(layout.doc, INK);
  layout.doc.text(title, MX, layout.y);
  layout.doc.setFont("helvetica", "normal");
  layout.doc.setFontSize(8);
  ink(layout.doc, MUTED);
  layout.doc.text(`${count}`, PAGE_W - MX, layout.y, { align: "right" });
  layout.y += 2.5;
  stroke(layout.doc, ORANGE);
  layout.doc.setLineWidth(0.5);
  layout.doc.line(MX, layout.y, PAGE_W - MX, layout.y);
  layout.y += 5;
}

function drawTable(layout: PdfLayout, columns: Col[], rows: string[][], statusCol?: number) {
  const headerH = 7.4;
  const rowH = 7.2;

  const paintHeader = () => {
    fill(layout.doc, NAVY);
    layout.doc.roundedRect(MX, layout.y, CONTENT_W, headerH, 1.2, 1.2, "F");
    layout.doc.setFont("helvetica", "bold");
    layout.doc.setFontSize(7.2);
    ink(layout.doc, WHITE);
    let x = MX + 3;
    columns.forEach((col) => {
      const label = col.label.toUpperCase();
      if (col.align === "right") {
        layout.doc.text(label, x + col.width - 3, layout.y + 4.9, { align: "right" });
      } else if (col.align === "center") {
        layout.doc.text(label, x + col.width / 2, layout.y + 4.9, { align: "center" });
      } else {
        layout.doc.text(label, x, layout.y + 4.9);
      }
      x += col.width;
    });
    layout.y += headerH;
  };

  if (layout.ensureSpace(headerH + rowH)) {
    /* new page already reset y */
  }
  paintHeader();

  if (rows.length === 0) {
    layout.ensureSpace(rowH);
    fill(layout.doc, ROW_ALT);
    layout.doc.rect(MX, layout.y, CONTENT_W, rowH, "F");
    layout.doc.setFont("helvetica", "italic");
    layout.doc.setFontSize(8);
    ink(layout.doc, MUTED);
    layout.doc.text("None in this period.", MX + 4, layout.y + 4.8);
    layout.y += rowH + 6;
    return;
  }

  rows.forEach((row, rowIndex) => {
    if (layout.ensureSpace(rowH)) {
      paintHeader();
    }
    if (rowIndex % 2 === 0) {
      fill(layout.doc, ROW_ALT);
      layout.doc.rect(MX, layout.y, CONTENT_W, rowH, "F");
    }
    layout.doc.setFont("helvetica", "normal");
    layout.doc.setFontSize(7.6);
    let x = MX + 3;
    row.forEach((cell, colIndex) => {
      const col = columns[colIndex]!;
      const maxW = col.width - 5;
      const text = fitText(layout.doc, cell, maxW);
      if (colIndex === statusCol) {
        ink(layout.doc, STATUS_RGB[cell.replace(/ /g, "_")] ?? MUTED);
      } else {
        ink(layout.doc, INK);
      }
      const ty = layout.y + 4.8;
      if (col.align === "right") {
        layout.doc.text(text, x + col.width - 3, ty, { align: "right" });
      } else if (col.align === "center") {
        layout.doc.text(text, x + col.width / 2, ty, { align: "center" });
      } else {
        layout.doc.text(text, x, ty);
      }
      x += col.width;
    });
    stroke(layout.doc, LINE);
    layout.doc.setLineWidth(0.15);
    layout.doc.line(MX, layout.y + rowH, MX + CONTENT_W, layout.y + rowH);
    layout.y += rowH;
  });

  layout.y += 7;
}

function drawRoomOccupancy(
  layout: PdfLayout,
  groups: { roomNumber: string; roomType: string; stays: Reservation[] }[],
) {
  if (groups.length === 0) {
    layout.ensureSpace(12);
    layout.doc.setFont("helvetica", "italic");
    layout.doc.setFontSize(8);
    ink(layout.doc, MUTED);
    layout.doc.text("No guests occupied rooms during this period.", MX, layout.y);
    layout.y += 8;
    return;
  }

  for (const group of groups) {
    const blockH = 8.2 + 7.4 + 7.2;
    layout.ensureSpace(blockH);

    fill(layout.doc, ORANGE_WASH);
    stroke(layout.doc, ORANGE_EDGE);
    layout.doc.setLineWidth(0.25);
    layout.doc.roundedRect(MX, layout.y, CONTENT_W, 7.6, 1.2, 1.2, "FD");

    layout.doc.setFont("helvetica", "bold");
    layout.doc.setFontSize(8.5);
    ink(layout.doc, NAVY);
    const roomTitle = `Room ${group.roomNumber}${group.roomType ? `  ·  ${group.roomType}` : ""}`;
    layout.doc.text(fitText(layout.doc, roomTitle, CONTENT_W - 36), MX + 4, layout.y + 5.1);

    layout.doc.setFont("helvetica", "normal");
    layout.doc.setFontSize(7.5);
    ink(layout.doc, MUTED);
    const guestWord = group.stays.length === 1 ? "guest" : "guests";
    layout.doc.text(
      `${group.stays.length} ${guestWord}`,
      PAGE_W - MX - 4,
      layout.y + 5.1,
      { align: "right" },
    );
    layout.y += 8.2;

    const cols: Col[] = [
      { label: "Guest", width: 52 },
      { label: "Booking", width: 32 },
      { label: "Stay", width: 46 },
      { label: "Pax", width: 22 },
      { label: "Status", width: 26 },
    ];

    drawTable(
      layout,
      cols,
      group.stays.map((res) => [
        res.guestName,
        res.reservationNumber,
        `${formatPhDate(res.checkInDate)} – ${formatPhDate(res.checkOutDate)}`,
        paxLabel(res),
        statusLabel(res.status),
      ]),
      4,
    );
    layout.y -= 2;
  }
}

function addFooters(doc: jsPDF, hotelName: string, rangeLabel: string) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    stroke(doc, LINE);
    doc.setLineWidth(0.25);
    doc.line(MX, PAGE_H - 12, PAGE_W - MX, PAGE_H - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    ink(doc, MUTED);
    doc.text(
      `${hotelName}  ·  Stay summary  ·  ${rangeLabel}`,
      MX,
      PAGE_H - 7.5,
    );
    doc.text(`Page ${i} of ${total}`, PAGE_W - MX, PAGE_H - 7.5, { align: "right" });
  }
}

export function countStaySummary(reservations: Reservation[], from: string, to: string) {
  const list = reservations.filter((r) => stayOverlapsRange(r, from, to));
  const active = list.filter((r) => !isCancelled(r.status));
  const checkIns = reservations.filter(
    (r) => !isCancelled(r.status) && dateInRange(r.checkInDate, from, to),
  );
  const checkOuts = reservations.filter(
    (r) => !isCancelled(r.status) && dateInRange(r.checkOutDate, from, to),
  );
  const occupiedRooms = new Set(active.map((r) => r.roomNumber)).size;
  return {
    reservations: list.length,
    checkIns: checkIns.length,
    checkOuts: checkOuts.length,
    occupiedRooms,
  };
}

export function downloadStaySummaryPdf(opts: {
  hotel: StaySummaryHotel;
  from: string;
  to: string;
  reservations: Reservation[];
  rooms: Room[];
}) {
  const from = ymd(opts.from);
  const to = ymd(opts.to);
  const hotelName = opts.hotel.hotelName?.trim() || "Hotel";
  const fromLabel = formatPhDate(from);
  const toLabel = formatPhDate(to);

  const overlapping = [...opts.reservations]
    .filter((r) => stayOverlapsRange(r, from, to))
    .sort((a, b) => ymd(a.checkInDate).localeCompare(ymd(b.checkInDate)) || a.guestName.localeCompare(b.guestName));

  const checkIns = [...opts.reservations]
    .filter((r) => !isCancelled(r.status) && dateInRange(r.checkInDate, from, to))
    .sort((a, b) => ymd(a.checkInDate).localeCompare(ymd(b.checkInDate)) || a.guestName.localeCompare(b.guestName));

  const checkOuts = [...opts.reservations]
    .filter((r) => !isCancelled(r.status) && dateInRange(r.checkOutDate, from, to))
    .sort((a, b) => ymd(a.checkOutDate).localeCompare(ymd(b.checkOutDate)) || a.guestName.localeCompare(b.guestName));

  const occupancyStays = overlapping.filter((r) => !isCancelled(r.status));
  const roomTypeByNumber = new Map(opts.rooms.map((room) => [room.roomNumber, room.type]));
  const byRoom = new Map<string, Reservation[]>();
  for (const stay of occupancyStays) {
    const key = stay.roomNumber || "Unassigned";
    const bucket = byRoom.get(key) ?? [];
    bucket.push(stay);
    byRoom.set(key, bucket);
  }
  const roomGroups = [...byRoom.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([roomNumber, stays]) => ({
      roomNumber,
      roomType: roomTypeByNumber.get(roomNumber) ?? "",
      stays: stays.sort((a, b) => a.guestName.localeCompare(b.guestName)),
    }));

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const layout = new PdfLayout(doc, hotelName, fromLabel, toLabel);

  drawCover(layout, opts.hotel, from, to);
  drawKpis(layout, [
    { label: "Reservations", value: String(overlapping.length), accent: ORANGE },
    { label: "Check-ins", value: String(checkIns.length), accent: NAVY },
    { label: "Check-outs", value: String(checkOuts.length), accent: [37, 49, 71] },
    { label: "Rooms occupied", value: String(roomGroups.length), accent: ORANGE },
  ]);

  drawSectionTitle(layout, "All reservations", overlapping.length);
  drawTable(
    layout,
    [
      { label: "Booking", width: 30 },
      { label: "Guest", width: 46 },
      { label: "Room", width: 18 },
      { label: "Check-in", width: 28 },
      { label: "Check-out", width: 28 },
      { label: "Status", width: 28 },
    ],
    overlapping.map((res) => [
      res.reservationNumber,
      res.guestName,
      res.roomNumber,
      formatPhDate(res.checkInDate),
      formatPhDate(res.checkOutDate),
      statusLabel(res.status),
    ]),
    5,
  );

  drawSectionTitle(layout, "Check-ins", checkIns.length);
  drawTable(
    layout,
    [
      { label: "Guest", width: 46 },
      { label: "Room", width: 18 },
      { label: "Booking", width: 30 },
      { label: "Scheduled", width: 28 },
      { label: "Actual", width: 28 },
      { label: "Pax", width: 28 },
    ],
    checkIns.map((res) => [
      res.guestName,
      res.roomNumber,
      res.reservationNumber,
      formatPhDate(res.checkInDate),
      res.actualCheckInAt ? formatPhDateTime(res.actualCheckInAt) : "—",
      paxLabel(res),
    ]),
  );

  drawSectionTitle(layout, "Check-outs", checkOuts.length);
  drawTable(
    layout,
    [
      { label: "Guest", width: 46 },
      { label: "Room", width: 18 },
      { label: "Booking", width: 30 },
      { label: "Scheduled", width: 28 },
      { label: "Actual", width: 28 },
      { label: "Pax", width: 28 },
    ],
    checkOuts.map((res) => [
      res.guestName,
      res.roomNumber,
      res.reservationNumber,
      formatPhDate(res.checkOutDate),
      res.actualCheckOutAt ? formatPhDateTime(res.actualCheckOutAt) : "—",
      paxLabel(res),
    ]),
  );

  drawSectionTitle(layout, "Guests by room", occupancyStays.length);
  drawRoomOccupancy(layout, roomGroups);

  addFooters(doc, hotelName, `${fromLabel} – ${toLabel}`);
  doc.save(`stay-summary-${from}-to-${to}.pdf`);
}
