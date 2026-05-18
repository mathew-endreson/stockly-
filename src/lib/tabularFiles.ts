import * as XLSX from 'xlsx';
import { parseCsv } from '@/lib/csvImport';

export type TabularFormat = 'csv' | 'excel' | 'json';

const EXCEL_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8;';

const normalizeCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
};

const normalizeRows = (rows: unknown[][]): string[][] =>
  rows.map((row) => row.map((cell) => normalizeCellValue(cell)));

const normalizeObjectRows = (records: Array<Record<string, unknown>>): string[][] => {
  const headers: string[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    for (const key of Object.keys(record || {})) {
      if (seen.has(key)) continue;
      seen.add(key);
      headers.push(key);
    }
  }

  if (headers.length === 0) return [];

  const dataRows = records.map((record) =>
    headers.map((header) => normalizeCellValue(record?.[header]))
  );
  return [headers, ...dataRows];
};

const parseJsonRows = (text: string): string[][] => {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return [];

    if (parsed.every((item) => Array.isArray(item))) {
      const rows = parsed as unknown[][];
      const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
      const headers = Array.from({ length: maxColumns }, (_, index) => `Column ${index + 1}`);
      const values = rows.map((row) =>
        Array.from({ length: maxColumns }, (_, index) => normalizeCellValue(row[index]))
      );
      return [headers, ...values];
    }

    if (parsed.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
      return normalizeObjectRows(parsed as Array<Record<string, unknown>>);
    }

    return [['value'], ...parsed.map((value) => [normalizeCellValue(value)])];
  }

  if (parsed && typeof parsed === 'object') {
    const root = parsed as Record<string, unknown>;
    const preferredArray = ['products', 'orders', 'items', 'data']
      .map((key) => root[key])
      .find((value) => Array.isArray(value));

    if (Array.isArray(preferredArray)) {
      if (preferredArray.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
        return normalizeObjectRows(preferredArray as Array<Record<string, unknown>>);
      }
      if (preferredArray.every((item) => Array.isArray(item))) {
        const rows = preferredArray as unknown[][];
        const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
        const headers = Array.from({ length: maxColumns }, (_, index) => `Column ${index + 1}`);
        const values = rows.map((row) =>
          Array.from({ length: maxColumns }, (_, index) => normalizeCellValue(row[index]))
        );
        return [headers, ...values];
      }
    }

    return normalizeObjectRows([root]);
  }

  return [['value'], [normalizeCellValue(parsed)]];
};

const detectFormatFromFile = (file: File): TabularFormat | null => {
  const fileName = String(file.name || '').toLowerCase();
  if (fileName.endsWith('.csv')) return 'csv';
  if (fileName.endsWith('.json')) return 'json';
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) return 'excel';

  const type = String(file.type || '').toLowerCase();
  if (type.includes('csv')) return 'csv';
  if (type.includes('json')) return 'json';
  if (type.includes('sheet') || type.includes('excel')) return 'excel';
  return null;
};

const escapeCsvValue = (value: unknown) => {
  const text = normalizeCellValue(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const rowsToCsv = (rows: string[][]) => rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(',')).join('\n');

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
};

const rowsToJsonText = (rows: string[][]) => {
  if (rows.length === 0) return '[]';

  const headerRow = rows[0].map((value, index) => {
    const normalized = String(value || '').trim();
    return normalized || `Column ${index + 1}`;
  });

  const objects = rows.slice(1).map((row) => {
    const entry: Record<string, string> = {};
    headerRow.forEach((header, index) => {
      entry[header] = normalizeCellValue(row[index]);
    });
    return entry;
  });

  return JSON.stringify(objects, null, 2);
};

export const parseTabularImportFile = async (file: File): Promise<{ format: TabularFormat; rows: string[][] }> => {
  const format = detectFormatFromFile(file);
  if (!format) {
    throw new Error('Unsupported file type. Use CSV, Excel, or JSON.');
  }

  if (format === 'csv') {
    const text = await file.text();
    return {
      format,
      rows: parseCsv(text)
    };
  }

  if (format === 'json') {
    const text = await file.text();
    return {
      format,
      rows: parseJsonRows(text)
    };
  }

  const fileBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames?.[0];
  if (!firstSheetName) {
    return { format, rows: [] };
  }

  const firstSheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: false,
    defval: ''
  });

  return {
    format,
    rows: normalizeRows(rawRows)
  };
};

export const downloadTabularRows = ({
  rows,
  format,
  fileNameBase
}: {
  rows: string[][];
  format: TabularFormat;
  fileNameBase: string;
}) => {
  if (format === 'json') {
    const text = rowsToJsonText(rows);
    downloadBlob(new Blob([text], { type: 'application/json;charset=utf-8;' }), `${fileNameBase}.json`);
    return;
  }

  if (format === 'excel') {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    downloadBlob(new Blob([data], { type: EXCEL_MIME }), `${fileNameBase}.xlsx`);
    return;
  }

  const csv = rowsToCsv(rows);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${fileNameBase}.csv`);
};
