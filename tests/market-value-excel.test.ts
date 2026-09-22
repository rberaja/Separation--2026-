import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildMarketValueExportWorkbook, buildMarketValueTemplateWorkbook } from '../src/lib/market-value-excel';

describe('Market Value workbooks', () => {
  it('creates a distinct manual template for each uploaded valuation source', () => {
    const cityTemplate = buildMarketValueTemplateWorkbook('city-appraised');
    const rows = XLSX.utils.sheet_to_json<unknown[]>(cityTemplate.Sheets['Market Value']!, { header: 1, defval: '' });

    expect(rows[0]?.[0]).toBe('City Assessed Value Manual Import');
    expect(rows[1]).toEqual(['Property', 'Market Value', 'As Of', 'Value Type']);
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
