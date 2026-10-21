/**
 * Portfolio-level aggregation: per-partner totals, proportionality gaps
 * and the settlement ledger.
 */
import { computeMetrics, nv } from './finance';
import type { Assignment, Partner, Property } from './types';

/** A consolidated group is one selection unit; an ungrouped property is its own unit. */
export function selectionUnitKey(property: Property): string {
  const group = property.groupName.trim();
  return group ? `group:${group}` : `property:${property.id}`;
}

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
  remainingBasis: number;
  depreciation: number;
  bidDiff: number;
}

/** Gap between Partner A's actual share and the proportional target. Positive = A is owed. */
export interface Gaps {
  npvEquity: number;
  amv: number;
  ads: number;
  ncf: number;
  bidDiff: number;
  /** Cash allocation target minus cash allocated. Zero when cash is split by ownership. */
  cash: number;
  /** Basis Shortfall in basis dollars (White Paper §11.3) — reference only; the Basis True-Up ($) comes from the Remaining Depreciation Tool. */
  remainingBasis: number;
  total: number;
}

export interface Settlement {
  totals: Record<Partner, PartnerTotals>;
  gaps: Gaps;
  /** Cash & equivalents split by ownership percentage. */
  cash: Record<Partner, number>;
  /** How the shared cash account funds the property true-up before any outside payment is due. */
  cashSettlement: {
    applied: number;
    /** Signed like `gaps.total`: positive = B pays A; negative = A pays B. */
    remaining: number;
    /** Each partner's cash distribution after the true-up is funded from the shared account. */
    distribution: Record<Partner, number>;
  };
  /** Properties not yet assigned to either partner — outside the split until they are. */
  unassigned: PartnerTotals;
  /** True while every property is assigned; otherwise the settlement is provisional. */
  complete: boolean;
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
  remainingBasis: 0,
  depreciation: 0,
  bidDiff: 0,
});

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
  // An unassigned property belongs to neither partner (v7.5 silently gave it to B); it is
  // tallied separately and left out of the portfolio the targets are taken from.
  const unassigned = emptyTotals();
  const units: Record<Assignment, Set<string>> = { a: new Set(), b: new Set(), none: new Set() };

  for (const p of properties) {
    const m = computeMetrics(p, discountRate);
    const t = p.assign === 'none' ? unassigned : totals[p.assign];
    t.marketVal += nv(p.marketVal);
    t.capex += nv(p.capex);
    t.amv += m.amv;
    t.loanBal += nv(p.loanBal);
    t.debtNpv += m.debtNpv;
    t.npvEquity += m.npvEquity;
    t.noi += nv(p.noi);
    t.ads += m.ads;
    t.ncf += m.ncf;
    units[p.assign].add(selectionUnitKey(p));
    t.remainingBasis += nv(p.remainingBasis);
    t.depreciation += nv(p.depreciation);
    t.bidDiff += nv(p.bidDiff);
  }

  const { a, b } = totals;
  a.count = units.a.size;
  b.count = units.b.size;
  unassigned.count = units.none.size;
  /**
   * Gaps are Partner A's; Partner B's are the negative. Sign convention (White Paper
   * v6.10 §14.1): positive = A is owed cash, negative = A pays.
   *  - Value metrics use target − actual: getting less than your share means you are owed.
   *  - Debt service is a burden, so it uses actual − target: carrying more than your
   *    share means you are owed.
   *
   * Only NPV Equity and Bid Difference feed `total` (plus the Basis True-Up from the
   * Remaining Depreciation Tool and the cash split, neither of which is a gap here). Adj. Market
   * Value, Debt Service, Net Cash Flow and the Basis Shortfall are reference only.
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
    // Cash is allocated directly by ownership below, so this is normally zero. Keeping
    // the explicit term makes Total True-Up agree with the settlement ledger.
    cash: cashEquiv * pctA - cashEquiv * pctA,
    remainingBasis: shortfall('remainingBasis'),
    total: 0,
  };
  gaps.total = gaps.npvEquity + gaps.bidDiff + gaps.cash;

  const cash = { a: cashEquiv * pctA, b: cashEquiv * (1 - pctA) };
  const payer: Partner = gaps.total > 0 ? 'b' : 'a';
  const applied = isBalanced(gaps.total) ? 0 : Math.min(Math.abs(gaps.total), cash[payer]);
  const direction = Math.sign(gaps.total);
  const remaining = gaps.total - direction * applied;
  const distribution = {
    a: cash.a + (payer === 'a' ? -applied : applied),
    b: cash.b + (payer === 'b' ? -applied : applied),
  };

  return {
    totals,
    gaps,
    cash,
    cashSettlement: { applied, remaining, distribution },
    unassigned,
    complete: unassigned.count === 0,
  };
}

/** A gap under $1 is treated as balanced. */
export const isBalanced = (gap: number): boolean => Math.abs(gap) < 1;
