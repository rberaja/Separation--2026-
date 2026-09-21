import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseCapitalExpensesWorkbook } from '../src/lib/capital-expenses-excel';

function workbookFromRows(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('AppFolio Project Directory CapEx import', () => {
  it('maps Name and Total Budget to the 600 SW electrical upgrade', () => {
    const records = parseCapitalExpensesWorkbook(workbookFromRows([
      ['Project Directory'],
      ['Exported On: 08/12/2026 11:21 AM'],
      ['Name', 'Property', 'Total Budget'],
      ['Electrical Update - 600 SW', '600 SW 9 AVE - 600 SW 9 AVE Miami, FL 33130', '120,000'],
    ]));

    expect(records).toEqual([expect.objectContaining({
      property: '600 SW 9 AVE - 600 SW 9 AVE Miami, FL 33130',
      need: 'Electrical Update - 600 SW',
      approximateCost: 120000,
      asOf: '08/12/2026',
      source: 'Sheet1 row 4',
    })]);
  });
});
