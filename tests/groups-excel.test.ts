import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildGroupsTemplateWorkbook, parseGroupsWorkbook } from '../src/lib/groups-excel';

function workbook(rows: unknown[][]): ArrayBuffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Property Grouped');
  return XLSX.write(book, { bookType: 'xlsx', type: 'array' });
}

describe('parseGroupsWorkbook', () => {
  it('builds a template with the same Property Grouped columns', () => {
    const template = buildGroupsTemplateWorkbook();
    const rows = XLSX.utils.sheet_to_json<unknown[]>(template.Sheets['Property Grouped']!, { header: 1, defval: '' });
    expect(template.SheetNames).toEqual(['Property Grouped', 'Instructions']);
    expect(rows[0]![0]).toBe('GROUPED - Planned Separation Values');
    expect(rows[1]).toEqual(['#', 'Owners', 'Owner(s)', 'Group', 'Property', 'City', 'State', 'Zip', 'Units']);
  });

  it('uses the workbook Group and Property columns after a title row', () => {
    const result = parseGroupsWorkbook(workbook([
      ['Portfolio grouping'],
      ['Owners', 'Group', 'Property', 'City', 'State', 'Units'],
      ['Entity A', 'The 600-930', '600 SW 9 Ave', 'Miami', 'FL', 24],
      ['Entity A', 'The 600-930', '930 SW 6th Street', 'Miami', 'FL', 13],
      ['Entity B', '', '1101 SW 6th St', 'Miami', 'FL', 8],
    ]));

    expect(result.individualProperties).toEqual([
      { property: '1101 SW 6th St', entity: 'Entity B', city: 'Miami', state: 'FL', zip: '', units: '8' },
    ]);
    expect(result.groups).toEqual([{ name: 'The 600-930', members: [
      { property: '600 SW 9 Ave', entity: 'Entity A', city: 'Miami', state: 'FL', zip: '', units: '24' },
      { property: '930 SW 6th Street', entity: 'Entity A', city: 'Miami', state: 'FL', zip: '', units: '13' },
    ] }]);
  });
});
