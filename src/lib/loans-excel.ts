import * as XLSX from 'xlsx';

export type LoanRecord = {
  property: string;
  lender: string;
  loanType: string;
  outstandingBalance: number;
  monthlyDebtService: number;
  interestRate: number | null;
  nextInterestRateDate: string;
  maturityDate: string;
  /** Report date used to calculate the years remaining until reset or maturity. */
  reportAsOfDate: string;
  residualTermYears: number | null;
  /** Exact worksheet row used for this value; retained for audit and correction. */
  source?: string;
};

export class LoansImportError extends Error {
  override name = 'LoansImportError';
}

const key = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const text = (row: unknown[], column: number) => String(row[column] ?? '').trim();
const amount = (value: unknown) => Math.max(0, Number(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0);
const numberOrNull = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};
const columnFor = (headers: string[], names: string[]) => headers.findIndex((header) => names.includes(header));

function dateValue(value: unknown): Date | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const serial = Number(raw);
  if (/^\d+(?:\.\d+)?$/.test(raw) && serial >= 20_000 && serial <= 60_000) {
    const parts = XLSX.SSF.parse_date_code(serial);
    return parts ? new Date(Date.UTC(parts.y, parts.m - 1, parts.d)) : null;
  }
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return new Date(Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2])));
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return iso ? new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))) : null;
}

function formatDate(value: unknown) {
  const date = dateValue(value);
  if (!date) return String(value ?? '').trim();
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: '2-digit', day: '2-digit', year: 'numeric' }).format(date);
}

function residualTermYears(asOf: unknown, nextRate: unknown, maturity: unknown) {
  const asOfDate = dateValue(asOf);
  const deadline = [dateValue(nextRate), dateValue(maturity)].filter((date): date is Date => date !== null).sort((left, right) => left.getTime() - right.getTime())[0];
  if (!asOfDate || !deadline) return null;
  return Math.max(0, Math.round(((deadline.getTime() - asOfDate.getTime()) / 86_400_000 / 365.2425) * 100) / 100);
}

/** Reads a loan schedule. One property may have more than one loan; their balances are totaled in the group view. */
export function parseLoansWorkbook(data: ArrayBuffer): LoanRecord[] {
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
  const sheet = workbook.SheetNames[0] ? workbook.Sheets[workbook.SheetNames[0]] : undefined;
  const rows = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false }) : [];
  const headerRow = rows.findIndex((row) => row.map(key).some((header) => ['property', 'propertyname', 'address', 'building', 'asset'].includes(header)));
  if (headerRow < 0) throw new LoansImportError('Could not find a Property or Address column in the loan schedule.');
  const headers = rows[headerRow]!.map(key);
  const propertyColumn = columnFor(headers, ['property', 'propertyname', 'address', 'building', 'asset']);
  const lenderColumn = columnFor(headers, ['lender', 'bank', 'lendinginstitution']);
  const typeColumn = columnFor(headers, ['loantype', 'type', 'debtinstrument']);
  const balanceColumn = columnFor(headers, ['outstandingbalance', 'endingbalance', 'loanbalance', 'balance', 'principalbalance']);
  const debtServiceColumn = columnFor(headers, ['monthlydebtservice', 'debtservice', 'monthlypayment', 'monthlypaymentpi', 'payment']);
  const interestRateColumn = columnFor(headers, ['interestrate', 'rate']);
  const nextInterestRateColumn = columnFor(headers, ['nextinterestratedate', 'nextratedate', 'interestrateresetdate', 'nextresetdate']);
  const maturityColumn = columnFor(headers, ['maturitydate', 'maturity', 'duedate']);
  if (propertyColumn < 0) throw new LoansImportError('The loan schedule needs a Property or Address column.');
  const asOfRow = rows.slice(0, headerRow).flat().map((value) => String(value ?? '').trim()).find((value) => /^as\s+of\s*:/i.test(value)) ?? '';
  const asOfValue = asOfRow.replace(/^as\s+of\s*:\s*/i, '');
  const reportAsOfDate = formatDate(asOfValue);
  const records = rows.slice(headerRow + 1).map((row, rowIndex) => ({
    property: text(row, propertyColumn), lender: lenderColumn >= 0 ? text(row, lenderColumn) : '', loanType: typeColumn >= 0 ? text(row, typeColumn) : '',
    outstandingBalance: balanceColumn >= 0 ? amount(row[balanceColumn]) : 0, monthlyDebtService: debtServiceColumn >= 0 ? amount(row[debtServiceColumn]) : 0,
    interestRate: interestRateColumn >= 0 ? numberOrNull(row[interestRateColumn]) : null,
    nextInterestRateDate: nextInterestRateColumn >= 0 ? formatDate(row[nextInterestRateColumn]) : '',
    maturityDate: maturityColumn >= 0 ? formatDate(row[maturityColumn]) : '',
    reportAsOfDate,
    residualTermYears: residualTermYears(asOfValue, nextInterestRateColumn >= 0 ? row[nextInterestRateColumn] : '', maturityColumn >= 0 ? row[maturityColumn] : ''),
    source: `${workbook.SheetNames[0] ?? 'Report'} row ${headerRow + rowIndex + 2}`,
  })).filter((record) => record.property);
  if (!records.length) throw new LoansImportError('No property rows were found in the loan schedule.');
  return records;
}

export function buildLoansTemplateWorkbook(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Loan Schedule Import'],
    ['Property', 'Lender', 'Loan Type', 'Outstanding Balance', 'Monthly Debt Service', 'Interest Rate', 'Next Interest Rate Date', 'Maturity Date'],
    ...Array.from({ length: 20 }, () => ['', '', '', '', '', '', '', '']),
  ]);
  sheet['!cols'] = [34, 28, 20, 20, 22, 16, 23, 18].map((wch) => ({ wch }));
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
    ['Property', 'Lender', 'Loan Type', 'Outstanding Balance', 'Monthly Debt Service', 'Interest Rate', 'Next Interest Rate Date', 'Maturity Date', 'Report As Of', 'Residual Term (yrs)', 'Source'],
    ...records.map((record) => [record.property, record.lender, record.loanType, record.outstandingBalance, record.monthlyDebtService, record.interestRate ?? '', record.nextInterestRateDate, record.maturityDate, record.reportAsOfDate, record.residualTermYears ?? '', record.source ?? '']),
  ]);
  sheet['!cols'] = [34, 28, 20, 20, 22, 16, 23, 18, 18, 20, 28].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Loans');
  XLSX.writeFile(workbook, 'Loans Export.xlsx');
}
