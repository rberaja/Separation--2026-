import { describe, expect, it } from 'vitest';
import { amortPmt, calcADS, calcAMV, calcDebtNPV, calcLTV, calcNCF, calcNPVEquity, computeMetrics, nv } from '../src/lib/finance';
import { createProperty, type PropertyInput } from '../src/lib/types';
import legacy from './fixtures/legacy-finance.json';

/**
 * The same inputs used to generate `fixtures/legacy-finance.json` from the
 * v7.5 single-file tool (see fixtures/legacy-finance.generator.js). Blank
 * strings there are `null` here.
 */
const CASES: Record<string, PropertyInput> = {
  '123 Main St':      { marketVal: 850000,  capex: 35000,  noi: 58000,  monthlyPmt: 39833.9, loanBal: 420000,  loanRate: 3.25, amortPeriod: 30,   ioYears: 0, loanTerm: 7 },
  'Sunset Plaza':     { marketVal: 1200000, capex: 80000,  noi: 84000,  monthlyPmt: 3200,    loanBal: 680000,  loanRate: 6.75, amortPeriod: 30,   ioYears: 0, loanTerm: 5 },
  'Oak Valley':       { marketVal: 2100000, capex: 120000, noi: 148000, monthlyPmt: 4500,    loanBal: 1050000, loanRate: 4.5,  amortPeriod: 30,   ioYears: 3, loanTerm: 10 },
  'Harbor View':      { marketVal: 950000,  capex: 55000,  noi: 62000,  monthlyPmt: null,    loanBal: 310000,  loanRate: 7.1,  amortPeriod: 30,   ioYears: 0, loanTerm: 5 },
  'IO only, no term': { marketVal: 500000,  capex: null,   noi: 30000,  monthlyPmt: null,    loanBal: 200000,  loanRate: 5,    amortPeriod: null, ioYears: 2, loanTerm: null },
  'No loan':          { marketVal: 400000,  capex: 10000,  noi: 25000,  monthlyPmt: null,    loanBal: null,    loanRate: null, amortPeriod: 30,   ioYears: 0, loanTerm: null },
  'No term info':     { marketVal: 400000,  capex: 0,      noi: 25000,  monthlyPmt: null,    loanBal: 150000,  loanRate: 6,    amortPeriod: 30,   ioYears: 0, loanTerm: 0 },
  'Zero rate':        { marketVal: 600000,  capex: 0,      noi: 40000,  monthlyPmt: null,    loanBal: 240000,  loanRate: 0,    amortPeriod: 20,   ioYears: 1, loanTerm: 6 },
};

describe('parity with v7.5 single-file tool', () => {
  for (const fx of legacy) {
    it(`${fx.name} @ ${fx.dr * 100}%`, () => {
      const p = createProperty(1, CASES[fx.name]);
      expect(calcAMV(p)).toBeCloseTo(fx.amv, 6);
      expect(calcLTV(p)).toBeCloseTo(fx.ltv, 6);
      expect(calcADS(p)).toBeCloseTo(fx.ads, 6);
      expect(calcDebtNPV(p, fx.dr)).toBeCloseTo(fx.debtNpv, 6);
      expect(calcNPVEquity(p, fx.dr)).toBeCloseTo(fx.npvEquity, 6);
      expect(calcNCF(p)).toBeCloseTo(fx.ncf, 6);

      const m = computeMetrics(p, fx.dr);
      expect(m).toMatchObject({ amv: fx.amv, ltv: fx.ltv });
      expect(m.debtNpv).toBeCloseTo(fx.debtNpv, 6);
      expect(m.npvEquity).toBeCloseTo(fx.npvEquity, 6);
      expect(m.ads).toBeCloseTo(fx.ads, 6);
      expect(m.ncf).toBeCloseTo(fx.ncf, 6);
    });
  }
});

describe('nv', () => {
  it('coerces blanks to zero', () => {
    expect(nv(null)).toBe(0);
    expect(nv(undefined)).toBe(0);
    expect(nv(Number.NaN)).toBe(0);
    expect(nv(12.5)).toBe(12.5);
  });
});

describe('amortPmt', () => {
  it('matches the standard mortgage formula', () => {
    // $420,000 @ 3.25% / 30 yrs ≈ $1,827.87 per month
    expect(amortPmt(420000, 0.0325, 30)).toBeCloseTo(1827.87, 2);
  });
  it('is a straight-line split at 0% interest', () => {
    expect(amortPmt(120000, 0, 10)).toBe(1000);
  });
  it('returns 0 for a non-positive balance or period', () => {
    expect(amortPmt(0, 0.05, 30)).toBe(0);
    expect(amortPmt(1000, 0.05, 0)).toBe(0);
  });
});

describe('calcDebtNPV', () => {
  const loan = createProperty(1, { loanBal: 500000, loanRate: 6.5, amortPeriod: 30, ioYears: 0, loanTerm: 10 });

  it('equals the face balance when discounted at the note rate', () => {
    // Discounting a loan's own cash flows at its own rate recovers the principal.
    expect(calcDebtNPV(loan, 0.065)).toBeCloseTo(500000, 0);
  });
  it('is below face for a below-market note', () => {
    expect(calcDebtNPV(loan, 0.09)).toBeLessThan(500000);
  });
  it('is above face for an above-market note', () => {
    expect(calcDebtNPV(loan, 0.04)).toBeGreaterThan(500000);
  });
  it('falls back to face balance without any term information', () => {
    expect(calcDebtNPV(createProperty(1, { loanBal: 100, loanTerm: 0, ioYears: 0 }), 0.065)).toBe(100);
  });
});
