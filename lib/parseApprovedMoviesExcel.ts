import * as XLSX from "xlsx";

export interface ParsedMovie {
  title: string;
  duration: string;
  producer: string;
  director: string;
  majorCast: string;
  rating: string;
  previewLocation: string;
  language: string;
  consumerAdvice: string;
  dateOfApproval: string;
  productionCompany: string;
}

type Cell = string | number | undefined;

const HEADER_MAP: Record<string, keyof ParsedMovie> = {
  "TITLE OF FILM": "title",
  DURATION: "duration",
  PRODUCER: "producer",
  DIRECTOR: "director",
  "MAJOR CAST": "majorCast",
  RATING: "rating",
  RATINGS: "rating",
  "PREVIEW LOCATION": "previewLocation",
  LANGUAGE: "language",
  "CONSUMER ADVISE": "consumerAdvice",
  "CONSUMER ADVICE": "consumerAdvice",
  "DATE OF APPROVAL": "dateOfApproval",
  "PRODUCTION COMPANY": "productionCompany",
};

function cellText(cell: Cell): string {
  return String(cell ?? "").trim();
}

function isHeaderRow(row: Cell[]): boolean {
  const first = cellText(row[0]).toUpperCase();
  return first === "S/NO" || first === "S/N" || first === "SNO";
}

function extractSectionRating(row: Cell[]): string | null {
  const text = row.map(cellText).join(" ").toUpperCase();
  const match = text.match(/RATED\s*"?([A-Z0-9]+)"?/);
  return match ? match[1] : null;
}

function excelSerialToISODate(serial: number): string {
  const utcMs = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(utcMs).toISOString().slice(0, 10);
}

function normalizeDate(raw: Cell): string {
  if (raw === undefined || raw === "") return "";
  if (typeof raw === "number") return excelSerialToISODate(raw);

  const text = String(raw).trim();
  // DD/MM/YYYY or D/M/YY
  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dmy) {
    const [, d, m, yRaw] = dmy;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const dd = d.padStart(2, "0");
    const mm = m.padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  return text;
}

function normalizeDuration(raw: Cell): string {
  if (raw === undefined || raw === "") return "";
  if (typeof raw === "number") return `${raw} mins`;
  const text = String(raw).trim();
  return /mins?$/i.test(text) ? text.replace(/(\d)(mins?)/i, "$1 $2") : text;
}

export interface ParseResult {
  movies: ParsedMovie[];
  warnings: string[];
}

export function parseApprovedMoviesWorkbook(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const movies: ParsedMovie[] = [];
  const warnings: string[] = [];

  const sheetName = workbook.SheetNames[0];
  {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: "" });

    let columnMap: Partial<Record<keyof ParsedMovie, number>> | null = null;
    let sectionRating: string | null = null;

    for (const row of rows) {
      if (!row || row.every((c) => cellText(c) === "")) continue;

      const sectionMatch = extractSectionRating(row);
      if (sectionMatch) {
        sectionRating = sectionMatch;
        continue;
      }

      if (isHeaderRow(row)) {
        const map: Partial<Record<keyof ParsedMovie, number>> = {};
        row.forEach((cell, idx) => {
          const key = cellText(cell).toUpperCase();
          const field = HEADER_MAP[key];
          if (field) map[field] = idx;
        });
        columnMap = map;
        continue;
      }

      const sno = row[0];
      const isDataRow = columnMap && typeof sno === "number" && cellText(row[columnMap.title ?? 1]) !== "";
      if (!isDataRow || !columnMap) continue;

      const get = (field: keyof ParsedMovie): Cell => {
        const idx = columnMap![field];
        return idx === undefined ? undefined : row[idx];
      };

      const movie: ParsedMovie = {
        title: cellText(get("title")),
        duration: normalizeDuration(get("duration")),
        producer: cellText(get("producer")),
        director: cellText(get("director")),
        majorCast: cellText(get("majorCast")),
        rating: cellText(get("rating")) || sectionRating || "",
        previewLocation: cellText(get("previewLocation")),
        language: cellText(get("language")),
        consumerAdvice: cellText(get("consumerAdvice")),
        dateOfApproval: normalizeDate(get("dateOfApproval")),
        productionCompany: cellText(get("productionCompany")),
      };

      if (!movie.title) continue;
      movies.push(movie);
    }
  }

  if (movies.length === 0) {
    warnings.push("No movie rows were detected in this workbook. Check the sheet formatting.");
  }

  return { movies, warnings };
}
