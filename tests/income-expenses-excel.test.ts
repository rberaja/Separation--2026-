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
});
