/** Domain types shared across the app. */

export type Partner = 'a' | 'b';
export type Assignment = Partner | 'none';
export const PARTNERS = ['a', 'b'] as const satisfies readonly Partner[];

export interface Property {
  id: number;
  name: string;
  assign: Assignment;

  // Property
  marketVal: number | null;
  capex: number | null;
  noi: number | null;
  occupancyPct: number | null;
  /** Winning bid − market value; may be positive or negative. */
  bidDiff: number | null;

  // Loan
  loanBal: number | null;
  /** Annual interest rate as a percentage, e.g. 6.5 for 6.5%. */
  loanRate: number | null;
  /** Amortization schedule length in years — drives the P&I payment size. */
  amortPeriod: number | null;

  // Principal & Interest
  /** Remaining interest-only period in years. 0 = no IO period. */
  ioYears: number | null;
  /** Residual term: years until rate reset / balloon. */
  loanTerm: number | null;
  /** Contractual monthly P&I; overrides the computed payment when provided. */
  monthlyPmt: number | null;

  // Tax & compliance (display only; remainingBasis also feeds the Remaining Depreciation Tool)
  remainingBasis: number | null;
  /** Annual depreciation for the tax year in `AppState.depreciationYear`. */
  depreciation: number | null;
  zoning: string;
  cert40yr: string;
}

/** Keys of `Property` that hold a nullable number (everything editable in a number input). */
export type NumericField = {
  [K in keyof Property]: K extends 'id' ? never : Property[K] extends number | null ? K : never;
}[keyof Property];

/** Keys of `Property` that hold free text. */
export type TextField = {
  [K in keyof Property]: Property[K] extends string ? (K extends 'assign' ? never : K) : never;
}[keyof Property];

/** Partial property data, as produced by an import or an "add" action. */
export type PropertyInput = Partial<Omit<Property, 'id'>>;

/** The subset of fields the loan math needs. */
export type LoanFields = Pick<
  Property,
  'loanBal' | 'loanRate' | 'amortPeriod' | 'ioYears' | 'loanTerm' | 'monthlyPmt'
>;

export const DEFAULT_PROPERTY: Omit<Property, 'id'> = {
  name: '',
  assign: 'none',
  marketVal: null,
  capex: null,
  noi: null,
  occupancyPct: null,
  bidDiff: null,
  loanBal: null,
  loanRate: null,
  amortPeriod: 30,
  ioYears: 0,
  loanTerm: null,
  monthlyPmt: null,
  remainingBasis: null,
  depreciation: null,
  zoning: '',
  cert40yr: '',
};

export function createProperty(id: number, input: PropertyInput = {}): Property {
  const defined = Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  ) as PropertyInput;
  return { ...DEFAULT_PROPERTY, ...defined, id };
}

export type SortKey = 'name' | 'val' | 'eq' | 'ncf' | 'bid' | 'partner';
export interface SortState {
  key: SortKey;
  asc: boolean;
}

export type Theme = 'light' | 'dark';
