import { describe, expect, it } from 'vitest';
import { createProperty } from '../src/lib/types';
import { initialState, reducer } from '../src/store/reducer';

describe('Data-managed Partition properties', () => {
  it('removes only cards supplied by Data Groups when Groups is cleared', () => {
    const manual = createProperty(1, { name: 'Manual property' });
    const fromData = createProperty(2, { name: 'Groups workbook property', dataManaged: 'data', groupName: 'Selection unit' });
    const state = { ...initialState, properties: [manual, fromData], nextId: 3 };

    expect(reducer(state, { type: 'properties/clearDataManaged' }).properties).toEqual([manual]);
  });
});
