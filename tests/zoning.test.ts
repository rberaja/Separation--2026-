import { describe, expect, it } from 'vitest';
import { compareZoning, highestZoning } from '../src/lib/zoning';

describe('zoning hierarchy', () => {
  it('sorts zoning from T3 through MX3 by intensity rather than alphabetically', () => {
    const zonings = ['MX3', 'T6-8-O', 'MF-2', 'T5-L', 'T3-L', 'MF1', 'T4-R'];
    expect(zonings.sort((left, right) => compareZoning(left, right, true))).toEqual(['T3-L', 'T4-R', 'T5-L', 'T6-8-O', 'MF1', 'MF-2', 'MX3']);
  });

  it('uses the highest zoning classification for a group', () => {
    expect(highestZoning(['T3-L', 'T6-8-O', 'MF1', ''])).toBe('MF1');
  });

  it('keeps blank zoning values last in either direction', () => {
    expect(['', 'T4-R', 'T6-8-O'].sort((left, right) => compareZoning(left, right, false))).toEqual(['T6-8-O', 'T4-R', '']);
  });
});
