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

  it('returns a property to Unassigned when a selected partner is clicked again', () => {
    const assigned = createProperty(1, { name: 'Selected property', assign: 'a' });
    const state = { ...initialState, properties: [assigned], nextId: 2 };

    expect(reducer(state, { type: 'property/assign', id: assigned.id, partner: 'none' }).properties[0]?.assign).toBe('none');
  });

  it('unselects every Partner assignment without removing property data', () => {
    const assignedA = createProperty(1, { name: 'Partner A property', assign: 'a', marketVal: 100 });
    const assignedB = createProperty(2, { name: 'Partner B property', assign: 'b', marketVal: 200 });
    const unassigned = createProperty(3, { name: 'Unassigned property', marketVal: 300 });
    const state = { ...initialState, properties: [assignedA, assignedB, unassigned], nextId: 4 };

    const result = reducer(state, { type: 'properties/unassignAll' });

    expect(result.properties.map((property) => property.assign)).toEqual(['none', 'none', 'none']);
    expect(result.properties.map((property) => property.marketVal)).toEqual([100, 200, 300]);
  });

  it('assigns every property in a consolidated selection unit together', () => {
    const first = createProperty(1, { name: '600 SW 9 AVE', groupName: 'The 600-930' });
    const second = createProperty(2, { name: '930 SW 6th Street', groupName: 'The 600-930' });
    const state = { ...initialState, properties: [first, second], nextId: 3 };

    const assigned = reducer(state, { type: 'properties/assign', ids: [first.id, second.id], partner: 'b' });
    expect(assigned.properties.map((property) => property.assign)).toEqual(['b', 'b']);

    const unassigned = reducer(assigned, { type: 'properties/assign', ids: [first.id, second.id], partner: 'none' });
    expect(unassigned.properties.map((property) => property.assign)).toEqual(['none', 'none']);
  });

  it('keeps cash equivalents unchanged while selection-unit assignments change', () => {
    const property = createProperty(1, { name: 'Selection unit' });
    const withCash = reducer({ ...initialState, properties: [property], nextId: 2 }, { type: 'settings/cashEquiv', value: 250_000 });

    expect(reducer(withCash, { type: 'property/assign', id: property.id, partner: 'a' }).cashEquiv).toBe(250_000);
  });
});
