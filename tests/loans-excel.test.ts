import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseLoansWorkbook } from '../src/lib/loans-excel';

function workbookFromRows(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Loans');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('AppFolio loan report import', () => {
  it('maps AppFolio balance, P&I, rate, reset date, and maturity date', () => {
    const records = parseLoansWorkbook(workbookFromRows([
      ['Loans'],
      ['As of: 08/12/2026'],
      ['Property', 'Monthly Payment (P&I)', 'Ending Balance', 'Interest Rate', 'Next Interest Rate Date', 'Maturity Date'],
      ['10 SW 30TH CT', '1,538.85', '320,173.48', '3.25', '05/31/2028', '05/31/2052'],
    ]));

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      property: '10 SW 30TH CT',
      outstandingBalance: 320173.48,
      monthlyDebtService: 1538.85,
      interestRate: 3.25,
      nextInterestRateDate: '05/31/2028',
      maturityDate: '05/31/2052',
      reportAsOfDate: '08/12/2026',
    });
    expect(records[0]?.residualTermYears).toBeGreaterThan(1);
    expect(records[0]?.residualTermYears).toBeLessThan(2);
  });

  it('keeps unavailable AppFolio loan terms blank instead of treating them as zero', () => {
    const [record] = parseLoansWorkbook(workbookFromRows([
      ['As of: 08/12/2026'],
      ['Property', 'Monthly Payment (P&I)', 'Ending Balance', 'Interest Rate', 'Next Interest Rate Date', 'Maturity Date'],
      ['3270 West Trade Avenue', '', '1,825,019.63', '', '', '06/01/2026'],
    ]));

    expect(record).toMatchObject({ outstandingBalance: 1825019.63, monthlyDebtService: 0, interestRate: null, nextInterestRateDate: '', maturityDate: '06/01/2026', residualTermYears: 0 });
  });
});
