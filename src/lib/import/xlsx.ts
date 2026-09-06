import * as XLSX from "xlsx";

export function parseXlsx(buffer: ArrayBuffer | Uint8Array): { headers: string[]; rows: string[][] } {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [] };
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });
  if (!matrix.length) {
    return { headers: [], rows: [] };
  }
  const headers = (matrix[0] ?? []).map((cell) => String(cell ?? "").trim());
  const rows = matrix.slice(1).map((row) => {
    const cells = Array.from({ length: headers.length }, (_, index) => String(row[index] ?? "").trim());
    return cells;
  });
  return { headers, rows };
}
