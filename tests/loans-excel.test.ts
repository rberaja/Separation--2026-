import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { normalizeLoanRecordTerms, parseLoansWorkbook } from '../src/lib/loans-excel';

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
      ['Property', 'Monthly Principal & Interest', 'Ending Balance', 'Interest Rate', 'Amortization', 'P&I Rate Change Date', 'Maturity Date'],
      ['10 SW 30TH CT', '1,538.85', '320,173.48', '3.25', '30', '05/31/2028', '05/31/2052'],
    ]));

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      property: '10 SW 30TH CT',
      outstandingBalance: 320173.48,
      monthlyDebtService: 1538.85,
      interestRate: 3.25,
      amortizationPeriod: 30,
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

    expect(record).toMatchObject({ outstandingBalance: 1825019.63, monthlyDebtService: 0, interestRate: null, loanType: 'Principal & Interest', interestOnlyUntil: '', interestOnlyYears: 0, nextInterestRateDate: '', maturityDate: '06/01/2026', residualTermYears: 0 });
  });

  it('uses Interest-Only Until to classify the loan and calculate the remaining IO period', () => {
    const [record] = parseLoansWorkbook(workbookFromRows([
      ['As of: 08/12/2026'],
      ['Property', 'Ending Balance', 'Amortization Periods', 'IO Until Date', 'P&I Rate Change Date', 'Maturity Date'],
      ['10 SW 30TH CT', '320,173.48', '30', '05/31/2028', '05/31/2028', '05/31/2052'],
    ]));

    expect(record).toMatchObject({ loanType: 'Interest Only', amortizationPeriod: 30, interestOnlyUntil: '05/31/2028', nextInterestRateDate: '05/31/2028' });
    expect(record?.interestOnlyYears).toBeGreaterThan(1);
    expect(record?.interestOnlyYears).toBeLessThan(2);
  });

  it('defaults to principal and interest when Interest-Only Until is blank', () => {
    const [record] = parseLoansWorkbook(workbookFromRows([
      ['As of: 08/12/2026'],
      ['Property', 'Loan Type', 'Interest-Only Until', 'P&I Rate Change Date'],
      ['10 SW 30TH CT', 'Interest Only', '', '05/31/2028'],
    ]));

    expect(record).toMatchObject({ loanType: 'Principal & Interest', interestOnlyUntil: '', nextInterestRateDate: '05/31/2028' });
  });

  it('recalculates retained loan terms from its report, IO, rate-change, and maturity dates', () => {
    const record = normalizeLoanRecordTerms({
      property: '600 SW 9 AVE', lender: '', loanType: 'Principal & Interest', outstandingBalance: 1618302.7, interestRate: 3.25, amortizationPeriod: 30,
      interestOnlyUntil: '', interestOnlyYears: 0, nextInterestRateDate: '05/31/2028', monthlyDebtService: 7796.85, maturityDate: '05/31/2028', reportAsOfDate: '08/12/2026', residualTermYears: 0,
    });

    expect(record).toMatchObject({ loanType: 'Principal & Interest', interestOnlyYears: 0 });
    expect(record.residualTermYears).toBeGreaterThan(1);
    expect(record.residualTermYears).toBeLessThan(2);
  });
});
