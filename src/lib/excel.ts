/**
 * Excel import (workbook → PropertyInput[]) and template export, built on SheetJS.
 * Nothing here touches the DOM except `downloadTemplate`, which triggers a file save.
 */
import * as XLSX from 'xlsx';
import { COLUMNS, HEADER_TO_FIELD, META_COLUMNS, TEMPLATE_EXAMPLES, normalizeHeader, type ImportField } from './columns';
import { APP_VERSION, TEMPLATE_FILENAME } from './constants';
import type { Assignment, PropertyInput } from './types';

export interface ImportMeta {
  partnerAName?: string;
  partnerBName?: string;
  partnerAPct?: number;
  discountRate?: number;
}

export interface ImportResult {
  properties: PropertyInput[];
  meta: ImportMeta;
}

export class ImportError extends Error {
  override name = 'ImportError';
}

type Row = Record<string, unknown>;

const TEXT_FIELDS = new Set<ImportField>(['name', 'assign', 'zoning', 'cert40yr']);

/** "$1,250,000" / " 6.5 %" → 1250000 / 6.5; blank or unparseable → null. */
function parseNumber(raw: unknown): number | null {
  const cleaned = String(raw ?? '').replace(/[$,%\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

function parseAssign(raw: unknown): Assignment {
  const a = String(raw ?? '').toLowerCase().trim();
  return a === 'a' || a === 'b' ? a : 'none';
}

function rowToProperty(row: Row, fieldMap: ReadonlyMap<string, ImportField>): PropertyInput | null {
  const input: PropertyInput = {};
  for (const [header, field] of fieldMap) {
    const raw = row[header];
    if (field === 'assign') input.assign = parseAssign(raw);
    else if (TEXT_FIELDS.has(field)) (input as Record<string, unknown>)[field] = String(raw ?? '').trim();
    else (input as Record<string, unknown>)[field] = parseNumber(raw);
  }
  if (!input.name && input.marketVal == null) return null; // skip empty rows

  input.assign ??= 'none';
  if (!input.amortPeriod) input.amortPeriod = 30;
  return input;
}

function parseMeta(ws: XLSX.WorkSheet | undefined): ImportMeta {
  if (!ws) return {};
  const meta: ImportMeta = {};
  for (const r of XLSX.utils.sheet_to_json<Row>(ws, { defval: '' })) {
    const nameA = r[META_COLUMNS.partnerAName];
    const nameB = r[META_COLUMNS.partnerBName];
    const pctA = parseNumber(r[META_COLUMNS.partnerAPct]);
    const dr = parseNumber(r[META_COLUMNS.discountRate]);
    if (nameA) meta.partnerAName = String(nameA);
    if (nameB) meta.partnerBName = String(nameB);
    if (pctA) meta.partnerAPct = pctA;
    if (dr) meta.discountRate = dr;
  }
  return meta;
}

/** Parse an uploaded .xlsx/.xls/.csv. Throws `ImportError` with a user-facing message. */
export function parseWorkbook(data: ArrayBuffer): ImportResult {
  const wb = XLSX.read(new Uint8Array(data), { type: 'array' });
  const firstSheet = wb.SheetNames[0];
  const ws = firstSheet ? wb.Sheets[firstSheet] : undefined;
  const rows = ws ? XLSX.utils.sheet_to_json<Row>(ws, { defval: '' }) : [];
  if (rows.length === 0) throw new ImportError('No data found.');

  // Resolve which spreadsheet headers map to which property fields.
  const fieldMap = new Map<string, ImportField>();
  for (const header of Object.keys(rows[0]!)) {
    const field = HEADER_TO_FIELD.get(normalizeHeader(header));
    if (field) fieldMap.set(header, field);
  }
  const mapped = new Set(fieldMap.values());
  if (!mapped.has('name') && !mapped.has('marketVal')) {
    throw new ImportError('Missing required columns. See Column Guide.');
  }

  const properties = rows
    .map((row) => rowToProperty(row, fieldMap))
    .filter((p): p is PropertyInput => p !== null);

  return { properties, meta: parseMeta(wb.Sheets['_meta']) };
}

const INSTRUCTION_NOTES: readonly string[][] = [
  ['LTV NOTE'],
  ['LTV = Loan Balance / Market Value. Computed automatically, not an input column.'],
  [''],
  ['DEBT NPV NOTE'],
  ['The tool calculates Debt NPV as:'],
  ['  Phase 1: PV of IO payments for io_years'],
  ['  Phase 2: PV of P&I payments for (loan_term - io_years) years, on the amort_period schedule'],
  ['  Balloon: PV of remaining balance on the amort_period schedule, due at end of loan_term'],
  ['This correctly reflects that commercial loans have a balloon at maturity, not full 30-yr payoff.'],
  [''],
  ['CASH & CASH EQUIVALENTS NOTE'],
  ['Entered once in the tool header as a single portfolio-wide figure, not per property.'],
  ['Split directly by ownership percentage in the Settlement Ledger.'],
  [''],
  ['BASIS TRUE-UP NOTE'],
  ['Basis True-Up is calculated in the separate Tax Basis Depreciation tool, not here.'],
];

export function buildTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const headers = COLUMNS.map((c) => c.key);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...TEMPLATE_EXAMPLES]);
  ws['!cols'] = COLUMNS.map((c) => ({ wch: c.width }));
  XLSX.utils.book_append_sheet(wb, ws, 'Properties');

  const instructions: string[][] = [
    [`RE Partition Tool v${APP_VERSION} — Excel Template`],
    [''],
    ['COLUMN REFERENCE'],
    ...COLUMNS.map((c) => [c.key, c.instruction]),
    [''],
    ...INSTRUCTION_NOTES,
  ];
  const wsI = XLSX.utils.aoa_to_sheet(instructions);
  wsI['!cols'] = [{ wch: 24 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsI, 'Instructions');

  return wb;
}

/** Trigger a browser download of the template workbook. */
export function downloadTemplate(): void {
  XLSX.writeFile(buildTemplateWorkbook(), TEMPLATE_FILENAME);
}
