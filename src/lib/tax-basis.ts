/**
 * A tax-return asset listing commonly reports the basis before the current
 * tax year's deduction. The Partition Tool needs the year-end basis left.
 */
export function basisAfterTaxYearDeduction(basisBeforeDeduction: number, taxYearDeduction: number): number {
  return Math.max(0, basisBeforeDeduction - taxYearDeduction);
}
