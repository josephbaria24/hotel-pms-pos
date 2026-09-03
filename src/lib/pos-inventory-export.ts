import { jsPDF } from "jspdf";
import type { PosCategory, PosProduct, PosStockMovement } from "@/lib/api-client/pos-types";
import { formatPhDateTime, todayYmdPh } from "@/lib/datetime";
import {
  INVENTORY_STATUS_LABEL,
  formatStockQty,
  inventoryStatus,
  inventoryValue,
  movementTypeLabel,
  productReorderPoint,
  summarizeInventory,
} from "@/lib/pos-inventory";

export type InventoryExportHotel = {
  hotelName: string;
  address?: string;
  contactNumber?: string;
};

type Rgb = [number, number, number];

const PAGE_W = 210;
const PAGE_H = 297;
const MX = 14;
const MY_BOTTOM = 16;
const CONTENT_W = PAGE_W - MX * 2;
const INK: Rgb = [15, 23, 41];
const MUTED: Rgb = [100, 116, 139];
const LINE: Rgb = [204, 228, 222];
const TEAL_DARK: Rgb = [17, 44, 41];
const TEAL: Rgb = [13, 148, 136];
const TEAL_SOFT: Rgb = [153, 246, 228];
const TEAL_WASH: Rgb = [240, 253, 250];
const ROW_ALT: Rgb = [247, 254, 252];
const WHITE: Rgb = [255, 255, 255];

function peso(amount: number) {
  return `PHP ${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fitText(doc: jsPDF, text: string, maxWidth: number): string {
  const value = text || "—";
  if (doc.getTextWidth(value) <= maxWidth) return value;
  let cut = value;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function inventoryExportFilename(ext: "xlsx" | "pdf") {
  return `Inventory_${todayYmdPh()}.${ext}`;
}

export async function downloadInventoryExcel(input: {
  products: PosProduct[];
  movements: PosStockMovement[];
  categories?: PosCategory[];
  hotel?: InventoryExportHotel;
  filename?: string;
}) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PalawanSU Hotel POS";
  workbook.lastModifiedBy = "PalawanSU Hotel POS";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = input.hotel?.hotelName?.trim() || "PalawanSU Hotel";

  const hotelName = workbook.company;
  const generated = formatPhDateTime(new Date().toISOString());
  const products = [...input.products].sort(
    (a, b) =>
      (a.categoryName || "").localeCompare(b.categoryName || "") ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name),
  );
  const categories = [...(input.categories ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  const movements = [...input.movements].sort((a, b) =>
    String(b.createdAt).localeCompare(String(a.createdAt)),
  );
  const stats = summarizeInventory(products);

  const fill = (argb: string) =>
    ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
  const edge = (argb = "FF99F6E4") => ({ style: "thin" as const, color: { argb } });
  const box = (argb = "FF99F6E4") => ({
    top: edge(argb),
    left: edge(argb),
    bottom: edge(argb),
    right: edge(argb),
  });

  const C = {
    tealDark: "FF0F2C29",
    teal: "FF0D9488",
    tealDeep: "FF115E59",
    tealMid: "FF0F766E",
    white: "FFFFFFFF",
    ink: "FF0F172A",
    muted: "FF64748B",
    wash: "FFF0FDFA",
    alt: "FFFAFFFE",
    line: "FFCCECE6",
    amberBg: "FFFEF3C7",
    amberFg: "FF92400E",
    roseBg: "FFFEE2E2",
    roseFg: "FF9F1239",
    greenBg: "FFD1FAE5",
    greenFg: "FF047857",
    slateBg: "FFF1F5F9",
    slateFg: "FF475569",
    skyBg: "FFE0F2FE",
    skyFg: "FF075985",
    gold: "FFF59E0B",
  };

  const statusFill = (status: string) => {
    if (status === "Out of stock") return { bg: C.roseBg, fg: C.roseFg };
    if (status === "Low stock") return { bg: C.amberBg, fg: C.amberFg };
    if (status === "In stock") return { bg: C.greenBg, fg: C.greenFg };
    return { bg: C.slateBg, fg: C.slateFg };
  };

  const moveFill = (type: string) => {
    const key = type.toLowerCase();
    if (key.includes("receive")) return { bg: C.greenBg, fg: C.greenFg };
    if (key.includes("waste")) return { bg: C.roseBg, fg: C.roseFg };
    if (key.includes("sale") && !key.includes("void")) return { bg: C.skyBg, fg: C.skyFg };
    if (key.includes("count")) return { bg: "FFEDE9FE", fg: "FF5B21B6" };
    if (key.includes("void")) return { bg: "FFE0E7FF", fg: "FF3730A3" };
    return { bg: C.amberBg, fg: C.amberFg };
  };

  function paintBanner(
    sheet: import("exceljs").Worksheet,
    lastCol: number,
    subtitle: string,
  ) {
    sheet.mergeCells(1, 1, 1, lastCol);
    sheet.mergeCells(2, 1, 2, lastCol);
    sheet.mergeCells(3, 1, 3, lastCol);
    const title = sheet.getCell(1, 1);
    title.value = hotelName;
    title.font = { name: "Calibri", size: 20, bold: true, color: { argb: C.white } };
    title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    title.fill = fill(C.tealDark);
    sheet.getRow(1).height = 28;

    const sub = sheet.getCell(2, 1);
    sub.value = subtitle;
    sub.font = { name: "Calibri", size: 13, bold: true, color: { argb: C.gold } };
    sub.alignment = { vertical: "middle", indent: 1 };
    sub.fill = fill(C.tealDark);
    sheet.getRow(2).height = 20;

    const meta = sheet.getCell(3, 1);
    const parts = [
      input.hotel?.address?.trim(),
      input.hotel?.contactNumber?.trim(),
      `Generated ${generated}`,
    ].filter(Boolean);
    meta.value = parts.join("  ·  ");
    meta.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FFCCFBF1" } };
    meta.alignment = { vertical: "middle", indent: 1 };
    meta.fill = fill(C.tealDeep);
    sheet.getRow(3).height = 18;

    for (let c = 1; c <= lastCol; c++) {
      sheet.getCell(1, c).fill = fill(C.tealDark);
      sheet.getCell(2, c).fill = fill(C.tealDark);
      sheet.getCell(3, c).fill = fill(C.tealDeep);
    }
  }

  function styleHeader(row: import("exceljs").Row, count: number) {
    row.height = 22;
    row.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.white } };
    row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    for (let c = 1; c <= count; c++) {
      const cell = row.getCell(c);
      cell.fill = fill(C.teal);
      cell.border = box(C.tealDeep);
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.white } };
    }
  }

  function styleDataRow(
    row: import("exceljs").Row,
    count: number,
    index: number,
    opts?: { statusCol?: number; typeCol?: number; qtyCol?: number },
  ) {
    row.height = 18;
    row.alignment = { vertical: "middle" };
    row.font = { name: "Calibri", size: 10, color: { argb: C.ink } };
    const bg = index % 2 === 0 ? C.wash : C.alt;
    for (let c = 1; c <= count; c++) {
      const cell = row.getCell(c);
      cell.fill = fill(bg);
      cell.border = box(C.line);
      cell.font = { name: "Calibri", size: 10, color: { argb: C.ink } };
    }
    if (opts?.statusCol) {
      const cell = row.getCell(opts.statusCol);
      const tone = statusFill(String(cell.value ?? ""));
      cell.fill = fill(tone.bg);
      cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: tone.fg } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    }
    if (opts?.typeCol) {
      const cell = row.getCell(opts.typeCol);
      const tone = moveFill(String(cell.value ?? ""));
      cell.fill = fill(tone.bg);
      cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: tone.fg } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    }
    if (opts?.qtyCol) {
      const cell = row.getCell(opts.qtyCol);
      const n = Number(cell.value ?? 0);
      if (n < 0) cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.roseFg } };
      if (n > 0) cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.greenFg } };
    }
  }

  function emptyRow(sheet: import("exceljs").Worksheet, rowNo: number, count: number, message: string) {
    sheet.mergeCells(rowNo, 1, rowNo, count);
    const cell = sheet.getCell(rowNo, 1);
    cell.value = message;
    cell.font = { name: "Calibri", size: 10, italic: true, color: { argb: C.muted } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = fill(C.slateBg);
    sheet.getRow(rowNo).height = 22;
  }

  function setupSheet(sheet: import("exceljs").Worksheet, lastCol: number) {
    sheet.views = [{ state: "frozen", ySplit: 5, showGridLines: false }];
    sheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
    sheet.headerFooter = {
      oddHeader: `&L&B${hotelName}&RPOS Inventory`,
      oddFooter: `&L${todayYmdPh()}&C&P / &N&RConfidential`,
    };
    sheet.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5, column: lastCol },
    };
    sheet.properties.tabColor = { argb: C.teal };
  }

  const itemsByCategory = new Map<string, PosProduct[]>();
  for (const p of products) {
    const key = p.categoryId || "__none__";
    const list = itemsByCategory.get(key) ?? [];
    list.push(p);
    itemsByCategory.set(key, list);
  }

  // ── Summary ──────────────────────────────────────────────
  const summary = workbook.addWorksheet("Summary", { properties: { tabColor: { argb: C.tealDark } } });
  summary.columns = Array.from({ length: 8 }, () => ({ width: 16 }));
  paintBanner(summary, 8, "POS Inventory Complete Report");
  summary.mergeCells("A4:H4");
  summary.getCell("A4").value = "At a glance";
  summary.getCell("A4").font = { name: "Calibri", size: 12, bold: true, color: { argb: C.tealDeep } };
  summary.getCell("A4").alignment = { vertical: "middle", indent: 1 };
  summary.getRow(4).height = 20;

  const kpis: { label: string; value: string | number; bg: string; range: string }[] = [
    { label: "TOTAL ITEMS", value: stats.total, bg: C.teal, range: "A5:B6" },
    { label: "TRACKED SKUs", value: stats.tracked, bg: C.tealMid, range: "C5:D6" },
    { label: "IN STOCK", value: stats.inStock, bg: "FF047857", range: "E5:F6" },
    { label: "LOW STOCK", value: stats.low, bg: "FFD97706", range: "G5:H6" },
    { label: "OUT OF STOCK", value: stats.out, bg: "FFBE123C", range: "A7:B8" },
    { label: "UNTRACKED", value: stats.untracked, bg: "FF475569", range: "C7:D8" },
    { label: "CATEGORIES", value: categories.length, bg: C.tealDeep, range: "E7:F8" },
    { label: "STOCK VALUE", value: stats.value, bg: C.tealDark, range: "G7:H8" },
  ];
  for (const kpi of kpis) {
    summary.mergeCells(kpi.range);
    const cell = summary.getCell(kpi.range.split(":")[0]!);
    cell.value = { richText: [
      { text: `${kpi.label}\n`, font: { name: "Calibri", size: 8, bold: true, color: { argb: "FFCCFBF1" } } },
      {
        text: kpi.label === "STOCK VALUE"
          ? `₱${Number(kpi.value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : String(kpi.value),
        font: { name: "Calibri", size: 16, bold: true, color: { argb: C.white } },
      },
    ] };
    cell.fill = fill(kpi.bg);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = box("FF134E4A");
  }
  summary.getRow(5).height = 22;
  summary.getRow(6).height = 22;
  summary.getRow(7).height = 22;
  summary.getRow(8).height = 22;

  summary.mergeCells("A10:H10");
  summary.getCell("A10").value = "Inventory snapshot";
  summary.getCell("A10").font = { name: "Calibri", size: 12, bold: true, color: { argb: C.tealDeep } };
  summary.getCell("A10").alignment = { vertical: "middle", indent: 1 };

  const snapHeaders = ["Metric", "Value", "Notes", "", "", "", "", ""];
  const snapRow = summary.getRow(11);
  snapHeaders.forEach((h, i) => {
    snapRow.getCell(i + 1).value = h || null;
  });
  styleHeader(snapRow, 3);
  summary.mergeCells("C11:H11");
  const snapshot = [
    ["Total catalog items", stats.total, "All sellable products in this export"],
    ["Tracked for stock", stats.tracked, "Items with quantity tracking on"],
    ["In-stock items", stats.inStock, "On hand above reorder point"],
    ["Low-stock items", stats.low, "On hand at or below reorder point"],
    ["Out-of-stock items", stats.out, "Tracked items with zero quantity"],
    ["Not tracking stock", stats.untracked, "Services or items without qty control"],
    ["Total on-hand units", stats.onHandQty, "Sum of tracked quantities"],
    ["Inventory value (cost)", stats.value, "On-hand qty × unit cost"],
    ["Categories", categories.length, "Active and hidden categories"],
    ["Stock movements", movements.length, "Receive, sale, adjust, count, waste"],
  ];
  snapshot.forEach((row, i) => {
    const r = summary.getRow(12 + i);
    r.getCell(1).value = row[0];
    r.getCell(2).value = row[1];
    r.getCell(3).value = row[2];
    summary.mergeCells(12 + i, 3, 12 + i, 8);
    styleDataRow(r, 8, i);
    r.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: C.ink } };
    if (i === 7) r.getCell(2).numFmt = '"₱"#,##0.00';
    if (i === 3) {
      r.getCell(1).fill = fill(C.amberBg);
      r.getCell(2).fill = fill(C.amberBg);
    }
    if (i === 4) {
      r.getCell(1).fill = fill(C.roseBg);
      r.getCell(2).fill = fill(C.roseBg);
    }
  });
  summary.views = [{ showGridLines: false }];
  summary.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };

  // ── Categories ───────────────────────────────────────────
  const catSheet = workbook.addWorksheet("Categories");
  const catCols = [
    { header: "Category", key: "name", width: 24 },
    { header: "Description", key: "description", width: 36 },
    { header: "Sort", key: "sort", width: 10 },
    { header: "Active", key: "active", width: 12 },
    { header: "Items", key: "items", width: 10 },
    { header: "Tracked", key: "tracked", width: 12 },
    { header: "On Hand Qty", key: "qty", width: 14 },
    { header: "Stock Value", key: "value", width: 16 },
    { header: "In Stock", key: "inStock", width: 12 },
    { header: "Low", key: "low", width: 10 },
    { header: "Out", key: "out", width: 10 },
  ];
  catSheet.columns = catCols;
  paintBanner(catSheet, catCols.length, "Categories & Stock by Group");
  catSheet.getRow(4).height = 8;
  const catHeader = catSheet.getRow(5);
  catCols.forEach((col, i) => {
    catHeader.getCell(i + 1).value = col.header;
  });
  styleHeader(catHeader, catCols.length);
  setupSheet(catSheet, catCols.length);

  const categoryRows: PosCategory[] = [...categories];
  if ((itemsByCategory.get("__none__")?.length ?? 0) > 0) {
    categoryRows.push({
      id: "__none__",
      name: "Uncategorized",
      description: "Items with no category",
      sortOrder: 999,
      isActive: true,
      color: null,
    });
  }

  if (categoryRows.length === 0) {
    emptyRow(catSheet, 6, catCols.length, "No categories in the catalog.");
  } else {
    categoryRows.forEach((cat, i) => {
      const items = itemsByCategory.get(cat.id === "__none__" ? "__none__" : cat.id) ?? [];
      const sum = summarizeInventory(items);
      const row = catSheet.addRow({
        name: cat.name,
        description: cat.description || "—",
        sort: cat.sortOrder,
        active: cat.isActive ? "Active" : "Hidden",
        items: items.length,
        tracked: sum.tracked,
        qty: sum.onHandQty,
        value: sum.value,
        inStock: sum.inStock,
        low: sum.low,
        out: sum.out,
      });
      styleDataRow(row, catCols.length, i);
      row.getCell("qty").numFmt = "#,##0.###";
      row.getCell("value").numFmt = '"₱"#,##0.00';
      row.getCell("active").alignment = { horizontal: "center", vertical: "middle" };
      row.getCell("active").fill = fill(cat.isActive ? C.greenBg : C.slateBg);
      row.getCell("active").font = {
        name: "Calibri",
        size: 9,
        bold: true,
        color: { argb: cat.isActive ? C.greenFg : C.slateFg },
      };
      if (sum.low > 0) {
        row.getCell("low").fill = fill(C.amberBg);
        row.getCell("low").font = { name: "Calibri", size: 10, bold: true, color: { argb: C.amberFg } };
      }
      if (sum.out > 0) {
        row.getCell("out").fill = fill(C.roseBg);
        row.getCell("out").font = { name: "Calibri", size: 10, bold: true, color: { argb: C.roseFg } };
      }
    });
  }

  // ── Items (full catalog) ─────────────────────────────────
  const itemSheet = workbook.addWorksheet("Items");
  const itemCols = [
    { header: "Item", key: "name", width: 28 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Category", key: "category", width: 18 },
    { header: "Description", key: "description", width: 32 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Selling Price", key: "price", width: 14 },
    { header: "Unit Cost", key: "cost", width: 12 },
    { header: "Margin", key: "margin", width: 12 },
    { header: "On Hand", key: "onHand", width: 12 },
    { header: "Reorder Point", key: "reorder", width: 14 },
    { header: "Stock Value", key: "value", width: 14 },
    { header: "Status", key: "status", width: 14 },
    { header: "Track Stock", key: "tracked", width: 13 },
    { header: "Quick Sell", key: "quick", width: 12 },
    { header: "Active", key: "active", width: 10 },
    { header: "Sort", key: "sort", width: 8 },
  ];
  itemSheet.columns = itemCols;
  paintBanner(itemSheet, itemCols.length, "Complete Item Catalog");
  itemSheet.getRow(4).height = 8;
  const itemHeader = itemSheet.getRow(5);
  itemCols.forEach((col, i) => {
    itemHeader.getCell(i + 1).value = col.header;
  });
  styleHeader(itemHeader, itemCols.length);
  setupSheet(itemSheet, itemCols.length);

  if (products.length === 0) {
    emptyRow(itemSheet, 6, itemCols.length, "No items in the catalog.");
  } else {
    products.forEach((p, i) => {
      const status = INVENTORY_STATUS_LABEL[inventoryStatus(p)];
      const margin = p.price > 0 ? (p.price - p.cost) / p.price : 0;
      const row = itemSheet.addRow({
        name: p.name,
        sku: p.sku || "—",
        category: p.categoryName || "Uncategorized",
        description: p.description || "—",
        unit: p.unit || "each",
        price: p.price,
        cost: p.cost,
        margin,
        onHand: p.trackStock ? p.stockQty : null,
        reorder: p.trackStock ? productReorderPoint(p) : null,
        value: p.trackStock ? inventoryValue(p) : null,
        status,
        tracked: p.trackStock ? "Yes" : "No",
        quick: p.isQuickSell ? "Yes" : "No",
        active: p.isActive ? "Active" : "Hidden",
        sort: p.sortOrder,
      });
      styleDataRow(row, itemCols.length, i, { statusCol: 12 });
      row.getCell("price").numFmt = '"₱"#,##0.00';
      row.getCell("cost").numFmt = '"₱"#,##0.00';
      row.getCell("margin").numFmt = "0.0%";
      row.getCell("onHand").numFmt = "#,##0.###";
      row.getCell("reorder").numFmt = "#,##0.###";
      row.getCell("value").numFmt = '"₱"#,##0.00';
      row.getCell("name").font = { name: "Calibri", size: 10, bold: true, color: { argb: C.ink } };
      row.getCell("sku").font = { name: "Calibri", size: 9, color: { argb: C.muted } };
      if (!p.isActive) {
        row.getCell("active").fill = fill(C.slateBg);
        row.getCell("active").font = { name: "Calibri", size: 9, bold: true, color: { argb: C.slateFg } };
      } else {
        row.getCell("active").fill = fill(C.greenBg);
        row.getCell("active").font = { name: "Calibri", size: 9, bold: true, color: { argb: C.greenFg } };
      }
    });
  }

  // ── On Hand ──────────────────────────────────────────────
  const stockSheet = workbook.addWorksheet("On Hand");
  const stockCols = [
    { header: "Item", key: "name", width: 28 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Category", key: "category", width: 18 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "On Hand", key: "onHand", width: 12 },
    { header: "Reorder Point", key: "reorder", width: 14 },
    { header: "Variance to Reorder", key: "variance", width: 18 },
    { header: "Unit Cost", key: "cost", width: 12 },
    { header: "Stock Value", key: "value", width: 14 },
    { header: "Selling Price", key: "price", width: 14 },
    { header: "Retail Value", key: "retail", width: 14 },
    { header: "Status", key: "status", width: 14 },
  ];
  stockSheet.columns = stockCols;
  paintBanner(stockSheet, stockCols.length, "On-Hand Stock & Valuation");
  stockSheet.getRow(4).height = 8;
  const stockHeader = stockSheet.getRow(5);
  stockCols.forEach((col, i) => {
    stockHeader.getCell(i + 1).value = col.header;
  });
  styleHeader(stockHeader, stockCols.length);
  setupSheet(stockSheet, stockCols.length);

  const tracked = products.filter((p) => p.trackStock);
  if (tracked.length === 0) {
    emptyRow(stockSheet, 6, stockCols.length, "No items are tracking stock.");
  } else {
    tracked.forEach((p, i) => {
      const reorder = productReorderPoint(p);
      const status = INVENTORY_STATUS_LABEL[inventoryStatus(p)];
      const row = stockSheet.addRow({
        name: p.name,
        sku: p.sku || "—",
        category: p.categoryName || "Uncategorized",
        unit: p.unit || "each",
        onHand: p.stockQty,
        reorder,
        variance: p.stockQty - reorder,
        cost: p.cost,
        value: inventoryValue(p),
        price: p.price,
        retail: p.stockQty * p.price,
        status,
      });
      styleDataRow(row, stockCols.length, i, { statusCol: 12 });
      row.getCell("onHand").numFmt = "#,##0.###";
      row.getCell("reorder").numFmt = "#,##0.###";
      row.getCell("variance").numFmt = "#,##0.###";
      row.getCell("cost").numFmt = '"₱"#,##0.00';
      row.getCell("value").numFmt = '"₱"#,##0.00';
      row.getCell("price").numFmt = '"₱"#,##0.00';
      row.getCell("retail").numFmt = '"₱"#,##0.00';
      row.getCell("name").font = { name: "Calibri", size: 10, bold: true, color: { argb: C.ink } };
    });
  }

  // ── Alerts ───────────────────────────────────────────────
  const alertSheet = workbook.addWorksheet("Low & Out");
  const alertCols = [
    { header: "Priority", key: "priority", width: 14 },
    { header: "Item", key: "name", width: 28 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Category", key: "category", width: 18 },
    { header: "On Hand", key: "onHand", width: 12 },
    { header: "Reorder Point", key: "reorder", width: 14 },
    { header: "Need to Reorder", key: "need", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Unit Cost", key: "cost", width: 12 },
    { header: "Restock Cost", key: "restock", width: 14 },
  ];
  alertSheet.columns = alertCols;
  paintBanner(alertSheet, alertCols.length, "Reorder Alerts — Low & Out of Stock");
  alertSheet.getRow(4).height = 8;
  const alertHeader = alertSheet.getRow(5);
  alertCols.forEach((col, i) => {
    alertHeader.getCell(i + 1).value = col.header;
  });
  styleHeader(alertHeader, alertCols.length);
  setupSheet(alertSheet, alertCols.length);

  const alerts = products
    .filter((p) => {
      const s = inventoryStatus(p);
      return s === "low" || s === "out";
    })
    .sort((a, b) => Number(a.stockQty) - Number(b.stockQty));
  if (alerts.length === 0) {
    emptyRow(alertSheet, 6, alertCols.length, "No low-stock or out-of-stock items.");
  } else {
    alerts.forEach((p, i) => {
      const reorder = productReorderPoint(p);
      const status = INVENTORY_STATUS_LABEL[inventoryStatus(p)];
      const need = Math.max(0, reorder - p.stockQty);
      const row = alertSheet.addRow({
        priority: status === "Out of stock" ? "Urgent" : "Watch",
        name: p.name,
        sku: p.sku || "—",
        category: p.categoryName || "Uncategorized",
        onHand: p.stockQty,
        reorder,
        need,
        status,
        cost: p.cost,
        restock: need * p.cost,
      });
      styleDataRow(row, alertCols.length, i, { statusCol: 8 });
      row.getCell("onHand").numFmt = "#,##0.###";
      row.getCell("reorder").numFmt = "#,##0.###";
      row.getCell("need").numFmt = "#,##0.###";
      row.getCell("cost").numFmt = '"₱"#,##0.00';
      row.getCell("restock").numFmt = '"₱"#,##0.00';
      const urgent = status === "Out of stock";
      row.getCell("priority").fill = fill(urgent ? C.roseBg : C.amberBg);
      row.getCell("priority").font = {
        name: "Calibri",
        size: 9,
        bold: true,
        color: { argb: urgent ? C.roseFg : C.amberFg },
      };
      row.getCell("priority").alignment = { horizontal: "center", vertical: "middle" };
    });
  }

  // ── Movements ────────────────────────────────────────────
  const moveSheet = workbook.addWorksheet("Movements");
  const moveCols = [
    { header: "When", key: "when", width: 22 },
    { header: "Item", key: "name", width: 26 },
    { header: "SKU", key: "sku", width: 14 },
    { header: "Type", key: "type", width: 14 },
    { header: "Qty Change", key: "qty", width: 12 },
    { header: "Qty Before", key: "before", width: 12 },
    { header: "Qty After", key: "after", width: 12 },
    { header: "Reason", key: "reason", width: 16 },
    { header: "Reference", key: "reference", width: 18 },
    { header: "Note", key: "note", width: 32 },
  ];
  moveSheet.columns = moveCols;
  paintBanner(moveSheet, moveCols.length, "Stock Movement Ledger");
  moveSheet.getRow(4).height = 8;
  const moveHeader = moveSheet.getRow(5);
  moveCols.forEach((col, i) => {
    moveHeader.getCell(i + 1).value = col.header;
  });
  styleHeader(moveHeader, moveCols.length);
  setupSheet(moveSheet, moveCols.length);

  if (movements.length === 0) {
    emptyRow(moveSheet, 6, moveCols.length, "No stock movements recorded yet.");
  } else {
    movements.forEach((m, i) => {
      const row = moveSheet.addRow({
        when: m.createdAt ? formatPhDateTime(m.createdAt) : "—",
        name: m.productName || "—",
        sku: m.sku || "—",
        type: movementTypeLabel(m.type),
        qty: m.quantity,
        before: m.qtyBefore,
        after: m.qtyAfter,
        reason: m.reason || "—",
        reference: m.referenceNo || "—",
        note: m.note || "—",
      });
      styleDataRow(row, moveCols.length, i, { typeCol: 4, qtyCol: 5 });
      row.getCell("qty").numFmt = "#,##0.###";
      row.getCell("before").numFmt = "#,##0.###";
      row.getCell("after").numFmt = "#,##0.###";
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    input.filename ?? inventoryExportFilename("xlsx"),
  );
}

export async function downloadInventoryPdf(input: {
  products: PosProduct[];
  movements: PosStockMovement[];
  hotel?: InventoryExportHotel;
  filename?: string;
}) {
  const hotelName = input.hotel?.hotelName?.trim() || "PalawanSU Hotel";
  const stats = summarizeInventory(input.products);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 16;

  const ensure = (h: number) => {
    if (y + h <= PAGE_H - MY_BOTTOM) return;
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...TEAL_DARK);
    doc.text(hotelName, MX, 10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text("POS Inventory", PAGE_W - MX, 10, { align: "right" });
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.45);
    doc.line(MX, 12.5, PAGE_W - MX, 12.5);
    y = 18;
  };

  doc.setFillColor(...TEAL_DARK);
  doc.roundedRect(MX, y, CONTENT_W, 32, 3, 3, "F");
  doc.setFillColor(...TEAL);
  doc.rect(MX, y, 3.2, 32, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(hotelName, MX + 10, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEAL_SOFT);
  const meta = [input.hotel?.address?.trim(), input.hotel?.contactNumber?.trim()].filter(Boolean).join("  ·  ");
  doc.text(fitText(doc, meta || "Point of sale inventory", CONTENT_W - 18), MX + 10, y + 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text("Inventory Report", MX + 10, y + 27);
  y += 40;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Generated ${formatPhDateTime(new Date().toISOString())}`, MX, y);
  y += 8;

  const kpis = [
    { label: "Tracked", value: String(stats.tracked) },
    { label: "In stock", value: String(stats.inStock) },
    { label: "Low", value: String(stats.low) },
    { label: "Out", value: String(stats.out) },
    { label: "Value", value: peso(stats.value) },
  ];
  const gap = 3;
  const kw = (CONTENT_W - gap * (kpis.length - 1)) / kpis.length;
  kpis.forEach((kpi, i) => {
    const x = MX + i * (kw + gap);
    doc.setFillColor(...TEAL_WASH);
    doc.setDrawColor(153, 237, 218);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, kw, 16, 2, 2, "FD");
    doc.setFillColor(...TEAL);
    doc.rect(x, y, kw, 1.3, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(kpi.label.toUpperCase(), x + 3, y + 6.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(kpi.value.length > 12 ? 8 : 10);
    doc.setTextColor(...INK);
    doc.text(fitText(doc, kpi.value, kw - 6), x + 3, y + 13);
  });
  y += 22;

  const drawTable = (title: string, columns: { label: string; width: number; align?: "left" | "right" }[], rows: string[][]) => {
    ensure(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(title, MX, y);
    y += 3;
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.5);
    doc.line(MX, y, PAGE_W - MX, y);
    y += 4;
    const headerH = 7.2;
    const rowH = 7;
    const paintHeader = () => {
      doc.setFillColor(...TEAL_DARK);
      doc.roundedRect(MX, y, CONTENT_W, headerH, 1.2, 1.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...WHITE);
      let x = MX + 2.5;
      columns.forEach((col) => {
        if (col.align === "right") doc.text(col.label.toUpperCase(), x + col.width - 2, y + 4.8, { align: "right" });
        else doc.text(col.label.toUpperCase(), x, y + 4.8);
        x += col.width;
      });
      y += headerH;
    };
    ensure(headerH + rowH);
    paintHeader();
    if (rows.length === 0) {
      doc.setFillColor(...ROW_ALT);
      doc.rect(MX, y, CONTENT_W, rowH, "F");
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text("No rows to export.", MX + 4, y + 4.7);
      y += rowH + 6;
      return;
    }
    rows.forEach((row, i) => {
      if (y + rowH > PAGE_H - MY_BOTTOM) {
        doc.addPage();
        y = 18;
        paintHeader();
      }
      if (i % 2 === 0) {
        doc.setFillColor(...ROW_ALT);
        doc.rect(MX, y, CONTENT_W, rowH, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.4);
      doc.setTextColor(...INK);
      let x = MX + 2.5;
      row.forEach((cell, colIndex) => {
        const col = columns[colIndex]!;
        const text = fitText(doc, cell, col.width - 4);
        if (col.align === "right") doc.text(text, x + col.width - 2, y + 4.7, { align: "right" });
        else doc.text(text, x, y + 4.7);
        x += col.width;
      });
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.15);
      doc.line(MX, y + rowH, MX + CONTENT_W, y + rowH);
      y += rowH;
    });
    y += 8;
  };

  drawTable(
    "On-hand stock",
    [
      { label: "Item", width: 46 },
      { label: "SKU", width: 24 },
      { label: "Category", width: 28 },
      { label: "On hand", width: 18, align: "right" },
      { label: "Reorder", width: 18, align: "right" },
      { label: "Status", width: 22 },
      { label: "Value", width: 26, align: "right" },
    ],
    input.products.map((p) => [
      p.name,
      p.sku || "—",
      p.categoryName || "—",
      p.trackStock ? formatStockQty(p.stockQty) : "—",
      p.trackStock ? formatStockQty(productReorderPoint(p)) : "—",
      INVENTORY_STATUS_LABEL[inventoryStatus(p)],
      p.trackStock ? peso(inventoryValue(p)) : "—",
    ]),
  );

  drawTable(
    "Stock movements",
    [
      { label: "When", width: 36 },
      { label: "Item", width: 40 },
      { label: "Type", width: 24 },
      { label: "Qty", width: 18, align: "right" },
      { label: "After", width: 18, align: "right" },
      { label: "Details", width: 46 },
    ],
    input.movements.map((m) => [
      m.createdAt ? formatPhDateTime(m.createdAt) : "—",
      m.productName || "—",
      movementTypeLabel(m.type),
      `${m.quantity > 0 ? "+" : ""}${formatStockQty(m.quantity)}`,
      formatStockQty(m.qtyAfter),
      [m.reason, m.referenceNo, m.note].filter(Boolean).join(" · ") || "—",
    ]),
  );

  const blob = doc.output("blob");
  triggerDownload(blob, input.filename ?? inventoryExportFilename("pdf"));
}
