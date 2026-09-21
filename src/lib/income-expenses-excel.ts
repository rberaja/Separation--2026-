import * as XLSX from 'xlsx';

export type IncomeExpenseRecord = {
  property: string;
  income: number;
  expenses: number;
  noi: number;
  asOf: string;
  source: string;
};

export class IncomeExpensesImportError extends Error {
  override name = 'IncomeExpensesImportError';
}

const key = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const text = (row: unknown[], index: number) => String(row[index] ?? '').trim();
const number = (value: unknown) => Number(String(value ?? '').replace(/[^0-9.()-]/g, '').replace(/^\((.*)\)$/, '-$1')) || 0;
const amount = (value: unknown) => Math.abs(number(value));
const columnFor = (headers: string[], names: string[]) => headers.findIndex((header) => names.includes(header));

const PROPERTY_HEADERS = ['property', 'propertyname', 'propertyaddress', 'address', 'building', 'asset'];
const INCOME_HEADERS = ['totalincome', 'income', 'grossincome', 'totalrevenue', 'revenue', 'operatingincome'];
const EXPENSE_HEADERS = ['totalexpenses', 'expenses', 'operatingexpenses', 'totaloperatingexpenses', 'expense'];
const NOI_HEADERS = ['noi', 'netoperatingincome', 'netoperatingincomeloss'];

function reportDate(rows: unknown[][], end: number) {
  const metadata = rows.slice(0, end).flat().map((value) => String(value ?? '').trim());
  const line = metadata.find((value) => /^(as\s+of|for\s+the\s+period|report\s+date|exported\s+on|date\s+range)\s*:/i.test(value)) ?? '';
  return line.replace(/^[^:]+:\s*/, '').trim();
}

/** Reads AppFolio's Income Statement - Property Comparison, where each property is a column. */
function parseAppFolioPropertyComparison(rows: unknown[][], sheetName: string | undefined): IncomeExpenseRecord[] | null {
  const headerRow = rows.findIndex((row) => key(row[0]) === 'accountname');
  if (headerRow < 0) return null;
  const incomeRow = rows.findIndex((row) => key(row[0]) === 'totaloperatingincome');
  const expensesRow = rows.findIndex((row) => ['totaloperatingexpense', 'totaloperatingexpenses'].includes(key(row[0])));
  const noiRow = rows.findIndex((row) => ['noinetoperatingincome', 'netoperatingincome'].includes(key(row[0])));
  if (incomeRow < 0 || expensesRow < 0 || noiRow < 0) return null;

  const headers = rows[headerRow] ?? [];
  const asOf = reportDate(rows, headerRow);
  const source = `${sheetName ?? 'Report'} rows ${incomeRow + 1}, ${expensesRow + 1}, ${noiRow + 1}`;
  return headers.slice(1).map((header, index) => {
    const column = index + 1;
    const property = String(header ?? '').trim();
    if (!property || /^total$/i.test(property)) return null;
    const income = amount(rows[incomeRow]?.[column]);
    const expenses = amount(rows[expensesRow]?.[column]);
    const reportedNoi = number(rows[noiRow]?.[column]);
    return { property, income, expenses, noi: Number.isFinite(reportedNoi) ? reportedNoi : income - expenses, asOf, source };
  }).filter((record): record is IncomeExpenseRecord => record !== null);
}

/**
 * Reads the property-summary form of an AppFolio Income Statement / P&L report.
 * AppFolio labels vary by report, so common Income, Expenses, and NOI aliases are
 * accepted. Expenses are displayed as positive dollars; NOI is income minus expenses
 * whenever both totals are available.
 */
export function parseIncomeExpensesWorkbook(data: ArrayBuffer): IncomeExpenseRecord[] {
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  const rows = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false }) : [];
  const propertyComparison = parseAppFolioPropertyComparison(rows, sheetName);
  if (propertyComparison?.length) return propertyComparison;
  const headerRow = rows.findIndex((row) => {
    const headers = row.map(key);
    return headers.some((header) => PROPERTY_HEADERS.includes(header))
      && headers.some((header) => [...INCOME_HEADERS, ...EXPENSE_HEADERS, ...NOI_HEADERS].includes(header));
  });
  if (headerRow < 0) throw new IncomeExpensesImportError('Could not find Property and Income, Expenses, or NOI columns in the AppFolio report.');

  const headers = rows[headerRow]!.map(key);
  const propertyColumn = columnFor(headers, PROPERTY_HEADERS);
  const incomeColumn = columnFor(headers, INCOME_HEADERS);
  const expensesColumn = columnFor(headers, EXPENSE_HEADERS);
  const noiColumn = columnFor(headers, NOI_HEADERS);
  if (propertyColumn < 0 || (incomeColumn < 0 && expensesColumn < 0 && noiColumn < 0)) {
    throw new IncomeExpensesImportError('The report needs a Property column and at least one of Total Income, Total Expenses, or NOI.');
  }

  const combined = new Map<string, IncomeExpenseRecord>();
  const asOf = reportDate(rows, headerRow);
  for (const [rowIndex, row] of rows.slice(headerRow + 1).entries()) {
    const property = text(row, propertyColumn);
    if (!property || /^total\b/i.test(property)) continue;
    const income = incomeColumn >= 0 ? amount(row[incomeColumn]) : 0;
    const expenses = expensesColumn >= 0 ? amount(row[expensesColumn]) : 0;
    const reportedNoi = noiColumn >= 0 ? number(row[noiColumn]) : 0;
    const source = `${sheetName ?? 'Report'} row ${headerRow + rowIndex + 2}`;
    const existing = combined.get(property.toLowerCase());
    const nextIncome = (existing?.income ?? 0) + income;
    const nextExpenses = (existing?.expenses ?? 0) + expenses;
    combined.set(property.toLowerCase(), {
      property: existing?.property ?? property,
      income: nextIncome,
      expenses: nextExpenses,
      noi: incomeColumn >= 0 && expensesColumn >= 0 ? nextIncome - nextExpenses : (existing?.noi ?? 0) + reportedNoi,
      asOf: existing?.asOf || asOf,
      source: existing ? `${existing.source}; ${source}` : source,
    });
  }
  const records = [...combined.values()];
  if (!records.length) throw new IncomeExpensesImportError('No property summary rows were found in the AppFolio report.');
  return records;
}

export function buildIncomeExpensesTemplateWorkbook(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Income & Expenses Import'],
    ['Property', 'Total Income', 'Total Expenses', 'NOI', 'As Of'],
    ...Array.from({ length: 20 }, () => ['', '', '', '', '']),
  ]);
  sheet['!cols'] = [34, 18, 18, 18, 16].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Income & Expenses');
  const instructions = XLSX.utils.aoa_to_sheet([
    ['Income & Expenses template instructions'],
    ['Upload the AppFolio property-summary Income Statement or P&L whenever possible.'],
    ['The tool reads Property, Total Income, Total Expenses, and NOI. If Income and Expenses are present, NOI is calculated as Income less Expenses.'],
  ]);
  instructions['!cols'] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions');
  return workbook;
}

export function downloadIncomeExpensesTemplate() {
  XLSX.writeFile(buildIncomeExpensesTemplateWorkbook(), 'Income and Expenses Manual Template.xlsx');
}

export function downloadIncomeExpensesWorkbook(records: readonly IncomeExpenseRecord[]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Income & Expenses Export'],
    ['Property', 'Total Income', 'Total Expenses', 'NOI', 'As Of', 'Source'],
    ...records.map((record) => [record.property, record.income, record.expenses, record.noi, record.asOf, record.source]),
  ]);
  sheet['!cols'] = [34, 18, 18, 18, 16, 26].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Income & Expenses');
  XLSX.writeFile(workbook, 'Income and Expenses Export.xlsx');
}
