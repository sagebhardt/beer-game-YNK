import { createXlsxBuffer } from "@/lib/simple-xlsx";

export type Row = Record<string, string | number | boolean | null | undefined>;

function toCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function escapeCsv(cell: string) {
  if (cell.includes('"') || cell.includes(",") || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function rowsToCsv(rows: Row[]) {
  if (rows.length === 0) return "";

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(
      headers
        .map((header) => escapeCsv(toCell(row[header])))
        .join(",")
    );
  }

  return lines.join("\n");
}

export function csvBuffer(rows: Row[]) {
  const csv = rowsToCsv(rows);
  // UTF-8 BOM for Excel compatibility
  return Buffer.from(`\uFEFF${csv}`, "utf8");
}

export function multiSheetXlsxBuffer(sheets: Array<{ name: string; rows: Row[] }>) {
  return createXlsxBuffer(
    sheets.map((sheet) => {
      const headers = sheet.rows.length === 0 ? [] : Object.keys(sheet.rows[0]);
      const matrix: Array<Array<string | number | boolean | null | undefined>> = [
        headers,
        ...sheet.rows.map((row) => headers.map((header) => row[header])),
      ];
      return {
        name: sheet.name,
        rows: matrix,
      };
    })
  );
}
