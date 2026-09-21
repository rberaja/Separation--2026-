import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseIncomeExpensesWorkbook } from '../src/lib/income-expenses-excel';

function workbookFromRows(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Income Statement');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('AppFolio income and expenses import', () => {
  it('extracts the property-level totals and calculates NOI from income less expenses', () => {
    const records = parseIncomeExpensesWorkbook(workbookFromRows([
      ['Income Statement'],
      ['As Of: 08/31/2026'],
      ['Property Name', 'Total Income', 'Total Expenses', 'NOI'],
      ['600 SW 9 AVE', '$120,000', '($45,000)', '$75,000'],
    ]));

    expect(records).toEqual([expect.objectContaining({
      property: '600 SW 9 AVE', income: 120000, expenses: 45000, noi: 75000,
      asOf: '08/31/2026', source: 'Income Statement row 4',
    })]);
  });

  it('uses the reported NOI when an AppFolio export does not include income and expenses separately', () => {
    const records = parseIncomeExpensesWorkbook(workbookFromRows([
      ['Property', 'Net Operating Income'],
      ['930 SW 6th Street', '42,500'],
    ]));
    expect(records[0]).toMatchObject({ income: 0, expenses: 0, noi: 42500 });
  });

  it('extracts column totals from an AppFolio Income Statement - Property Comparison report', () => {
    const records = parseIncomeExpensesWorkbook(workbookFromRows([
      ['Income Statement - Property Comparison'],
      ['Date Range: Jun 2025 to May 2026'],
      [],
      ['Account Name', '600 SW 9 AVE', '930 SW 6 St', 'Total'],
      ['Total Operating Income', '538,923.94', '916,368.31', '1,455,292.25'],
      ['Total Operating Expense', '217,416.60', '327,729.42', '545,146.02'],
      ['NOI - Net Operating Income', '321,507.34', '588,638.89', '910,146.23'],
    ]));

    expect(records).toEqual([
      expect.objectContaining({ property: '600 SW 9 AVE', income: 538923.94, expenses: 217416.60, noi: 321507.34, asOf: 'Jun 2025 to May 2026' }),
      expect.objectContaining({ property: '930 SW 6 St', income: 916368.31, expenses: 327729.42, noi: 588638.89, asOf: 'Jun 2025 to May 2026' }),
    ]);
  });
});
