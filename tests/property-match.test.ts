import { describe, expect, it } from 'vitest';
import { propertyMatches } from '../src/lib/property-match';

describe('propertyMatches', () => {
  it('matches AppFolio address-order and abbreviated-name variants', () => {
    expect(propertyMatches('119-127 Antiquera Ave', 'Antiquera Ave 119-127')).toBe(true);
    expect(propertyMatches('119-123-127-130 Santillane Ave', 'Santillane - Santillane Ave Coral Gables, FL 33134')).toBe(true);
    expect(propertyMatches('Menores Ave 40 units', 'Menores 112533 - Menores Ave Coral Gables, FL 33134')).toBe(true);
  });

  it('does not group a different numbered address solely because the street name matches', () => {
    expect(propertyMatches('Menores Ave 40 units', '215 Menores Ave')).toBe(false);
  });
});
