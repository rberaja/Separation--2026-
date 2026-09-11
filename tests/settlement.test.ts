import { describe, expect, it } from 'vitest';
import { computeSettlement, isBalanced } from '../src/lib/settlement';
import { createProperty } from '../src/lib/types';

const DR = 0.065;

describe('computeSettlement', () => {
  const props = [
    createProperty(1, { name: 'A1', assign: 'a', marketVal: 1000000, capex: 100000, noi: 60000, loanBal: 400000, loanRate: 5, loanTerm: 5, bidDiff: 10000, remainingBasis: 500000 }),
    createProperty(2, { name: 'B1', assign: 'b', marketVal: 1500000, capex: 0, noi: 90000, loanBal: 600000, loanRate: 5, loanTerm: 5, bidDiff: -5000, remainingBasis: 700000 }),
  ];

  it('sums per-partner totals', () => {
    const { totals } = computeSettlement(props, DR, 0.4, 0);
    expect(totals.a.marketVal).toBe(1000000);
    expect(totals.a.amv).toBe(900000);
    expect(totals.a.count).toBe(1);
    expect(totals.a.remainingBasis).toBe(500000);
    expect(totals.a.bidDiff).toBe(10000);
    expect(totals.b.marketVal).toBe(1500000);
    expect(totals.b.count).toBe(1);
    expect(totals.b.bidDiff).toBe(-5000);
  });

  it('computes gaps as A actual − A target', () => {
    const { gaps, totals } = computeSettlement(props, DR, 0.4, 0);
    const totalAmv = totals.a.amv + totals.b.amv;
    expect(gaps.amv).toBeCloseTo(totals.a.amv - totalAmv * 0.4, 6);
    expect(gaps.bidDiff).toBeCloseTo(10000 - 5000 * 0.4, 6);
    expect(gaps.total).toBeCloseTo(gaps.npvEquity + gaps.amv + gaps.ads + gaps.ncf + gaps.bidDiff, 6);
  });

  it('splits cash & equivalents by ownership', () => {
    const { cash } = computeSettlement(props, DR, 0.4, 250000);
    expect(cash.a).toBe(100000);
    expect(cash.b).toBe(150000);
  });

  it('is balanced when shares exactly match the split', () => {
    const balanced = [
      createProperty(1, { assign: 'a', marketVal: 400000 }),
      createProperty(2, { assign: 'b', marketVal: 600000 }),
    ];
    const { gaps } = computeSettlement(balanced, DR, 0.4, 0);
    expect(isBalanced(gaps.total)).toBe(true);
  });

  it('rolls unassigned properties into Partner B (v7.5 behaviour)', () => {
    const { totals } = computeSettlement([createProperty(1, { marketVal: 100 })], DR, 0.4, 0);
    expect(totals.a.count).toBe(0);
    expect(totals.b.count).toBe(1);
  });
});

describe('isBalanced', () => {
  it('treats sub-dollar gaps as balanced', () => {
    expect(isBalanced(0.99)).toBe(true);
    expect(isBalanced(-0.5)).toBe(true);
    expect(isBalanced(1)).toBe(false);
  });
});
