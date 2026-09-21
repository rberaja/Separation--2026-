/**
 * Report model — one normalised description of everything on screen, rendered
 * by both the Excel writer (`report-excel.ts`) and the print view
 * (`components/PrintReport.tsx`). Pure: no React, no DOM.
 */
import { COLUMNS } from './columns';
import { APP_VERSION } from './constants';
import { computeMetrics, nv, type PropertyMetrics } from './finance';
import { fmtMoney } from './format';
import { GAP_LABELS, GAP_REFERENCE_ROWS, PARTNER_TOTAL_GROUPS, TAX, WHITE_PAPER_VERSION, depreciationLabel } from './labels';
import { isBalanced, selectionUnitKey, type PartnerTotals, type Settlement } from './settlement';
import type { Assignment, Partner, Property } from './types';

export type CellKind = 'text' | 'money' | 'pct' | 'num';
export type CellValue = string | number | null;

export interface ReportColumn {
  /** Header written to Excel; for input columns this is the import key so the sheet reloads. */
  key: string;
  /** Human label used by the print view. */
  label: string;
  kind: CellKind;
}

const INPUT_LABELS: Partial<Record<keyof Property, string>> = {
  name: 'Property',
  assign: 'Partner',
  marketVal: 'Market Value',
  bidDiff: 'Bid Difference',
  capex: 'Deferred CapEx',
  noi: 'NOI / yr',
  occupancyPct: 'Occupancy %',
  loanBal: 'Loan Balance',
  loanRate: 'Rate %',
  amortPeriod: 'Amort. (yrs)',
  ioYears: 'IO (yrs)',
  loanTerm: 'Term (yrs)',
  monthlyPmt: 'Monthly P&I',
  cert40yr: 'Next 40-Yr Cert.',
  zoning: 'Zoning',
  remainingBasis: TAX.remainingBasis,
  // depreciation gets its year-stamped label in propertyInputColumns().
};

const INPUT_KINDS: Partial<Record<keyof Property, CellKind>> = {
  name: 'text',
  assign: 'text',
  zoning: 'text',
  cert40yr: 'text',
  occupancyPct: 'pct',
  loanRate: 'pct',
  amortPeriod: 'num',
  ioYears: 'num',
  loanTerm: 'num',
};

/** Import-format columns, so the Properties sheet round-trips through Upload Excel. */
export function propertyInputColumns(depreciationYear: number): ReportColumn[] {
  return COLUMNS.map((c) => ({
    key: c.key,
    label: c.field === 'depreciation' ? depreciationLabel(depreciationYear) : (INPUT_LABELS[c.field] ?? c.key),
    kind: INPUT_KINDS[c.field] ?? 'money',
  }));
}

/** Derived figures, appended after the inputs. Ignored on re-import. */
export const PROPERTY_CALC_COLUMNS: readonly (ReportColumn & { metric: keyof PropertyMetrics })[] = [
  { key: 'ltv', label: 'LTV', kind: 'pct', metric: 'ltv' },
  { key: 'adj_net_value', label: 'Adj. Net Value', kind: 'money', metric: 'amv' },
  { key: 'debt_npv', label: 'Debt NPV', kind: 'money', metric: 'debtNpv' },
  { key: 'npv_equity', label: 'NPV Equity', kind: 'money', metric: 'npvEquity' },
  { key: 'annual_debt_service', label: 'Annual Debt Service', kind: 'money', metric: 'ads' },
  { key: 'net_cash_flow', label: 'Net Cash Flow / yr', kind: 'money', metric: 'ncf' },
];

export interface ReportPropertyRow {
  id: number;
  name: string;
  assign: Assignment;
  /** Values keyed by column key, for every column in both column lists. */
  cells: Record<string, CellValue>;
}

export interface ReportTotalsRow {
  key: string;
  label: string;
  kind: CellKind;
  a: number;
  b: number;
  portfolio: number;
}

export interface ReportGapRow {
  key: string;
  label: string;
  /** Null when the figure comes from outside this tool (the Basis True-Up). */
  a: number | null;
  b: number | null;
  /** Amount of the metric still on unassigned properties; null where the row has no such figure. */
  u: number | null;
  /** Small annotation printed after the label. */
  note?: string;
  /** Plain dollar amounts (the cash split) rather than signed gaps. */
  unsigned?: boolean;
  grand?: boolean;
}

export interface Report {
  appVersion: string;
  whitePaperVersion: string;
  partnerNames: Record<Partner, string>;
  /** Ownership in whole percent. */
  pct: Record<Partner, number>;
  /** Market discount rate in percent (null when the input is blank). */
  discountRate: number | null;
  cashEquiv: number;
  depreciationYear: number;
  /** Property-schedule input columns (import format); calculated columns follow. */
  inputColumns: ReportColumn[];
  properties: ReportPropertyRow[];
  counts: Record<Assignment, number>;
  totals: ReportTotalsRow[];
  gaps: { reference: ReportGapRow[]; settlement: ReportGapRow[] };
  /** "Partner B pays Partner A $104,000" / "Balanced at 40 / 60 — no payment due". */
  finalSettlement: string;
  /** False while any property is unassigned; the verdict is then provisional. */
  complete: boolean;
  unassigned: PartnerTotals;
  notes: string[];
}

export interface ReportInput {
  properties: readonly Property[];
  settlement: Settlement;
  partnerNames: Record<Partner, string>;
  /** Partner A's ownership share as a fraction. */
  pctA: number;
  /** Market discount rate in percent. */
  discountRate: number | null;
  cashEquiv: number;
  depreciationYear: number;
}

export function splitLabel(pctA: number): string {
  return `${Math.round(pctA * 100)} / ${Math.round((1 - pctA) * 100)}`;
}

/** The one-line verdict shown in the ledger and on the report. */
export function settlementSentence(total: number, names: Record<Partner, string>, pctA: number): string {
  if (isBalanced(total)) return `Balanced at ${splitLabel(pctA)} — no payment due`;
  return total > 0
    ? `${names.b} pays ${names.a} ${fmtMoney(Math.abs(total))}`
    : `${names.a} pays ${names.b} ${fmtMoney(Math.abs(total))}`;
}

function propertyRow(p: Property, discountRate: number): ReportPropertyRow {
  const m = computeMetrics(p, discountRate);
  const cells: Record<string, CellValue> = {};
  for (const c of COLUMNS) {
    const v = p[c.field];
    cells[c.key] = c.field === 'assign' && v === 'none' ? '' : v;
  }
  for (const c of PROPERTY_CALC_COLUMNS) cells[c.key] = m[c.metric];
  return { id: p.id, name: p.name, assign: p.assign, cells };
}

export function buildReport(input: ReportInput): Report {
  const { properties, settlement, partnerNames, pctA, discountRate, cashEquiv, depreciationYear } = input;
  const { totals, gaps, cash, unassigned, complete } = settlement;
  const dr = nv(discountRate) / 100;
  const split = splitLabel(pctA);

  const countUnits: Record<Assignment, Set<string>> = { a: new Set(), b: new Set(), none: new Set() };
  for (const property of properties) countUnits[property.assign].add(selectionUnitKey(property));
  const counts: Record<Assignment, number> = { a: countUnits.a.size, b: countUnits.b.size, none: countUnits.none.size };

  const totalsRows: ReportTotalsRow[] = PARTNER_TOTAL_GROUPS.flat().map(({ key, label }) => ({
    key,
    label,
    kind: key === 'count' ? 'num' : 'money',
    a: totals.a[key],
    b: totals.b[key],
    portfolio: totals.a[key] + totals.b[key],
  }));

  const gap = (key: string, label: string, v: number, u: number | null, extra: Partial<ReportGapRow> = {}): ReportGapRow => ({
    key,
    label,
    a: v,
    b: -v,
    u,
    ...extra,
  });

  const reference = GAP_REFERENCE_ROWS.map(({ key, label }) => gap(key, label, gaps[key], unassigned[key]));
  const settlementRows: ReportGapRow[] = [
    gap('npvEquity', GAP_LABELS.npvEquity, gaps.npvEquity, unassigned.npvEquity),
    { key: 'basisTrueUp', label: GAP_LABELS.basisTrueUp, a: null, b: null, u: null, note: `from ${TAX.tool}` },
    gap('bidDiff', GAP_LABELS.bidDiff, gaps.bidDiff, unassigned.bidDiff),
    { key: 'cash', label: GAP_LABELS.cash, a: cash.a, b: cash.b, u: null, note: `split ${split}`, unsigned: true },
    gap('total', GAP_LABELS.total, gaps.total, null, { grand: true }),
  ];

  const notes = [
    `Gaps are each partner's proportional target minus actual (White Paper v${WHITE_PAPER_VERSION} §14.1): positive = under-allocated and owed cash; negative = over-allocated and pays. Every row nets to zero across the two partners.`,
    `Total True-Up = NPV Equity gap + ${TAX.basisTrueUp} + Bid Difference gap. The ${TAX.basisTrueUp} (present value of lost depreciation, White Paper §11.4) is calculated in the separate ${TAX.tool} from the ${TAX.basisShortfall} shown above (§11.3) and must be added to the Total True-Up before settlement.`,
    'Debt NPV is the present value of each loan’s remaining payments at the market discount rate; NPV Equity = Adj. Net Value − Debt NPV. Debt Service is a burden, so in that reference row carrying more than your share shows as positive.',
    'Adj. Market Value, Debt Service, Net Cash Flow and the Basis Shortfall are reference only (White Paper §9.1–9.2): debt can be re-set by refinancing after the split and cash flow is measured as NOI before loan payments.',
  ];
  if (!complete) {
    notes.unshift(
      `PROVISIONAL — ${unassigned.count} ${unassigned.count === 1 ? 'property is' : 'properties are'} not assigned to a partner (${fmtMoney(unassigned.npvEquity)} of NPV Equity). Unassigned properties belong to neither partner and are excluded from the totals and targets above. Assign every property before signing.`,
    );
  }

  return {
    appVersion: APP_VERSION,
    whitePaperVersion: WHITE_PAPER_VERSION,
    partnerNames,
    pct: { a: Math.round(pctA * 100), b: Math.round((1 - pctA) * 100) },
    discountRate,
    cashEquiv,
    depreciationYear,
    inputColumns: propertyInputColumns(depreciationYear),
    properties: properties.map((p) => propertyRow(p, dr)),
    counts,
    totals: totalsRows,
    gaps: { reference, settlement: settlementRows },
    finalSettlement: properties.length === 0 ? '' : settlementSentence(gaps.total, partnerNames, pctA),
    complete,
    unassigned,
    notes,
  };
}

/** `2026-09-13` — used in file names and the report header. */
export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function reportFileStem(d: Date): string {
  return `RE_Partition_Report_${isoDate(d)}`;
}
