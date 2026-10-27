import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildMarketValueExportWorkbook, buildMarketValueTemplateWorkbook, matchMarketValueRecordsToGroups, parseMarketValueWorkbook } from '../src/lib/market-value-excel';

function workbookFromRows(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Market Value');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('Market Value workbooks', () => {
  it('applies the issued report date to rows without a date column', () => {
    const records = parseMarketValueWorkbook(workbookFromRows([
      ['Broker Opinion of Value'],
      ['Report Date: 08/12/2026 11:23 AM'],
      ['Property', 'Market Value'],
      ['600 SW 9 AVE', '4,250,000'],
    ]));

    expect(records).toEqual([expect.objectContaining({ property: '600 SW 9 AVE', asOf: '08/12/2026 11:23 AM' })]);
  });

  it('reads broker valuation inputs from the Roll Up purchase-price row', () => {
    const rows = Array.from({ length: 135 }, () => [] as unknown[]);
    rows[4]![2] = 'PROPERTY'; rows[4]![12] = '600 SW 9th Ave'; rows[4]![13] = '930 SW 6th St'; rows[4]![14] = 'Total (2)';
    rows[34]![2] = 'Rent Roll as of 5/31/2026';
    rows[119]![2] = 'Purchase Price'; rows[119]![12] = 4_750_000; rows[119]![13] = 1_930_000; rows[119]![14] = 6_680_000;
    rows[134]![2] = 'Assessed Value'; rows[134]![12] = 3_327_500; rows[134]![13] = 1_244_485; rows[134]![14] = 4_571_985;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Cover']]), 'Cover');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Roll Up');
    const records = parseMarketValueWorkbook(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);

    expect(records).toEqual([
      expect.objectContaining({ property: '600 SW 9th Ave', marketValue: 4_750_000, asOf: '5/31/2026', source: 'Roll Up!M120 (Purchase Price)' }),
      expect.objectContaining({ property: '930 SW 6th St', marketValue: 1_930_000, asOf: '5/31/2026', source: 'Roll Up!N120 (Purchase Price)' }),
    ]);

    expect(parseMarketValueWorkbook(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer, 'city-appraised')).toEqual([
      expect.objectContaining({ property: '600 SW 9th Ave', marketValue: 3_327_500, asOf: '5/31/2026', source: 'Roll Up!M135 (Assessed Value)' }),
      expect.objectContaining({ property: '930 SW 6th St', marketValue: 1_244_485, asOf: '5/31/2026', source: 'Roll Up!N135 (Assessed Value)' }),
    ]);
  });

  it('creates a distinct manual template for each uploaded valuation source', () => {
    const cityTemplate = buildMarketValueTemplateWorkbook('city-appraised');
    const rows = XLSX.utils.sheet_to_json<unknown[]>(cityTemplate.Sheets['Market Value']!, { header: 1, defval: '' });

    expect(rows[0]?.[0]).toBe('City Assessed Value Manual Import');
    expect(rows[1]).toEqual(['Property', 'Market Value', 'As Of', 'Value Type']);
  });

  it('imports only valuation rows represented in the Groups workbook and keeps its property label', () => {
    const result = matchMarketValueRecordsToGroups([
      { property: '600 SW 9th Avenue, Miami FL', marketValue: 4_250_000, asOf: '', valueType: '', source: 'Market Value row 2' },
      { property: 'Unrelated Building', marketValue: 1_200_000, asOf: '', valueType: '', source: 'Market Value row 3' },
    ], ['600 SW 9 AVE', '930 SW 6th Street']);

    expect(result.imported).toEqual([expect.objectContaining({ property: '600 SW 9 AVE', marketValue: 4_250_000 })]);
    expect(result.omitted).toEqual([expect.objectContaining({ property: 'Unrelated Building', source: 'Market Value row 3' })]);
    expect(result.missingGroupProperties).toEqual(['930 SW 6th Street']);
  });

  it.each(['bov', 'city-appraised', 'comps'] as const)('uses the same Groups reconciliation for %s uploads', (sourceKind) => {
    const result = matchMarketValueRecordsToGroups([
      { property: '600 SW 9th Avenue', marketValue: 4_250_000, asOf: '', valueType: '', source: 'Market Value row 2', sourceKind },
    ], ['600 SW 9 AVE']);

    expect(result.imported).toEqual([expect.objectContaining({ property: '600 SW 9 AVE', sourceKind })]);
    expect(result.omitted).toEqual([]);
    expect(result.missingGroupProperties).toEqual([]);
  });

  it('uses Groups rather than BOV labels to consolidate The Menores properties and flag genuine gaps', () => {
    const result = matchMarketValueRecordsToGroups([
      { property: '1410 SW 37th Ave', marketValue: 10_890_000, asOf: '', valueType: '', source: 'BOV row 2' },
      { property: '11, 25, 31 Menores Ave', marketValue: 5_695_000, asOf: '', valueType: '', source: 'BOV row 3' },
    ], ['2550 S Douglas Rd', '1410 SW 37 Ave', 'Menores Ave 40 units', '35-41 Menores Ave']);

    expect(result.imported.map((record) => record.property)).toEqual(['1410 SW 37 Ave', 'Menores Ave 40 units']);
    expect(result.missingGroupProperties).toEqual(['2550 S Douglas Rd', '35-41 Menores Ave']);
  });

  it('exports one row per property with one value column for every valuation method', () => {
    const workbook = buildMarketValueExportWorkbook([
      { property: '600 SW 9 AVE', marketValue: 4_250_000, asOf: '2026-07-18', valueType: 'Broker’s Opinion of Value', source: 'BOV', sourceKind: 'bov' },
      { property: '600 SW 9 AVE', marketValue: 4_150_000, asOf: '2026-05-31', valueType: 'Appraisal', source: 'Appraisal', sourceKind: 'appraisal', selected: true },
      { property: '930 SW 6th Street', marketValue: 3_680_000, asOf: '2026-06-30', valueType: 'Construction / Land Value Model', source: 'Land', sourceKind: 'construction-land' },
    ], ['600 SW 9 AVE Miami, FL 33130', '930 SW 6th Street']);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['Market Value']!, { header: 1, defval: '' });

    expect(rows[1]).toEqual(['Property', 'Selected Valuation', 'Selected Market Value', 'Broker’s Opinion of Value', 'City Assessed Value', 'Comparable Sales', 'Appraisal', 'Income Model', 'Construction / Land Value Model', 'Other / Legacy Value']);
    expect(rows).toContainEqual(['600 SW 9 AVE Miami, FL 33130', 'Appraisal', 4_150_000, 4_250_000, '', '', 4_150_000, '', '', '']);
    expect(rows).toContainEqual(['930 SW 6th Street', 'Construction / Land Value Model', 3_680_000, '', '', '', '', '', 3_680_000, '']);
  });
});
