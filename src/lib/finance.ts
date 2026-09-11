/**
 * Loan and property math. All functions are pure — the discount rate is
 * passed in explicitly rather than read from the UI.
 *
 * Rates are fractions inside this module (0.065), while `Property` fields
 * store percentages (6.5); each calc* function converts at its boundary.
 */
import type { LoanFields, Property } from './types';

/** Coerce a blank/nullable numeric field to a number (blank → 0). */
export function nv(v: number | null | undefined): number {
  return v === null || v === undefined || Number.isNaN(v) ? 0 : v;
}

/**
 * Monthly P+I payment on a fully-amortizing loan.
 * `amortPeriod` is the schedule length in years (e.g. 30) — it drives payment size only.
 */
export function amortPmt(balance: number, annualRate: number, amortPeriod: number): number {
  if (balance <= 0 || amortPeriod <= 0) return 0;
  if (annualRate === 0) return balance / (amortPeriod * 12);
  const r = annualRate / 12;
  const n = amortPeriod * 12;
  return (balance * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/** Outstanding balance after `yearsPaid` years of a known monthly payment. */
export function remainingBalanceFromPmt(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  yearsPaid: number,
): number {
  if (balance <= 0 || yearsPaid <= 0) return balance;
  if (annualRate === 0) return balance - monthlyPayment * yearsPaid * 12;
  const r = annualRate / 12;
  const n = Math.round(yearsPaid * 12);
  return balance * Math.pow(1 + r, n) - (monthlyPayment * (Math.pow(1 + r, n) - 1)) / r;
}

/** Present value of a level monthly annuity of `pmt` for `months` at monthly rate `mdr`. */
function pvAnnuity(pmt: number, months: number, mdr: number): number {
  if (months <= 0 || pmt <= 0) return 0;
  return mdr === 0 ? pmt * months : (pmt * (1 - Math.pow(1 + mdr, -months))) / mdr;
}

/**
 * Annual Debt Service — what the owner pays the lender this year.
 *   ioYears > 0  → currently in the IO period → interest only
 *   ioYears == 0 → P&I period → contractual payment if given, else computed on the amort schedule
 */
export function calcADS(p: LoanFields): number {
  const bal = nv(p.loanBal);
  const rate = nv(p.loanRate) / 100;
  const ioYears = nv(p.ioYears);
  const amortPer = nv(p.amortPeriod) || 30;
  const monthly = nv(p.monthlyPmt);
  if (bal <= 0) return 0;
  if (ioYears > 0) return bal * rate;
  if (monthly > 0) return monthly * 12;
  return amortPmt(bal, rate, amortPer) * 12;
}

/**
 * Debt NPV — PV of all cash obligations to the lender, discounted at the market rate:
 *   Phase 1: IO payments for ioYears
 *   Phase 2: P&I payments for (loanTerm − ioYears) years on the amort schedule
 *   Balloon: remaining balance at end of loanTerm
 *
 * @param discountRate annual market rate as a fraction (0.065 for 6.5%)
 */
export function calcDebtNPV(p: LoanFields, discountRate: number): number {
  const bal = nv(p.loanBal);
  const rate = nv(p.loanRate) / 100;
  const ioYears = nv(p.ioYears);
  const loanTerm = nv(p.loanTerm);
  const amortPer = nv(p.amortPeriod) || 30;

  if (bal <= 0) return 0;
  if (loanTerm <= 0 && ioYears <= 0) return bal; // no term info — fall back to face balance

  const mdr = discountRate / 12;
  const ioMonths = Math.round(ioYears * 12);
  const piYears = Math.max(0, loanTerm - ioYears);
  const piMonths = Math.round(piYears * 12);

  const pvIO = pvAnnuity((bal * rate) / 12, ioMonths, mdr);

  const monthly = nv(p.monthlyPmt);
  const pmt = monthly > 0 ? monthly : amortPmt(bal, rate, amortPer);
  // The P&I stream starts after the IO period, so discount it back through those months.
  const pvPI = pvAnnuity(pmt, piMonths, mdr) / Math.pow(1 + mdr, ioMonths);

  const balloon = remainingBalanceFromPmt(bal, rate, pmt, piYears);
  const pvBalloon = loanTerm > 0 ? balloon / Math.pow(1 + mdr, Math.round(loanTerm * 12)) : 0;

  return pvIO + pvPI + pvBalloon;
}

/** Adjusted (net) market value: market value − deferred CapEx. */
export function calcAMV(p: Pick<Property, 'marketVal' | 'capex'>): number {
  return nv(p.marketVal) - nv(p.capex);
}

/** Loan-to-value as a percentage; 0 when there is no market value. */
export function calcLTV(p: Pick<Property, 'marketVal' | 'loanBal'>): number {
  const mv = nv(p.marketVal);
  return mv <= 0 ? 0 : (nv(p.loanBal) / mv) * 100;
}

export function calcNPVEquity(p: Property, discountRate: number): number {
  return calcAMV(p) - calcDebtNPV(p, discountRate);
}

export function calcNCF(p: Property): number {
  return nv(p.noi) - calcADS(p);
}

export interface PropertyMetrics {
  amv: number;
  ltv: number;
  debtNpv: number;
  npvEquity: number;
  ads: number;
  ncf: number;
}

/** Every derived figure shown on a property card, computed once. */
export function computeMetrics(p: Property, discountRate: number): PropertyMetrics {
  const amv = calcAMV(p);
  const debtNpv = calcDebtNPV(p, discountRate);
  const ads = calcADS(p);
  return {
    amv,
    ltv: calcLTV(p),
    debtNpv,
    npvEquity: amv - debtNpv,
    ads,
    ncf: nv(p.noi) - ads,
  };
}
