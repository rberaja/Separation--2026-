/**
 * Display vocabulary shared by the on-screen cards, the Excel report and the
 * print report, so every output names a figure the same way.
 *
 * Tax-basis terms follow White Paper v6.10 §11 and §14.1: the per-property
 * input is the Remaining Tax Basis; step 1 of the adjustment is the Basis
 * Shortfall (basis dollars); step 2 is the Basis True-Up (cash), calculated in
 * the separate Tax Basis Tool.
 */
import type { RefKey } from './glossary';
import type { Gaps, PartnerTotals } from './settlement';

export const WHITE_PAPER_VERSION = '6.10';

export const TAX = {
  /** Per-property input: remaining depreciable basis in dollars (White Paper §10.1, §11.2). */
  remainingBasis: 'Remaining Tax Basis',
  /** Step 1 — (portfolio basis × ownership %) − partner's basis, in basis dollars (§11.3). */
  basisShortfall: 'Basis Shortfall',
  /** Step 2 — the shortfall converted to cash: PV of lost depreciation (§11.4, §14.1). */
  basisTrueUp: 'Basis True-Up',
  /** The separate web tool that performs step 2 (placeholder name until it is built). */
  tool: 'Tax Basis Tool',
} as const;

/** "Depreciation 2025" — the year is a setting supplied by the Tax Basis Tool. */
export const depreciationLabel = (year: number): string => `Depreciation ${year}`;

export interface TotalsRow {
  key: keyof PartnerTotals;
  label: string;
  /** Field Reference handle for the tooltip. */
  ref: RefKey;
}

/** Partner-totals rows, grouped as they appear on the Partner Totals cards. */
export const PARTNER_TOTAL_GROUPS: readonly (readonly TotalsRow[])[] = [
  [
    { key: 'marketVal', label: 'Market Value', ref: 'totalMarketVal' },
    { key: 'capex', label: 'Deferred CapEx', ref: 'totalCapex' },
    { key: 'amv', label: 'Adj. Market Value', ref: 'totalAmv' },
  ],
  [
    { key: 'loanBal', label: 'Loan Balance', ref: 'totalLoanBal' },
    { key: 'debtNpv', label: 'Debt NPV', ref: 'totalDebtNpv' },
    { key: 'npvEquity', label: 'NPV Equity', ref: 'totalNpvEquity' },
  ],
  [
    { key: 'noi', label: 'NOI / yr', ref: 'totalNoi' },
    { key: 'ads', label: 'Ann. Debt Service', ref: 'totalAds' },
    { key: 'ncf', label: 'Net Cash Flow / yr', ref: 'totalNcf' },
    { key: 'count', label: 'Properties', ref: 'totalCount' },
  ],
  [
    { key: 'remainingBasis', label: TAX.remainingBasis, ref: 'totalRemainingBasis' },
    { key: 'bidDiff', label: 'Bid Difference', ref: 'totalBidDiff' },
  ],
];

export interface GapRowSpec {
  key: keyof Omit<Gaps, 'total'>;
  label: string;
  ref: RefKey;
}

/** Gap Analysis — reference rows, shown but not part of the settlement (White Paper §14.1). */
export const GAP_REFERENCE_ROWS: readonly GapRowSpec[] = [
  { key: 'amv', label: 'Adj. Market Value', ref: 'gapAmv' },
  { key: 'ads', label: 'Debt Service', ref: 'gapAds' },
  { key: 'ncf', label: 'Net Cash Flow', ref: 'gapNcf' },
  { key: 'remainingBasis', label: TAX.basisShortfall, ref: 'basisShortfall' },
];

export const GAP_LABELS = {
  npvEquity: 'NPV Equity',
  basisTrueUp: TAX.basisTrueUp,
  bidDiff: 'Bid Difference',
  cash: 'Cash & Equivalents',
  total: 'Total True-Up',
  final: 'Final Settlement',
  referenceTitle: 'Reference only — not part of the settlement',
  settlementTitle: 'Metrics used for settlement',
} as const;
