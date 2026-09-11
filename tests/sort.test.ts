import { describe, expect, it } from 'vitest';
import { nextSort, sortProperties } from '../src/lib/sort';
import { createProperty } from '../src/lib/types';

const props = [
  createProperty(1, { name: 'Charlie', assign: 'b', marketVal: 300 }),
  createProperty(2, { name: 'alpha', assign: 'none', marketVal: 100 }),
  createProperty(3, { name: 'Bravo', assign: 'a', marketVal: 200 }),
];
const names = (list: ReturnType<typeof sortProperties>) => list.map((p) => p.name);

describe('sortProperties', () => {
  it('sorts by name case-insensitively', () => {
    expect(names(sortProperties(props, { key: 'name', asc: true }, 0.065))).toEqual(['alpha', 'Bravo', 'Charlie']);
    expect(names(sortProperties(props, { key: 'name', asc: false }, 0.065))).toEqual(['Charlie', 'Bravo', 'alpha']);
  });

  it('sorts numerically by asset value', () => {
    expect(names(sortProperties(props, { key: 'val', asc: false }, 0.065))).toEqual(['Charlie', 'Bravo', 'alpha']);
  });

  it('keeps unassigned properties last in either partner direction', () => {
    expect(names(sortProperties(props, { key: 'partner', asc: true }, 0.065))).toEqual(['Bravo', 'Charlie', 'alpha']);
    expect(names(sortProperties(props, { key: 'partner', asc: false }, 0.065))).toEqual(['Charlie', 'Bravo', 'alpha']);
  });

  it('does not mutate the input', () => {
    const copy = [...props];
    sortProperties(props, { key: 'val', asc: true }, 0.065);
    expect(props).toEqual(copy);
  });
});

describe('nextSort', () => {
  it('flips direction when the same key is chosen again', () => {
    expect(nextSort({ key: 'name', asc: true }, 'name')).toEqual({ key: 'name', asc: false });
  });
  it('uses the default direction for a new key', () => {
    expect(nextSort({ key: 'name', asc: false }, 'val')).toEqual({ key: 'val', asc: false });
    expect(nextSort({ key: 'val', asc: false }, 'partner')).toEqual({ key: 'partner', asc: true });
  });
});
