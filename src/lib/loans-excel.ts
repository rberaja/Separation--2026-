import * as XLSX from 'xlsx';

export type LoanRecord = {
  property: string;
  lender: string;
  loanType: string;
  outstandingBalance: number;
  monthlyDebtService: number;
  maturityDate: string;
  /** Exact worksheet row used for this value; retained for audit and correction. */
  source?: string;
};

export class LoansImportError extends Error {
  override name = 'LoansImportError';
}

const key = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const text = (row: unknown[], column: number) => String(row[column] ?? '').trim();
const amount = (value: unknown) => Math.max(0, Number(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0);
const columnFor = (headers: string[], names: string[]) => headers.findIndex((header) => names.includes(header));

/** Reads a loan schedule. One property may have more than one loan; their balances are totaled in the group view. */
export function parseLoansWorkbook(data: ArrayBuffer): LoanRecord[] {
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
  const sheet = workbook.SheetNames[0] ? workbook.Sheets[workbook.SheetNames[0]] : undefined;
  const rows = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) : [];
  const headerRow = rows.findIndex((row) => row.map(key).some((header) => ['property', 'propertyname', 'address', 'building', 'asset'].includes(header)));
  if (headerRow < 0) throw new LoansImportError('Could not find a Property or Address column in the loan schedule.');
  const headers = rows[headerRow]!.map(key);
  const propertyColumn = columnFor(headers, ['property', 'propertyname', 'address', 'building', 'asset']);
  const lenderColumn = columnFor(headers, ['lender', 'bank', 'lendinginstitution']);
  const typeColumn = columnFor(headers, ['loantype', 'type', 'debtinstrument']);
  const balanceColumn = columnFor(headers, ['outstandingbalance', 'loanbalance', 'balance', 'principalbalance']);
  const debtServiceColumn = columnFor(headers, ['monthlydebtservice', 'debtservice', 'monthlypayment', 'payment']);
  const maturityColumn = columnFor(headers, ['maturitydate', 'maturity', 'duedate']);
  if (propertyColumn < 0) throw new LoansImportError('The loan schedule needs a Property or Address column.');
  const records = rows.slice(headerRow + 1).map((row, rowIndex) => ({
    property: text(row, propertyColumn), lender: lenderColumn >= 0 ? text(row, lenderColumn) : '', loanType: typeColumn >= 0 ? text(row, typeColumn) : '',
    outstandingBalance: balanceColumn >= 0 ? amount(row[balanceColumn]) : 0, monthlyDebtService: debtServiceColumn >= 0 ? amount(row[debtServiceColumn]) : 0,
    maturityDate: maturityColumn >= 0 ? text(row, maturityColumn) : '', source: `${workbook.SheetNames[0] ?? 'Report'} row ${headerRow + rowIndex + 2}`,
  })).filter((record) => record.property);
  if (!records.length) throw new LoansImportError('No property rows were found in the loan schedule.');
  return records;
}

export function buildLoansTemplateWorkbook(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Loan Schedule Import'],
    ['Property', 'Lender', 'Loan Type', 'Outstanding Balance', 'Monthly Debt Service', 'Maturity Date'],
    ...Array.from({ length: 20 }, () => ['', '', '', '', '', '']),
  ]);
  sheet['!cols'] = [34, 28, 20, 20, 22, 18].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Loans');
  const instructions = XLSX.utils.aoa_to_sheet([
    ['Loan schedule instructions'],
    ['Enter one loan per row. Multiple loans on one property are retained and totaled in the property and group summaries.'],
    ['Property is required and is matched to the Groups workbook using the property name or address.'],
  ]);
  instructions['!cols'] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions');
  return workbook;
}

export function downloadLoansTemplate() { XLSX.writeFile(buildLoansTemplateWorkbook(), 'Loan Schedule Template.xlsx'); }

export function downloadLoansWorkbook(records: readonly LoanRecord[]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Loan Schedule Export'],
    ['Property', 'Lender', 'Loan Type', 'Outstanding Balance', 'Monthly Debt Service', 'Maturity Date', 'Source'],
    ...records.map((record) => [record.property, record.lender, record.loanType, record.outstandingBalance, record.monthlyDebtService, record.maturityDate, record.source ?? '']),
  ]);
  sheet['!cols'] = [34, 28, 20, 20, 22, 18, 28].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Loans');
  XLSX.writeFile(workbook, 'Loans Export.xlsx');
}
