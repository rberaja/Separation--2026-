export const DASH = '—';

/** Whole-dollar currency: -$1,234. Blank/NaN → em dash. */
export function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return DASH;
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString('en-US')}`;
}

/** Percentage with fixed decimals: 91.5%. Blank/NaN → em dash. */
export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return DASH;
  return `${v.toFixed(digits)}%`;
}

/** Free text, em dash when empty. */
export function fmtText(v: string | null | undefined): string {
  return v === null || v === undefined || v === '' ? DASH : v;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
