import { formatPhDateTime, todayYmdPh } from "@/lib/datetime";

export type ExcelHotel = {
  hotelName: string;
  address?: string;
  contactNumber?: string;
};

export type ExcelPalette = {
  dark: string;
  deep: string;
  header: string;
  accent: string;
  white: string;
  ink: string;
  muted: string;
  wash: string;
  alt: string;
  line: string;
  greenBg: string;
  greenFg: string;
  amberBg: string;
  amberFg: string;
  roseBg: string;
  roseFg: string;
  slateBg: string;
  slateFg: string;
  skyBg: string;
  skyFg: string;
  bannerMeta: string;
};

/** PMS — navy + orange, matching the property sidebar. */
export const PMS_EXCEL: ExcelPalette = {
  dark: "FF181F2A",
  deep: "FF243147",
  header: "FFFF4400",
  accent: "FFFF4400",
  white: "FFFFFFFF",
  ink: "FF0F172A",
  muted: "FF64748B",
  wash: "FFFFF7F2",
  alt: "FFFAFBFD",
  line: "FFFFCDCC",
  greenBg: "FFD1FAE5",
  greenFg: "FF047857",
  amberBg: "FFFEF3C7",
  amberFg: "FF92400E",
  roseBg: "FFFEE2E2",
  roseFg: "FF9F1239",
  slateBg: "FFF1F5F9",
  slateFg: "FF475569",
  skyBg: "FFE0F2FE",
  skyFg: "FF075985",
  bannerMeta: "FFFFD7C2",
};

/** POS — teal, matching the POS sidebar. */
export const POS_EXCEL: ExcelPalette = {
  dark: "FF0F2C29",
  deep: "FF115E59",
  header: "FF0D9488",
  accent: "FFF59E0B",
  white: "FFFFFFFF",
  ink: "FF0F172A",
  muted: "FF64748B",
  wash: "FFF0FDFA",
  alt: "FFFAFFFE",
  line: "FFCCECE6",
  greenBg: "FFD1FAE5",
  greenFg: "FF047857",
  amberBg: "FFFEF3C7",
  amberFg: "FF92400E",
  roseBg: "FFFEE2E2",
  roseFg: "FF9F1239",
  slateBg: "FFF1F5F9",
  slateFg: "FF475569",
  skyBg: "FFE0F2FE",
  skyFg: "FF075985",
  bannerMeta: "FFCCFBF1",
};

export function excelFill(argb: string) {
  return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } };
}

export function excelBox(argb = "FF99F6E4") {
  const edge = { style: "thin" as const, color: { argb } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

export function paintExcelBanner(
  sheet: import("exceljs").Worksheet,
  lastCol: number,
  palette: ExcelPalette,
  hotelName: string,
  subtitle: string,
  hotel?: ExcelHotel,
) {
  sheet.mergeCells(1, 1, 1, lastCol);
  sheet.mergeCells(2, 1, 2, lastCol);
  sheet.mergeCells(3, 1, 3, lastCol);
  const title = sheet.getCell(1, 1);
  title.value = hotelName;
  title.font = { name: "Calibri", size: 20, bold: true, color: { argb: palette.white } };
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  title.fill = excelFill(palette.dark);
  sheet.getRow(1).height = 28;

  const sub = sheet.getCell(2, 1);
  sub.value = subtitle;
  sub.font = { name: "Calibri", size: 13, bold: true, color: { argb: palette.accent } };
  sub.alignment = { vertical: "middle", indent: 1 };
  sub.fill = excelFill(palette.dark);
  sheet.getRow(2).height = 20;

  const meta = sheet.getCell(3, 1);
  const parts = [
    hotel?.address?.trim(),
    hotel?.contactNumber?.trim(),
    `Generated ${formatPhDateTime(new Date().toISOString())}`,
  ].filter(Boolean);
  meta.value = parts.join("  ·  ");
  meta.font = { name: "Calibri", size: 10, italic: true, color: { argb: palette.bannerMeta } };
  meta.alignment = { vertical: "middle", indent: 1 };
  meta.fill = excelFill(palette.deep);
  sheet.getRow(3).height = 18;

  for (let c = 1; c <= lastCol; c++) {
    sheet.getCell(1, c).fill = excelFill(palette.dark);
    sheet.getCell(2, c).fill = excelFill(palette.dark);
    sheet.getCell(3, c).fill = excelFill(palette.deep);
  }
}

export function styleExcelHeader(
  row: import("exceljs").Row,
  count: number,
  palette: ExcelPalette,
) {
  row.height = 22;
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  for (let c = 1; c <= count; c++) {
    const cell = row.getCell(c);
    cell.fill = excelFill(palette.header);
    cell.border = excelBox(palette.deep);
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: palette.white } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }
}

export function styleExcelDataRow(
  row: import("exceljs").Row,
  count: number,
  index: number,
  palette: ExcelPalette,
) {
  row.height = 18;
  row.alignment = { vertical: "middle" };
  const bg = index % 2 === 0 ? palette.wash : palette.alt;
  for (let c = 1; c <= count; c++) {
    const cell = row.getCell(c);
    cell.fill = excelFill(bg);
    cell.border = excelBox(palette.line);
    cell.font = { name: "Calibri", size: 10, color: { argb: palette.ink } };
  }
}

export function styleExcelChip(
  cell: import("exceljs").Cell,
  bg: string,
  fg: string,
) {
  cell.fill = excelFill(bg);
  cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: fg } };
  cell.alignment = { vertical: "middle", horizontal: "center" };
}

export function excelEmptyRow(
  sheet: import("exceljs").Worksheet,
  rowNo: number,
  count: number,
  message: string,
  palette: ExcelPalette,
) {
  sheet.mergeCells(rowNo, 1, rowNo, count);
  const cell = sheet.getCell(rowNo, 1);
  cell.value = message;
  cell.font = { name: "Calibri", size: 10, italic: true, color: { argb: palette.muted } };
  cell.alignment = { vertical: "middle", horizontal: "center" };
  cell.fill = excelFill(palette.slateBg);
  sheet.getRow(rowNo).height = 22;
}

export function setupExcelSheet(
  sheet: import("exceljs").Worksheet,
  lastCol: number,
  palette: ExcelPalette,
  hotelName: string,
  footerLabel: string,
) {
  sheet.views = [{ state: "frozen", ySplit: 5, showGridLines: false }];
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  sheet.headerFooter = {
    oddHeader: `&L&B${hotelName}&R${footerLabel}`,
    oddFooter: `&L${todayYmdPh()}&C&P / &N&RConfidential`,
  };
  sheet.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: lastCol },
  };
  sheet.properties.tabColor = { argb: palette.header };
}

export function writeExcelHeaders(
  sheet: import("exceljs").Worksheet,
  headers: string[],
  palette: ExcelPalette,
) {
  sheet.getRow(4).height = 8;
  const header = sheet.getRow(5);
  headers.forEach((label, i) => {
    header.getCell(i + 1).value = label;
  });
  styleExcelHeader(header, headers.length, palette);
}

export async function excelWriteDownload(
  workbook: import("exceljs").Workbook,
  filename: string,
) {
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
