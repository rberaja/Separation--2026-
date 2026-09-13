import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseWorkbook } from '../src/lib/excel';
import { TAX } from '../src/lib/labels';
import { PROPERTY_CALC_COLUMNS, buildReport, isoDate, reportFileStem, settlementSentence } from '../src/lib/report';
import { buildReportWorkbook } from '../src/lib/report-excel';
import { computeSettlement } from '../src/lib/settlement';
import { createProperty } from '../src/lib/types';

const names = { a: 'Roberto', b: 'Alex' };
const props = [
  createProperty(1, { name: 'A1', assign: 'a', marketVal: 1000000, capex: 100000, noi: 60000, loanBal: 400000, loanRate: 5, loanTerm: 5, bidDiff: 10000, remainingBasis: 500000, zoning: 'RM-24', cert40yr: '2031' }),
  createProperty(2, { name: 'B1', assign: 'b', marketVal: 1500000, capex: 0, noi: 90000, loanBal: 600000, loanRate: 5, loanTerm: 5, bidDiff: -5000, remainingBasis: 700000 }),
  createProperty(3, { name: 'Loose', assign: 'none', marketVal: 250000 }),
];

function report(cash = 250000) {
  const settlement = computeSettlement(props, 0.065, 0.4, cash);
  return buildReport({ properties: props, settlement, partnerNames: names, pctA: 0.4, discountRate: 6.5, cashEquiv: cash, depreciationYear: 2025 });
}

describe('buildReport', () => {
  it('carries settings, counts and one row per property with input + calculated cells', () => {
    const r = report();
    expect(r.pct).toEqual({ a: 40, b: 60 });
    expect(r.counts).toEqual({ a: 1, b: 1, none: 1 });
    expect(r.properties).toHaveLength(3);
    const row = r.properties[0]!;
    for (const c of [...r.inputColumns, ...PROPERTY_CALC_COLUMNS]) expect(row.cells).toHaveProperty(c.key);
    expect(row.cells['remaining_tax_basis']).toBe(500000);
    expect(r.inputColumns.find((c) => c.key === 'depreciation')!.label).toBe('Depreciation 2025');
    expect(row.cells['adj_net_value']).toBe(900000);
    expect(row.cells['npv_equity']).toBeCloseTo(900000 - (row.cells['debt_npv'] as number), 6);
    // Unassigned rows export a blank partner cell, not the literal "none".
    expect(r.properties[2]!.cells['assign']).toBe('');
  });

  it('mirrors the settlement: gap rows net to zero and the verdict matches the ledger', () => {
    const r = report();
    const settlement = computeSettlement(props, 0.065, 0.4, 250000);
    for (const g of [...r.gaps.reference, ...r.gaps.settlement]) {
      if (g.a !== null && g.b !== null && !g.unsigned) expect(g.a + g.b).toBeCloseTo(0, 6);
    }
    const total = r.gaps.settlement.find((g) => g.grand)!;
    expect(total.a).toBeCloseTo(settlement.gaps.total, 6);
    expect(r.finalSettlement).toBe(settlementSentence(settlement.gaps.total, names, 0.4));
    const cash = r.gaps.settlement.find((g) => g.key === 'cash')!;
    expect(cash).toMatchObject({ a: 100000, b: 150000, u: null, unsigned: true });
    // The Unassigned column carries the loose property's own figures, not a gap.
    expect(r.gaps.reference.find((g) => g.key === 'amv')!.u).toBe(250000);
    expect(r.gaps.settlement.find((g) => g.key === 'npvEquity')!.u).toBe(250000);
    expect(total.u).toBeNull();
  });

  it('leaves the Basis True-Up blank and names the tool that supplies it', () => {
    const row = report().gaps.settlement.find((g) => g.key === 'basisTrueUp')!;
    expect(row).toMatchObject({ label: TAX.basisTrueUp, a: null, b: null });
    expect(row.note).toContain(TAX.tool);
  });

  it('warns about unassigned properties and states the sign convention', () => {
    const notes = report().notes.join('\n');
    expect(notes).toMatch(/1 property is not assigned/);
    expect(notes).toMatch(/target minus actual/);
  });

  it('formats the file stem from the date', () => {
    const d = new Date(2026, 8, 13, 16, 5);
    expect(isoDate(d)).toBe('2026-09-13');
    expect(reportFileStem(d)).toBe('RE_Partition_Report_2026-09-13');
  });
});

describe('settlementSentence', () => {
  it('names the payer from the sign of Partner A’s total', () => {
    expect(settlementSentence(104000, names, 0.4)).toBe('Alex pays Roberto $104,000');
    expect(settlementSentence(-2500, names, 0.4)).toBe('Roberto pays Alex $2,500');
    expect(settlementSentence(0.4, names, 0.4)).toBe('Balanced at 40 / 60 — no payment due');
  });
});

describe('buildReportWorkbook', () => {
  const wb = buildReportWorkbook(report(), new Date(2026, 8, 13, 16, 5));

  it('puts Properties first so Upload Excel reads it, then Summary and _meta', () => {
    expect(wb.SheetNames).toEqual(['Properties', 'Summary', '_meta']);
  });

  it('round-trips through parseWorkbook, restoring every property and the settings', () => {
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const { properties, meta } = parseWorkbook(buf);
    expect(properties).toHaveLength(3);
    expect(properties[0]).toMatchObject({
      name: 'A1', assign: 'a', marketVal: 1000000, capex: 100000, noi: 60000, loanBal: 400000,
      loanRate: 5, loanTerm: 5, bidDiff: 10000, remainingBasis: 500000, zoning: 'RM-24', cert40yr: '2031',
    });
    expect(properties[2]).toMatchObject({ name: 'Loose', assign: 'none', marketVal: 250000 });
    expect(meta).toEqual({ partnerAName: 'Roberto', partnerBName: 'Alex', partnerAPct: 40, discountRate: 6.5, cashEquiv: 250000, depreciationYear: 2025 });
  });

  it('writes the final settlement and both partner names on the Summary sheet', () => {
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['Summary']!, { header: 1 });
    const flat = rows.flat().map(String);
    expect(flat).toContain('Final Settlement');
    expect(flat.some((v) => v.includes('pays'))).toBe(true);
    expect(flat).toContain(TAX.basisShortfall);
    expect(flat.some((v) => v.startsWith(TAX.basisTrueUp))).toBe(true);
  });
});
