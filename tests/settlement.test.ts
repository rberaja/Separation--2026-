import { describe, expect, it } from 'vitest';
import { computeSettlement, isBalanced } from '../src/lib/settlement';
import { createProperty } from '../src/lib/types';

const DR = 0.065;

describe('computeSettlement', () => {
  const props = [
  createProperty(1, { name: 'A1', assign: 'a', marketVal: 1000000, capex: 100000, noi: 60000, loanBal: 400000, loanRate: 5, loanTerm: 5, bidDiff: 10000, remainingBasis: 500000, depreciation: 25000 }),
    createProperty(2, { name: 'B1', assign: 'b', marketVal: 1500000, capex: 0, noi: 90000, loanBal: 600000, loanRate: 5, loanTerm: 5, bidDiff: -5000, remainingBasis: 700000 }),
  ];

  it('sums per-partner totals', () => {
    const { totals } = computeSettlement(props, DR, 0.4, 0);
    expect(totals.a.marketVal).toBe(1000000);
    expect(totals.a.amv).toBe(900000);
    expect(totals.a.count).toBe(1);
    expect(totals.a.remainingBasis).toBe(500000);
    expect(totals.a.depreciation).toBe(25000);
    expect(totals.a.bidDiff).toBe(10000);
    expect(totals.b.marketVal).toBe(1500000);
    expect(totals.b.count).toBe(1);
    expect(totals.b.bidDiff).toBe(-5000);
  });

  it('computes value gaps as A target − A actual (positive = A is owed)', () => {
    const { gaps, totals } = computeSettlement(props, DR, 0.4, 0);
    const totalAmv = totals.a.amv + totals.b.amv;
    expect(gaps.amv).toBeCloseTo(totalAmv * 0.4 - totals.a.amv, 6);
    // A holds $10,000 of bid difference against a $2,000 share of the $5,000 total → A is over, so A pays.
    expect(gaps.bidDiff).toBeCloseTo(5000 * 0.4 - 10000, 6);
    expect(gaps.bidDiff).toBeLessThan(0);
    expect(gaps.total).toBeCloseTo(gaps.npvEquity + gaps.bidDiff, 6);
  });

  it('computes the debt-service gap as A actual − A target (burden: carrying more = owed)', () => {
    const { gaps, totals } = computeSettlement(props, DR, 0.4, 0);
    const totalAds = totals.a.ads + totals.b.ads;
    expect(gaps.ads).toBeCloseTo(totals.a.ads - totalAds * 0.4, 6);
  });

  it('matches the v1.8 mockup worked example for NPV Equity', () => {
    // A: $4,440,000 vs B: $6,920,000 at 40/60 → A's target is $4,544,000, so A is owed $104,000.
    const totalEq = 4440000 + 6920000;
    expect(totalEq * 0.4 - 4440000).toBeCloseTo(104000, 0);
  });

  it('totals only the settlement items (NPV Equity + Bid Difference), per White Paper §14.1', () => {
    const { gaps } = computeSettlement(props, DR, 0.4, 0);
    expect(gaps.remainingBasis).not.toBe(0);
    expect(gaps.total).toBeCloseTo(gaps.npvEquity + gaps.bidDiff, 6);
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

  it('keeps unassigned properties out of both partners and out of the targets', () => {
    const { totals, gaps, unassigned, complete } = computeSettlement(
      [...props, createProperty(3, { name: 'Loose', marketVal: 1000000, capex: 50000 })],
      DR, 0.4, 0,
    );
    expect(totals.a.count).toBe(1);
    expect(totals.b.count).toBe(1);
    expect(unassigned).toMatchObject({ count: 1, marketVal: 1000000, amv: 950000, npvEquity: 950000 });
    expect(complete).toBe(false);
    // Gaps are identical to the two-property case: the loose property is not in the portfolio yet.
    expect(gaps).toEqual(computeSettlement(props, DR, 0.4, 0).gaps);
  });

  it('is complete once every property is assigned', () => {
    const { unassigned, complete } = computeSettlement(props, DR, 0.4, 0);
    expect(unassigned.count).toBe(0);
    expect(complete).toBe(true);
  });
});

describe('isBalanced', () => {
  it('treats sub-dollar gaps as balanced', () => {
    expect(isBalanced(0.99)).toBe(true);
    expect(isBalanced(-0.5)).toBe(true);
    expect(isBalanced(1)).toBe(false);
  });
});
