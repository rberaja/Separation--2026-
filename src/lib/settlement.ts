/**
 * Portfolio-level aggregation: per-partner totals, proportionality gaps
 * and the settlement ledger.
 */
import { computeMetrics, nv } from './finance';
import type { Partner, Property } from './types';

export interface PartnerTotals {
  marketVal: number;
  capex: number;
  amv: number;
  loanBal: number;
  debtNpv: number;
  npvEquity: number;
  noi: number;
  ads: number;
  ncf: number;
  count: number;
  residualBasis: number;
  bidDiff: number;
}

/** Gap between Partner A's actual share and the proportional target. Positive = A is owed. */
export interface Gaps {
  npvEquity: number;
  amv: number;
  ads: number;
  ncf: number;
  bidDiff: number;
  /** Residual Tax Basis Shortfall in basis dollars — reference only; the Residual Basis True-Up ($) comes from the Residual Tax Basis Tool. */
  residualBasis: number;
  total: number;
}

export interface Settlement {
  totals: Record<Partner, PartnerTotals>;
  gaps: Gaps;
  /** Cash & equivalents split by ownership percentage. */
  cash: Record<Partner, number>;
}

const emptyTotals = (): PartnerTotals => ({
  marketVal: 0,
  capex: 0,
  amv: 0,
  loanBal: 0,
  debtNpv: 0,
  npvEquity: 0,
  noi: 0,
  ads: 0,
  ncf: 0,
  count: 0,
  residualBasis: 0,
  bidDiff: 0,
});

/**
 * Bucket a property into a partner's totals.
 * NOTE: mirrors v7.5 exactly — anything not assigned to A (including unassigned
 * properties) rolls into Partner B. Change to `p.assign` if unassigned
 * properties should be excluded from both partners.
 */
function bucketOf(p: Property): Partner {
  return p.assign === 'a' ? 'a' : 'b';
}

/**
 * @param discountRate annual market rate as a fraction (0.065)
 * @param pctA         Partner A's ownership share as a fraction (0.4)
 */
export function computeSettlement(
  properties: readonly Property[],
  discountRate: number,
  pctA: number,
  cashEquiv: number,
): Settlement {
  const totals: Record<Partner, PartnerTotals> = { a: emptyTotals(), b: emptyTotals() };

  for (const p of properties) {
    const m = computeMetrics(p, discountRate);
    const t = totals[bucketOf(p)];
    t.marketVal += nv(p.marketVal);
    t.capex += nv(p.capex);
    t.amv += m.amv;
    t.loanBal += nv(p.loanBal);
    t.debtNpv += m.debtNpv;
    t.npvEquity += m.npvEquity;
    t.noi += nv(p.noi);
    t.ads += m.ads;
    t.ncf += m.ncf;
    t.count += 1;
    t.residualBasis += nv(p.residualBasis);
    t.bidDiff += nv(p.bidDiff);
  }

  const { a, b } = totals;
  /**
   * Gaps are Partner A's; Partner B's are the negative. Sign convention (White Paper
   * v6.10 §14.1): positive = A is owed cash, negative = A pays.
   *  - Value metrics use target − actual: getting less than your share means you are owed.
   *  - Debt service is a burden, so it uses actual − target: carrying more than your
   *    share means you are owed.
   *
   * Only NPV Equity and Bid Difference feed `total` (plus the Residual Basis True-Up from
   * the Residual Tax Basis Tool and the cash split, neither of which is a gap here). Adj.
   * Market Value, Debt Service, Net Cash Flow and the basis shortfall are reference only.
   */
  const targetA = (key: keyof Omit<PartnerTotals, 'count'>): number => (a[key] + b[key]) * pctA;
  const shortfall = (key: keyof Omit<PartnerTotals, 'count'>): number => targetA(key) - a[key];
  const excessBurden = (key: keyof Omit<PartnerTotals, 'count'>): number => a[key] - targetA(key);
  const gaps: Gaps = {
    npvEquity: shortfall('npvEquity'),
    amv: shortfall('amv'),
    ads: excessBurden('ads'),
    ncf: shortfall('ncf'),
    bidDiff: shortfall('bidDiff'),
    residualBasis: shortfall('residualBasis'),
    total: 0,
  };
  gaps.total = gaps.npvEquity + gaps.bidDiff;

  return {
    totals,
    gaps,
    cash: { a: cashEquiv * pctA, b: cashEquiv * (1 - pctA) },
  };
}

/** A gap under $1 is treated as balanced. */
export const isBalanced = (gap: number): boolean => Math.abs(gap) < 1;
