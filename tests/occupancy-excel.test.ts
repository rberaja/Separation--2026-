import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseOccupancyWorkbook } from '../src/lib/occupancy-excel';

function workbookFromRows(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Rent Roll');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('AppFolio occupancy import', () => {
  it('applies the report date above the property table to every property', () => {
    const records = parseOccupancyWorkbook(workbookFromRows([
      ['Rent Roll'],
      ['As Of: 09/22/2026'],
      ['Property', 'Units', 'Occupied Units', 'Scheduled Rent'],
      ['600 SW 9 AVE', 24, 21, 45000],
      ['930 SW 6 St', 12, 11, 22000],
    ]));

    expect(records).toEqual([
      expect.objectContaining({ property: '600 SW 9 AVE', asOf: '09/22/2026' }),
      expect.objectContaining({ property: '930 SW 6 St', asOf: '09/22/2026' }),
    ]);
  });
});
