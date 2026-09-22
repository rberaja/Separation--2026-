import { describe, expect, it } from 'vitest';
import { hydratePartitionState } from '../src/store/AppContext';

describe('Partition browser persistence', () => {
  it('restores editable Partition fields and UI state from a saved snapshot', () => {
    const restored = hydratePartitionState({
      properties: [{
        id: 8,
        name: '600 SW 9 Ave',
        assign: 'a',
        marketVal: 4_250_000,
        capex: 120_000,
        noi: 253_257,
        occupancyPct: 87.5,
        bidDiff: 45_000,
        loanBal: 1_618_302,
        loanRate: 3.25,
        amortPeriod: 30,
        ioYears: 0,
        loanTerm: 1.8,
        monthlyPmt: 7_796,
        remainingBasis: 1_925_778,
        depreciation: 114_046,
        zoning: 'T4-R',
        cert40yr: '2026',
        groupName: 'The 600-930',
        dataManaged: 'data',
      }],
      nextId: 9,
      partnerNames: { a: 'Victor', b: 'Roberto' },
      pctA: 40,
      discountRate: 6.5,
      cashEquiv: 250_000,
      depreciationYear: 2025,
      collapsedSelectionUnits: ['group:the-600-930'],
      sort: { key: 'eq', asc: false },
      theme: 'dark',
    });

    expect(restored.properties).toHaveLength(1);
    expect(restored.properties[0]).toMatchObject({ assign: 'a', bidDiff: 45_000, monthlyPmt: 7_796 });
    expect(restored.nextId).toBe(9);
    expect(restored.partnerNames).toEqual({ a: 'Victor', b: 'Roberto' });
    expect(restored.pctA).toBe(40);
    expect(restored.discountRate).toBe(6.5);
    expect(restored.cashEquiv).toBe(250_000);
    expect(restored.collapsedSelectionUnits).toEqual(['group:the-600-930']);
    expect(restored.sort).toEqual({ key: 'eq', asc: false });
  });

  it('falls back safely when a saved snapshot is missing the property list', () => {
    const restored = hydratePartitionState({ partnerNames: { a: 'Victor', b: 'Roberto' } });
    expect(restored.properties).toEqual([]);
    expect(restored.partnerNames).toEqual({ a: 'Partner A', b: 'Partner B' });
  });
});
