import { jsPDF } from "jspdf";
import { formatPhDate, formatPhDateTime, formatPhTime } from "@/lib/datetime";
import {
  methodLabel,
  type PosSalesSummary,
} from "@/lib/pos-sales-stats";

export type PosSalesHotel = {
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
const LINE: Rgb = [204, 228, 222];
/** POS sidebar — hsl(173 45% 12%) */
const TEAL_DARK: Rgb = [17, 44, 41];
/** POS primary — teal-600 */
const TEAL: Rgb = [13, 148, 136];
const TEAL_SOFT: Rgb = [153, 246, 228];
const TEAL_WASH: Rgb = [240, 253, 250];
const TEAL_EDGE: Rgb = [153, 237, 218];
const HEADER_BG: Rgb = TEAL_DARK;
const ROW_ALT: Rgb = [247, 254, 252];
const WHITE: Rgb = [255, 255, 255];

const CHART_PALETTE: Rgb[] = [
  TEAL,
  [16, 185, 129],
  [20, 184, 166],
  [6, 95, 90],
  [45, 212, 191],
  [15, 118, 110],
  [52, 211, 153],
  [19, 78, 74],
];

function peso(amount: number) {
  return `PHP ${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
    ink(doc, TEAL_DARK);
    doc.text(this.hotelName, MX, 10);
    doc.setFont("helvetica", "normal");
    ink(doc, MUTED);
    doc.text(`${this.fromLabel}  –  ${this.toLabel}`, PAGE_W - MX, 10, { align: "right" });
    stroke(doc, TEAL);
    doc.setLineWidth(0.45);
    doc.line(MX, 12.5, PAGE_W - MX, 12.5);
    this.y = 18;
  }
}

function drawCover(layout: PdfLayout, hotel: PosSalesHotel, from: string, to: string) {
  const { doc } = layout;
  fill(doc, HEADER_BG);
  doc.roundedRect(MX, layout.y, CONTENT_W, 38, 3, 3, "F");
  fill(doc, TEAL);
  doc.rect(MX, layout.y, 3.2, 38, "F");

  ink(doc, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(hotel.hotelName || "Hotel", MX + 10, layout.y + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  ink(doc, [190, 242, 230]);
  const meta: string[] = [];
  if (hotel.address?.trim()) meta.push(hotel.address.trim());
  if (hotel.contactNumber?.trim()) meta.push(hotel.contactNumber.trim());
  if (hotel.email?.trim()) meta.push(hotel.email.trim());
  doc.text(fitText(doc, meta.join("  ·  ") || "Point of sale report", CONTENT_W - 18), MX + 10, layout.y + 19);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  ink(doc, WHITE);
  doc.text("POS Sales Summary", MX + 10, layout.y + 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  ink(doc, TEAL_SOFT);
  const range =
    from === to ? formatPhDate(from) : `${formatPhDate(from)}  –  ${formatPhDate(to)}`;
  doc.text(range, PAGE_W - MX - 8, layout.y + 30, { align: "right" });

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
    fill(layout.doc, TEAL_WASH);
    stroke(layout.doc, TEAL_EDGE);
    layout.doc.setLineWidth(0.25);
    layout.doc.roundedRect(x, layout.y, w, h, 2, 2, "FD");
    fill(layout.doc, item.accent);
    layout.doc.rect(x, layout.y, w, 1.4, "F");

    layout.doc.setFont("helvetica", "normal");
    layout.doc.setFontSize(6.5);
    ink(layout.doc, MUTED);
    layout.doc.text(item.label.toUpperCase(), x + 3.5, layout.y + 7);

    layout.doc.setFont("helvetica", "bold");
    layout.doc.setFontSize(item.value.length > 12 ? 9 : 11);
    ink(layout.doc, INK);
    layout.doc.text(fitText(layout.doc, item.value, w - 7), x + 3.5, layout.y + 14.2);
  });

  layout.y += h + 8;
}

function drawSectionTitle(layout: PdfLayout, title: string, count?: string) {
  layout.ensureSpace(14);
  layout.doc.setFont("helvetica", "bold");
  layout.doc.setFontSize(11);
  ink(layout.doc, INK);
  layout.doc.text(title, MX, layout.y);
  if (count) {
    layout.doc.setFont("helvetica", "normal");
    layout.doc.setFontSize(8);
    ink(layout.doc, MUTED);
    layout.doc.text(count, PAGE_W - MX, layout.y, { align: "right" });
  }
  layout.y += 2.5;
  stroke(layout.doc, TEAL);
  layout.doc.setLineWidth(0.5);
  layout.doc.line(MX, layout.y, PAGE_W - MX, layout.y);
  layout.y += 5;
}

function drawTable(layout: PdfLayout, columns: Col[], rows: string[][]) {
  const headerH = 7.4;
  const rowH = 7.2;

  const paintHeader = () => {
    fill(layout.doc, TEAL_DARK);
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

  layout.ensureSpace(headerH + rowH);
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
    if (layout.ensureSpace(rowH)) paintHeader();
    if (rowIndex % 2 === 0) {
      fill(layout.doc, ROW_ALT);
      layout.doc.rect(MX, layout.y, CONTENT_W, rowH, "F");
    }
    layout.doc.setFont("helvetica", "normal");
    layout.doc.setFontSize(7.6);
    ink(layout.doc, INK);
    let x = MX + 3;
    row.forEach((cell, colIndex) => {
      const col = columns[colIndex]!;
      const text = fitText(layout.doc, cell, col.width - 5);
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

function drawHBarChart(
  layout: PdfLayout,
  rows: { label: string; value: number; hint?: string }[],
) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const rowH = 9;
  const chartH = Math.max(rows.length * rowH, 16);
  layout.ensureSpace(chartH + 4);

  if (rows.length === 0) {
    layout.doc.setFont("helvetica", "italic");
    layout.doc.setFontSize(8);
    ink(layout.doc, MUTED);
    layout.doc.text("No payment mix for this period.", MX, layout.y + 4);
    layout.y += 12;
    return;
  }

  rows.forEach((row, i) => {
    const y = layout.y + i * rowH;
    layout.doc.setFont("helvetica", "normal");
    layout.doc.setFontSize(7.4);
    ink(layout.doc, INK);
    layout.doc.text(fitText(layout.doc, row.label, 38), MX, y + 5);

    const barX = MX + 40;
    const barW = CONTENT_W - 78;
    fill(layout.doc, [226, 242, 238]);
    layout.doc.roundedRect(barX, y + 1.6, barW, 5.2, 1.1, 1.1, "F");
    const w = Math.max(1.6, (row.value / max) * barW);
    fill(layout.doc, CHART_PALETTE[i % CHART_PALETTE.length]!);
    layout.doc.roundedRect(barX, y + 1.6, w, 5.2, 1.1, 1.1, "F");

    layout.doc.setFont("helvetica", "bold");
    layout.doc.setFontSize(7.2);
    ink(layout.doc, TEAL_DARK);
    layout.doc.text(row.hint ?? peso(row.value), PAGE_W - MX, y + 5, { align: "right" });
  });

  layout.y += chartH + 6;
}

function drawVBarChart(
  layout: PdfLayout,
  rows: { label: string; value: number }[],
) {
  const h = 42;
  layout.ensureSpace(h + 14);
  const max = Math.max(...rows.map((r) => r.value), 1);
  const gap = 1.2;
  const barW = Math.min(8, (CONTENT_W - gap * Math.max(rows.length - 1, 0)) / Math.max(rows.length, 1));
  const baseY = layout.y + h;

  stroke(layout.doc, LINE);
  layout.doc.setLineWidth(0.2);
  layout.doc.line(MX, baseY, MX + CONTENT_W, baseY);

  rows.forEach((row, i) => {
    const x = MX + i * (barW + gap);
    const bh = Math.max(row.value > 0 ? 1.4 : 0, (row.value / max) * (h - 4));
    fill(layout.doc, i % 2 === 0 ? TEAL : [45, 212, 191]);
    layout.doc.roundedRect(x, baseY - bh, barW, bh, 0.6, 0.6, "F");
    layout.doc.setFont("helvetica", "normal");
    layout.doc.setFontSize(5.4);
    ink(layout.doc, MUTED);
    layout.doc.text(row.label, x + barW / 2, baseY + 4, { align: "center" });
  });

  layout.y += h + 12;
}

function drawDonut(
  layout: PdfLayout,
  slices: { label: string; value: number; color: Rgb }[],
) {
  const h = 46;
  layout.ensureSpace(h + 6);
  const usable = slices.filter((s) => s.value > 0);
  const total = usable.reduce((sum, s) => sum + s.value, 0);

  const cx = MX + 28;
  const cy = layout.y + 22;
  const r = 18;

  if (total <= 0) {
    fill(layout.doc, [226, 242, 238]);
    layout.doc.circle(cx, cy, r, "F");
    fill(layout.doc, WHITE);
    layout.doc.circle(cx, cy, 9, "F");
    layout.doc.setFont("helvetica", "italic");
    layout.doc.setFontSize(8);
    ink(layout.doc, MUTED);
    layout.doc.text("No tickets to chart.", MX + 54, cy);
    layout.y += h;
    return;
  }

  let angle = -Math.PI / 2;
  for (const slice of usable) {
    const sweep = (slice.value / total) * Math.PI * 2;
    const steps = Math.max(10, Math.ceil(Math.abs(sweep) / 0.12));
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const a = angle + (sweep * i) / steps;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    fill(layout.doc, slice.color);
    for (let i = 0; i < pts.length - 1; i++) {
      layout.doc.triangle(cx, cy, pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1], "F");
    }
    angle += sweep;
  }
  fill(layout.doc, WHITE);
  layout.doc.circle(cx, cy, 9, "F");
  layout.doc.setFont("helvetica", "bold");
  layout.doc.setFontSize(8);
  ink(layout.doc, TEAL_DARK);
  layout.doc.text(String(total), cx, cy + 1.2, { align: "center" });

  let ly = layout.y + 8;
  usable.forEach((slice) => {
    fill(layout.doc, slice.color);
    layout.doc.roundedRect(MX + 54, ly - 2.4, 4, 4, 0.6, 0.6, "F");
    layout.doc.setFont("helvetica", "normal");
    layout.doc.setFontSize(8);
    ink(layout.doc, INK);
    const pct = ((slice.value / total) * 100).toFixed(0);
    layout.doc.text(`${slice.label}  ·  ${slice.value}  (${pct}%)`, MX + 61, ly);
    ly += 7;
  });

  layout.y += h + 4;
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
    doc.text(`${hotelName}  ·  POS sales  ·  ${rangeLabel}`, MX, PAGE_H - 7.5);
    doc.text(`Page ${i} of ${total}`, PAGE_W - MX, PAGE_H - 7.5, { align: "right" });
  }
}

export function downloadPosSalesPdf(opts: {
  hotel: PosSalesHotel;
  from: string;
  to: string;
  summary: PosSalesSummary;
}) {
  const hotelName = opts.hotel.hotelName?.trim() || "Hotel";
  const fromLabel = formatPhDate(opts.from);
  const toLabel = formatPhDate(opts.to);
  const rangeLabel = opts.from === opts.to ? fromLabel : `${fromLabel} – ${toLabel}`;
  const s = opts.summary;

  const methodRows = Object.entries(s.byMethod)
    .map(([method, row]) => ({
      label: methodLabel(method),
      value: row.amount,
      hint: `${peso(row.amount)}  ·  ${row.count}`,
    }))
    .sort((a, b) => b.value - a.value);

  const hourRows = s.byHour
    .filter((h) => h.count > 0)
    .map((h) => ({
      label: `${String(h.hour).padStart(2, "0")}`,
      value: h.amount,
    }));

  const dayRows = s.byDay.map((d) => ({
    label: d.day.slice(5),
    value: d.amount,
  }));
  const useDaily = opts.from !== opts.to;
  const trendRows = useDaily
    ? dayRows.length > 16
      ? dayRows.filter((_, i) => i % Math.ceil(dayRows.length / 16) === 0)
      : dayRows
    : hourRows.length > 0
      ? hourRows
      : [{ label: "—", value: 0 }];

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const layout = new PdfLayout(doc, hotelName, fromLabel, toLabel);

  drawCover(layout, opts.hotel, opts.from, opts.to);
  drawKpis(layout, [
    { label: "Gross sales", value: peso(s.gross), accent: TEAL },
    { label: "Net sales", value: peso(s.net), accent: TEAL_DARK },
    { label: "Paid tickets", value: String(s.paidCount), accent: TEAL },
    { label: "Avg ticket", value: peso(s.avgTicket), accent: [15, 118, 110] },
  ]);
  drawKpis(layout, [
    { label: "Tax", value: peso(s.tax), accent: [13, 148, 136] },
    { label: "Discounts", value: peso(s.discount), accent: [6, 95, 70] },
    { label: "Voids", value: `${s.voidCount}`, accent: [185, 28, 28] },
    { label: "Open / held", value: `${s.openCount + s.heldCount}`, accent: TEAL_DARK },
  ]);

  drawSectionTitle(layout, "Payment mix", peso(methodRows.reduce((n, r) => n + r.value, 0)));
  drawHBarChart(layout, methodRows);

  drawSectionTitle(layout, useDaily ? "Sales by day" : "Sales by hour");
  drawVBarChart(layout, trendRows);

  drawSectionTitle(layout, "Ticket mix");
  drawDonut(layout, [
    { label: "Paid", value: s.paidCount, color: TEAL },
    { label: "Void", value: s.voidCount, color: [190, 68, 68] },
    { label: "Open", value: s.openCount, color: [14, 165, 233] },
    { label: "Held", value: s.heldCount, color: [245, 158, 11] },
  ]);

  drawSectionTitle(layout, "Top items", String(s.topItems.length));
  drawTable(
    layout,
    [
      { label: "Item", width: 90 },
      { label: "Qty", width: 28, align: "right" },
      { label: "Sales", width: 60, align: "right" },
    ],
    s.topItems.map((item) => [item.name, String(item.qty), peso(item.amount)]),
  );

  const txRows = [...s.paid, ...s.voided]
    .sort(
      (a, b) =>
        new Date(b.closedAt ?? b.openedAt).getTime() -
        new Date(a.closedAt ?? a.openedAt).getTime(),
    )
    .slice(0, 40)
    .map((o) => [
      o.orderNumber,
      formatPhTime(o.closedAt ?? o.openedAt),
      o.status.replace("_", " "),
      o.tableName || o.roomNumber || o.customerName || "—",
      methodLabel(o.payments[0]?.method ?? "—"),
      peso(o.totalAmount),
    ]);

  drawSectionTitle(layout, "Transactions", `${Math.min(s.paid.length + s.voided.length, 40)}`);
  drawTable(
    layout,
    [
      { label: "Ticket", width: 32 },
      { label: "Time", width: 28 },
      { label: "Status", width: 24 },
      { label: "Guest / table", width: 42 },
      { label: "Pay", width: 26 },
      { label: "Total", width: 26, align: "right" },
    ],
    txRows,
  );

  addFooters(doc, hotelName, rangeLabel);
  const slug =
    opts.from === opts.to
      ? `pos-sales-${opts.from}.pdf`
      : `pos-sales-${opts.from}-to-${opts.to}.pdf`;
  doc.save(slug);
}
