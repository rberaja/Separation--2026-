/**
 * Excel report: three sheets built from the `Report` model.
 *   Properties — one row per property in import format (+ calculated columns), so it reloads via Upload Excel
 *   Summary    — settings, partner totals, gap analysis and the final settlement
 *   _meta      — partner names / split / discount rate / cash, read back on import
 * Only `downloadReport` touches the DOM.
 */
import * as XLSX from 'xlsx';
import { COLUMNS, META_COLUMNS } from './columns';
import { GAP_LABELS } from './labels';
import {
  PROPERTY_CALC_COLUMNS,
  isoDate,
  reportFileStem,
  type CellKind,
  type CellValue,
  type Report,
} from './report';

const FORMAT: Record<Exclude<CellKind, 'text'>, string> = {
  money: '"$"#,##0;[Red]-"$"#,##0',
  pct: '0.0',
  num: '0',
};

type Cell = XLSX.CellObject | string | number | null;

/** A typed, formatted cell; blanks stay blank so the sheet reloads cleanly. */
function cell(v: CellValue, kind: CellKind): Cell {
  if (v === null || v === '') return null;
  if (kind === 'text' || typeof v !== 'number') return String(v);
  return { t: 'n', v, z: FORMAT[kind] };
}

const money = (v: number | null): Cell => cell(v, 'money');

function propertiesSheet(r: Report): XLSX.WorkSheet {
  const cols = [...r.inputColumns, ...PROPERTY_CALC_COLUMNS];
  const rows: Cell[][] = [
    cols.map((c) => c.key),
    ...r.properties.map((p) => cols.map((c) => cell(p.cells[c.key] ?? null, c.kind))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [...COLUMNS.map((c) => ({ wch: c.width })), ...PROPERTY_CALC_COLUMNS.map(() => ({ wch: 16 }))];
  if (r.properties.length > 0) {
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r.properties.length, c: cols.length - 1 } }) };
  }
  return ws;
}

const GROUPED_SCHEDULE_COLUMNS: ReadonlyArray<{ key: string; label: string; kind: CellKind }> = [
  { key: 'market_value', label: 'Market Value', kind: 'money' },
  { key: 'adj_net_value', label: 'Adjusted Value', kind: 'money' },
  { key: 'debt_npv', label: 'Debt NPV', kind: 'money' },
  { key: 'npv_equity', label: 'NPV Equity', kind: 'money' },
  { key: 'net_cash_flow', label: 'Net Cash Flow / yr', kind: 'money' },
  { key: 'remaining_tax_basis', label: 'Remaining Tax Basis', kind: 'money' },
  { key: 'depreciation', label: 'Depreciation', kind: 'money' },
];

function assignmentLabel(r: Report, assignment: Report['properties'][number]['assign']): string {
  return assignment === 'none' ? 'Unassigned' : r.partnerNames[assignment];
}

/** Group totals and their individual source properties; this sheet is for review and printing, not re-import. */
function groupedScheduleSheet(r: Report): XLSX.WorkSheet {
  const headers: Cell[] = ['Selection unit', 'Level', 'Partner', ...GROUPED_SCHEDULE_COLUMNS.map((column) => column.label === 'Depreciation' ? `Depreciation ${r.depreciationYear}` : column.label)];
  const groups = new Map<string, typeof r.properties>();
  const individuals: typeof r.properties = [];
  for (const property of r.properties) {
    if (property.groupName) groups.set(property.groupName, [...(groups.get(property.groupName) ?? []), property]);
    else individuals.push(property);
  }
  const metricCells = (properties: typeof r.properties): Cell[] => GROUPED_SCHEDULE_COLUMNS.map((column) => cell(properties.reduce((total, property) => total + (typeof property.cells[column.key] === 'number' ? property.cells[column.key] as number : 0), 0), column.kind));
  const propertyRow = (property: Report['properties'][number], level: string): Cell[] => [property.name, level, assignmentLabel(r, property.assign), ...GROUPED_SCHEDULE_COLUMNS.map((column) => cell(property.cells[column.key] ?? null, column.kind))];
  const rows: Cell[][] = [headers];
  for (const [groupName, properties] of groups) {
    const assignments = new Set(properties.map((property) => property.assign));
    const groupAssignment = assignments.size === 1 ? assignmentLabel(r, properties[0]!.assign) : 'Mixed assignment';
    rows.push([groupName, `Group total · ${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`, groupAssignment, ...metricCells(properties)]);
    rows.push(...properties.map((property) => propertyRow(property, 'Group property')));
  }
  rows.push(...individuals.map((property) => propertyRow(property, 'Individual property')));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 32 }, { wch: 20 }, { wch: 18 }, ...GROUPED_SCHEDULE_COLUMNS.map(() => ({ wch: 18 }))];
  if (rows.length > 1) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: headers.length - 1 } }) };
  return ws;
}

function summarySheet(r: Report, generatedAt: Date): XLSX.WorkSheet {
  const { a: nameA, b: nameB } = r.partnerNames;
  const signed = (v: number | null): Cell => (v === null ? '—' : money(v));

  const rows: Cell[][] = [
    [`RE Partition Tool v${r.appVersion} — Settlement Report`],
    ['Generated', `${isoDate(generatedAt)} ${generatedAt.toTimeString().slice(0, 5)}`],
    ['Method', `White Paper v${r.whitePaperVersion} §14.1`],
    ['Partner A', nameA, r.pct.a / 100],
    ['Partner B', nameB, r.pct.b / 100],
    ['Market Discount Rate', r.discountRate === null ? null : r.discountRate / 100],
    ['Cash & Equivalents', money(r.cashEquiv)],
    ['Depreciation year', r.depreciationYear],
    ['Properties', r.properties.length, `A: ${r.counts.a} · B: ${r.counts.b} · Unassigned: ${r.counts.none}`],
    [],
    ['PARTNER TOTALS', nameA, nameB, 'Portfolio'],
    ...r.totals.map((t): Cell[] => [t.label, cell(t.a, t.kind), cell(t.b, t.kind), cell(t.portfolio, t.kind)]),
    [],
    ['GAP ANALYSIS (target − actual; positive = owed)', nameA, 'Unassigned', nameB],
    [GAP_LABELS.referenceTitle],
    ...r.gaps.reference.map((g): Cell[] => [g.label, signed(g.a), signed(g.u), signed(g.b)]),
    [GAP_LABELS.settlementTitle],
    ...r.gaps.settlement.map((g): Cell[] => [g.note ? `${g.label} (${g.note})` : g.label, signed(g.a), signed(g.u), signed(g.b)]),
    [],
    [GAP_LABELS.final, r.finalSettlement, r.complete ? '' : `PROVISIONAL — ${r.unassigned.count} unassigned`],
    [],
    ['NOTES'],
    ...r.notes.map((n): Cell[] => [n]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 44 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
  // Percent cells were written as fractions; give them a % format.
  for (const addr of ['C4', 'C5', 'B6']) {
    const c = ws[addr] as XLSX.CellObject | undefined;
    if (c && c.t === 'n') c.z = '0.0%';
  }
  return ws;
}

function metaSheet(r: Report): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet([
    {
      [META_COLUMNS.partnerAName]: r.partnerNames.a,
      [META_COLUMNS.partnerBName]: r.partnerNames.b,
      [META_COLUMNS.partnerAPct]: r.pct.a,
      [META_COLUMNS.discountRate]: r.discountRate ?? '',
      [META_COLUMNS.cashEquiv]: r.cashEquiv,
      [META_COLUMNS.depreciationYear]: r.depreciationYear,
    },
  ]);
  ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
  return ws;
}

export function buildReportWorkbook(r: Report, generatedAt = new Date()): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  // Properties must stay first: `parseWorkbook` reads the first sheet.
  XLSX.utils.book_append_sheet(wb, propertiesSheet(r), 'Properties');
  XLSX.utils.book_append_sheet(wb, groupedScheduleSheet(r), 'Grouped Schedule');
  XLSX.utils.book_append_sheet(wb, summarySheet(r, generatedAt), 'Summary');
  XLSX.utils.book_append_sheet(wb, metaSheet(r), '_meta');
  return wb;
}

/** Trigger a browser download of the report workbook. */
export function downloadReport(r: Report): void {
  const now = new Date();
  XLSX.writeFile(buildReportWorkbook(r, now), `${reportFileStem(now)}.xlsx`);
}
