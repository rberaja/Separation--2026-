import { describe, expect, it } from 'vitest';
import { basisAfterTaxYearDeduction } from '../src/lib/tax-basis';

describe('basisAfterTaxYearDeduction', () => {
  it('subtracts the current tax-year deduction from the basis left', () => {
    expect(basisAfterTaxYearDeduction(500_000, 25_000)).toBe(475_000);
  });

  it('never reports a negative remaining tax basis', () => {
    expect(basisAfterTaxYearDeduction(10_000, 12_000)).toBe(0);
  });
});
