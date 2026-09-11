import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { COLUMNS, HEADER_TO_FIELD, normalizeHeader } from '../src/lib/columns';
import { ImportError, buildTemplateWorkbook, parseWorkbook } from '../src/lib/excel';

function toArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

function workbookFromRows(rows: Record<string, unknown>[], meta?: Record<string, unknown>[]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Properties');
  if (meta) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), '_meta');
  return toArrayBuffer(wb);
}

describe('columns', () => {
  it('maps every canonical key and alias to a field', () => {
    for (const c of COLUMNS) {
      expect(HEADER_TO_FIELD.get(c.key)).toBe(c.field);
      for (const alias of c.aliases) expect(HEADER_TO_FIELD.get(normalizeHeader(alias))).toBe(c.field);
    }
  });
  it('normalizes case and whitespace', () => {
    expect(normalizeHeader('  Market   Value ')).toBe('market value');
  });
});

describe('parseWorkbook', () => {
  it('round-trips the downloadable template', () => {
    const { properties, meta } = parseWorkbook(toArrayBuffer(buildTemplateWorkbook()));
    expect(properties).toHaveLength(4);
    expect(meta).toEqual({});
    expect(properties[0]).toMatchObject({
      name: '123 Main St',
      marketVal: 850000,
      capex: 35000,
      monthlyPmt: 1827.87,
      assign: 'a',
      bidDiff: 15000,
      zoning: 'RM-24',
      cert40yr: '2031',
    });
  });

  it('accepts header aliases and cleans currency / percent formatting', () => {
    const buf = workbookFromRows([
      { 'Property Name': 'Alias Test', 'Appraised Value': '$1,250,000', 'Interest Rate': '6.5 %', Partner: 'B' },
    ]);
    const { properties } = parseWorkbook(buf);
    expect(properties[0]).toMatchObject({ name: 'Alias Test', marketVal: 1250000, loanRate: 6.5, assign: 'b' });
  });

  it('defaults amort period to 30 and clears bid difference on unassigned rows', () => {
    const buf = workbookFromRows([{ name: 'X', market_value: 100, bid_difference: 500 }]);
    const [p] = parseWorkbook(buf).properties;
    expect(p).toMatchObject({ assign: 'none', amortPeriod: 30, bidDiff: null });
  });

  it('skips rows with neither a name nor a market value', () => {
    const buf = workbookFromRows([
      { name: 'Keep', market_value: 1 },
      { name: '', market_value: '' },
    ]);
    expect(parseWorkbook(buf).properties).toHaveLength(1);
  });

  it('reads partner settings from the _meta sheet', () => {
    const buf = workbookFromRows(
      [{ name: 'X', market_value: 1 }],
      [{ partner_a_name: 'Roberto', partner_b_name: 'Alex', partner_a_pct: 45, discount_rate: 7 }],
    );
    expect(parseWorkbook(buf).meta).toEqual({
      partnerAName: 'Roberto',
      partnerBName: 'Alex',
      partnerAPct: 45,
      discountRate: 7,
    });
  });

  it('rejects a sheet with no recognised columns', () => {
    expect(() => parseWorkbook(workbookFromRows([{ foo: 1, bar: 2 }]))).toThrow(ImportError);
  });

  it('rejects an empty sheet', () => {
    expect(() => parseWorkbook(workbookFromRows([]))).toThrow(/No data/);
  });
});

describe('buildTemplateWorkbook', () => {
  it('lists every column on the Instructions sheet', () => {
    const wb = buildTemplateWorkbook();
    expect(wb.SheetNames).toEqual(['Properties', 'Instructions']);
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Instructions']!, { header: 1 });
    const keys = new Set(rows.map((r) => r[0]));
    for (const c of COLUMNS) expect(keys.has(c.key)).toBe(true);
  });
});
