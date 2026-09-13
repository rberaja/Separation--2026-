/**
 * Single source of truth for the Excel import/export columns.
 * Drives the Column Guide modal, the header→field mapping on import,
 * and both sheets of the downloadable template.
 */
import type { Property } from './types';

export type ImportField = keyof Omit<Property, 'id'>;

export interface ColumnSpec {
  /** Canonical header written to the template. */
  key: string;
  field: ImportField;
  /** Short description shown in the Column Guide. */
  description: string;
  /** Notes column in the Column Guide. */
  notes: string;
  /** Longer description written to the template's Instructions sheet. */
  instruction: string;
  /** Alternative headers accepted on import (case-insensitive, whitespace-normalized). */
  aliases: readonly string[];
  /** Excel column width in characters. */
  width: number;
}

export const COLUMNS: readonly ColumnSpec[] = [
  // ── Identity ──
  {
    key: 'name', field: 'name', width: 24,
    description: 'Property name', notes: 'Required',
    instruction: 'Property name (required)',
    aliases: ['property', 'property name'],
  },
  {
    key: 'assign', field: 'assign', width: 8,
    description: 'Partner assignment', notes: '"a" or "b"',
    instruction: '"a" or "b" — which partner receives this property',
    aliases: ['assigned to', 'partner'],
  },
  // ── Property section (card order) ──
  {
    key: 'market_value', field: 'marketVal', width: 14,
    description: 'Appraised market value ($)', notes: 'Required',
    instruction: 'Appraised market value in dollars (required)',
    aliases: ['market value', 'value', 'appraised value'],
  },
  {
    key: 'bid_difference', field: 'bidDiff', width: 14,
    description: 'Winning bid − agreed market value ($)', notes: 'Only applies once assigned',
    instruction: 'Winning bid minus agreed market value ($) — only meaningful once a property is assigned',
    aliases: ['bid difference', 'bid diff'],
  },
  {
    key: 'deferred_capex', field: 'capex', width: 15,
    description: 'Deferred CapEx — deducted from market value ($)', notes: 'Optional',
    instruction: 'Deferred CapEx — deducted from market value for equity calc',
    aliases: ['deferred capex', 'capex', 'deferred cap ex'],
  },
  {
    key: 'noi', field: 'noi', width: 12,
    description: 'Net Operating Income / yr ($)', notes: 'Optional',
    instruction: 'Net Operating Income per year (before debt service)',
    aliases: ['noi / yr', 'noi/yr', 'net operating income'],
  },
  {
    key: 'occupancy_actual_pct', field: 'occupancyPct', width: 19,
    description: 'Occupancy Actual — current actual occupancy as a percentage', notes: 'e.g. 91.5 for 91.5%',
    instruction: 'Occupancy Actual — current actual occupancy as a percentage (e.g. 91.5 for 91.5%)',
    aliases: ['occupancy actual', 'occupancy_pct', 'occupancy', 'occupancy actual %'],
  },
  // ── Loan section ──
  {
    key: 'loan_balance', field: 'loanBal', width: 14,
    description: 'Outstanding loan principal ($)', notes: 'Optional',
    instruction: 'Outstanding loan principal',
    aliases: ['loan balance', 'balance'],
  },
  {
    key: 'loan_rate', field: 'loanRate', width: 12,
    description: 'Annual interest rate (%)', notes: 'e.g. 6.5 for 6.5%',
    instruction: 'Annual interest rate as a percentage (e.g. 6.5 for 6.5%)',
    aliases: ['loan rate', 'interest rate', 'rate'],
  },
  {
    key: 'amort_period', field: 'amortPeriod', width: 13,
    description: 'Amortization schedule (yrs) — drives P&I payment size', notes: 'Typically 30',
    instruction: 'Amortization schedule length in years — drives P&I payment size (typically 30)',
    aliases: ['amort period', 'amortization period', 'amort schedule'],
  },
  // ── Principal & Interest section ──
  {
    key: 'io_years', field: 'ioYears', width: 10,
    description: 'Remaining interest-only period (yrs)', notes: '0 = no IO',
    instruction: 'Remaining interest-only period in years (0 = no IO period)',
    aliases: ['io years', 'io period', 'interest only years'],
  },
  {
    key: 'loan_term', field: 'loanTerm', width: 11,
    description: 'Residual loan term — years until rate reset / balloon', notes: 'e.g. 5, 7, 10',
    instruction: 'Residual loan term: years until rate reset or balloon payment is due (e.g. 5, 7, 10)',
    aliases: ['loan term', 'residual_loan_term', 'residual loan term', 'term', 'years to balloon', 'years to reset', 'amort_years', 'amort years'],
  },
  {
    key: 'monthly_payment', field: 'monthlyPmt', width: 15,
    description: 'Contractual monthly P&I from bank statement ($)', notes: 'Overrides computed — recommended',
    instruction: 'Contractual monthly P&I from bank statement — overrides computed payment',
    aliases: ['monthly payment', 'monthly p&i', 'monthly p and i', 'p&i payment', 'monthly pmt'],
  },
  // ── Tax and Compliance row ──
  {
    key: 'next_40yr_certification', field: 'cert40yr', width: 22,
    description: 'Year next 40-yr recertification is due', notes: 'Display only',
    instruction: 'Year the next 40-yr recertification is due — display only',
    aliases: ['next 40yr certification', 'next 40-yr certification', '40 year certification', 'certification year'],
  },
  {
    key: 'zoning', field: 'zoning', width: 10,
    description: 'Zoning designation (e.g. RM-24)', notes: 'Display only',
    instruction: 'Zoning designation (e.g. RM-24) — display only',
    aliases: [],
  },
  {
    key: 'remaining_tax_basis', field: 'remainingBasis', width: 17,
    description: 'Remaining depreciable tax basis ($) — White Paper §11', notes: 'Optional — feeds the Tax Basis Tool',
    instruction: 'Remaining tax basis — remaining depreciable basis in dollars (White Paper §11); feeds the Tax Basis Tool',
    // remaining_basis was the v7.5 header; residual_* were used briefly in v8.0.
    aliases: ['remaining tax basis', 'remaining_basis', 'remaining basis', 'residual_tax_basis', 'residual tax basis', 'residual_basis', 'residual basis', 'tax basis'],
  },
  {
    key: 'depreciation', field: 'depreciation', width: 16,
    description: 'Annual depreciation expense for the depreciation year ($)', notes: 'Year set by the Tax Basis Tool (_meta depreciation_year)',
    instruction: 'Annual depreciation expense in dollars for the depreciation year (the year is read from the _meta sheet, depreciation_year)',
    aliases: ['depreciation_2025', 'depreciation 2025', 'annual depreciation'],
  },
];

/** Normalized header → field lookup, built once from COLUMNS. */
export const HEADER_TO_FIELD: ReadonlyMap<string, ImportField> = new Map(
  COLUMNS.flatMap((c) => [c.key, ...c.aliases].map((h) => [normalizeHeader(h), c.field] as const)),
);

export function normalizeHeader(h: unknown): string {
  return String(h ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Example rows for the template, in COLUMNS order. */
export const TEMPLATE_EXAMPLES: readonly (string | number)[][] = [
  ['123 Main St', 'a', 850000, 15000, 35000, 58000, 85, 420000, 3.25, 30, 0, 7, 1827.87, 2031, 'RM-24', 610000, 28000],
  ['Sunset Plaza', 'b', 1200000, -8000, 80000, 84000, 91.5, 680000, 6.75, 30, 0, 5, 3200, 2028, 'RM-24', 860000, 41000],
  ['Oak Valley Apts', 'b', 2100000, 0, 120000, 148000, 88, 1050000, 4.5, 30, 3, 10, 4500, 2033, 'RM-24', 1520000, 76000],
  ['Harbor View Office', 'a', 950000, 22000, 55000, 62000, 93, 310000, 7.1, 30, 0, 5, 1800, 2029, 'BU-1', 640000, 30000],
];

/** Optional `_meta` sheet columns that seed the header/partner settings on import. */
export const META_COLUMNS = {
  partnerAName: 'partner_a_name',
  partnerBName: 'partner_b_name',
  partnerAPct: 'partner_a_pct',
  discountRate: 'discount_rate',
  cashEquiv: 'cash_equivalents',
  /** Tax year the `depreciation` column refers to — written by the Tax Basis Tool. */
  depreciationYear: 'depreciation_year',
} as const;
