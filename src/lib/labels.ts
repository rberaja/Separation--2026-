/**
 * Display vocabulary shared by the on-screen cards, the Excel report and the
 * print report, so every output names a figure the same way.
 *
 * Tax-basis terms follow the Residual Tax Basis Tool (the separate tool that
 * converts the basis shortfall into the Residual Basis True-Up cash figure).
 */
import type { Gaps, PartnerTotals } from './settlement';

export const WHITE_PAPER_VERSION = '6.10';

export const TAX = {
  /** Per-property input: remaining depreciable basis in dollars. */
  residualBasis: 'Residual Tax Basis',
  /** Step 1 — (portfolio basis × ownership %) − partner's basis, in basis dollars. */
  basisShortfall: 'Residual Tax Basis Shortfall',
  /** Step 2 — the shortfall converted to cash (PV of lost depreciation). */
  basisTrueUp: 'Residual Basis True-Up',
  /** The separate tool that performs step 2. */
  tool: 'Residual Tax Basis Tool',
  depreciation: 'Depreciation 2025',
} as const;

export interface TotalsRow {
  key: keyof PartnerTotals;
  label: string;
}

/** Partner-totals rows, grouped as they appear on the Partner Totals cards. */
export const PARTNER_TOTAL_GROUPS: readonly (readonly TotalsRow[])[] = [
  [
    { key: 'marketVal', label: 'Market Value' },
    { key: 'capex', label: 'Deferred CapEx' },
    { key: 'amv', label: 'Adj. Market Value' },
  ],
  [
    { key: 'loanBal', label: 'Loan Balance' },
    { key: 'debtNpv', label: 'Debt NPV' },
    { key: 'npvEquity', label: 'NPV Equity' },
  ],
  [
    { key: 'noi', label: 'NOI / yr' },
    { key: 'ads', label: 'Ann. Debt Service' },
    { key: 'ncf', label: 'Net Cash Flow / yr' },
    { key: 'count', label: 'Properties' },
  ],
  [
    { key: 'residualBasis', label: TAX.residualBasis },
    { key: 'bidDiff', label: 'Bid Difference' },
  ],
];

export interface GapRowSpec {
  key: keyof Omit<Gaps, 'total'>;
  label: string;
}

/** Gap Analysis — reference rows, shown but not part of the settlement (White Paper §14.1). */
export const GAP_REFERENCE_ROWS: readonly GapRowSpec[] = [
  { key: 'amv', label: 'Adj. Market Value' },
  { key: 'ads', label: 'Debt Service' },
  { key: 'ncf', label: 'Net Cash Flow' },
  { key: 'residualBasis', label: TAX.basisShortfall },
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
