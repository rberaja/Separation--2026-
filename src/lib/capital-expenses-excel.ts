import * as XLSX from 'xlsx';

export type CapitalExpenseRecord = { property: string; need: string; category: string; status: string; approximateCost: number; asOf: string; source: string };
export class CapitalExpensesImportError extends Error { override name = 'CapitalExpensesImportError'; }
const key = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const text = (row: unknown[], index: number) => String(row[index] ?? '').trim();
const amount = (value: unknown) => Math.max(0, Number(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0);
const columnFor = (headers: string[], names: string[]) => headers.findIndex((header) => names.includes(header));
const reportDate = (rows: unknown[][], end: number) => {
  const metadata = rows.slice(0, end).flat().map((value) => String(value ?? '').trim());
  const line = metadata.find((value) => /^(as\s+of|exported\s+on|report\s+date)\s*:/i.test(value)) ?? '';
  return line.match(/\d{1,2}\/\d{1,2}\/\d{4}/)?.[0] ?? '';
};

/** Reads a property-management CapEx, work-order, budget, or financial report. */
export function parseCapitalExpensesWorkbook(data: ArrayBuffer): CapitalExpenseRecord[] {
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
  const sheetName = workbook.SheetNames[0]; const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  const rows = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) : [];
  const headerRow = rows.findIndex((row) => row.map(key).some((header) => ['property', 'propertyname', 'address', 'building', 'asset'].includes(header)));
  if (headerRow < 0) throw new CapitalExpensesImportError('Could not find a Property or Address column in the Capital Expenses report.');
  const headers = rows[headerRow]!.map(key); const property = columnFor(headers, ['property', 'propertyname', 'address', 'building', 'asset']);
  const need = columnFor(headers, ['need', 'name', 'description', 'workdescription', 'capitalexpense', 'capexneed', 'project']);
  const category = columnFor(headers, ['category', 'capexcategory', 'type']); const status = columnFor(headers, ['status', 'projectstatus']);
  const cost = columnFor(headers, ['approximatecost', 'estimatedcost', 'totalbudget', 'budget', 'amount', 'cost', 'projectcost']); const asOf = columnFor(headers, ['asof', 'asofdate', 'reportdate', 'date']);
  const asOfReportDate = reportDate(rows, headerRow);
  const records = rows.slice(headerRow + 1).map((row, rowIndex) => ({ property: text(row, property), need: need >= 0 ? text(row, need) : '', category: category >= 0 ? text(row, category) : '', status: status >= 0 ? text(row, status) : '', approximateCost: cost >= 0 ? amount(row[cost]) : 0, asOf: asOf >= 0 ? text(row, asOf) : asOfReportDate, source: `${sheetName ?? 'Report'} row ${headerRow + rowIndex + 2}` })).filter((record) => record.property);
  if (!records.length) throw new CapitalExpensesImportError('No property rows were found in the Capital Expenses report.'); return records;
}
export function buildCapitalExpensesTemplateWorkbook(): XLSX.WorkBook { const workbook = XLSX.utils.book_new(); const sheet = XLSX.utils.aoa_to_sheet([['Capital Expenses Import'], ['Property', 'Need / Description', 'Category', 'Status', 'Approximate Cost', 'As Of'], ...Array.from({ length: 20 }, () => ['', '', '', '', '', ''])]); sheet['!cols'] = [32, 38, 20, 18, 18, 16].map((wch) => ({ wch })); XLSX.utils.book_append_sheet(workbook, sheet, 'Capital Expenses'); return workbook; }
export function downloadCapitalExpensesTemplate() { XLSX.writeFile(buildCapitalExpensesTemplateWorkbook(), 'Capital Expenses Fallback Template.xlsx'); }
export function downloadCapitalExpensesWorkbook(records: readonly CapitalExpenseRecord[]) { const workbook = XLSX.utils.book_new(); const sheet = XLSX.utils.aoa_to_sheet([['Capital Expenses Export'], ['Property', 'Need / Description', 'Category', 'Status', 'Approximate Cost', 'As Of', 'Source'], ...records.map((r) => [r.property, r.need, r.category, r.status, r.approximateCost, r.asOf, r.source])]); sheet['!cols'] = [32, 38, 20, 18, 18, 16, 22].map((wch) => ({ wch })); XLSX.utils.book_append_sheet(workbook, sheet, 'Capital Expenses'); XLSX.writeFile(workbook, 'Capital Expenses Export.xlsx'); }
