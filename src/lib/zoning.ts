/** Ordered from the least to the most intensive zoning classification. */
const ZONING_PREFIXES = ['T3', 'T4', 'T5', 'T6', 'MF1', 'MF2', 'MX3'] as const;

function zoningRank(zoning: string): number | null {
  const normalized = zoning.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return null;
  const index = ZONING_PREFIXES.findIndex((prefix) => normalized.startsWith(prefix));
  // Keep an unfamiliar zoning classification after the defined sequence in
  // ascending order, while still sorting it consistently by its text label.
  return index < 0 ? ZONING_PREFIXES.length : index;
}

/** Compare zoning designations using the portfolio's intensity hierarchy. Blank values always follow known values. */
export function compareZoning(left: string, right: string, ascending: boolean): number {
  const leftRank = zoningRank(left);
  const rightRank = zoningRank(right);
  if (leftRank === null || rightRank === null) {
    if (leftRank === rightRank) return 0;
    return leftRank === null ? 1 : -1;
  }
  if (leftRank !== rightRank) return (leftRank - rightRank) * (ascending ? 1 : -1);
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }) * (ascending ? 1 : -1);
}

/** The highest applicable classification represents a grouped selection unit. */
export function highestZoning(zonings: readonly string[]): string {
  return zonings.filter((zoning) => zoning.trim()).sort((left, right) => compareZoning(left, right, true)).at(-1) ?? '';
}
