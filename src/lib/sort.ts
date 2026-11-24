import { calcAMV, calcNCF, calcNPVEquity, nv } from './finance';
import type { Assignment, Property, SortKey, SortState } from './types';

export interface SortOption {
  key: SortKey;
  label: string;
  /** Direction used the first time this key is selected. */
  defaultAsc: boolean;
}

export const SORT_OPTIONS: readonly SortOption[] = [
  { key: 'name', label: 'Name', defaultAsc: true },
  { key: 'val', label: 'Asset Value', defaultAsc: false },
  { key: 'eq', label: 'NPV Equity', defaultAsc: false },
  { key: 'ncf', label: 'Net CF/yr', defaultAsc: false },
  { key: 'bid', label: 'Bid Diff', defaultAsc: false },
  { key: 'partner', label: 'Partner', defaultAsc: true },
];

/** Clicking the active key flips direction; a new key starts at its default direction. */
export function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key === key) return { key, asc: !current.asc };
  const opt = SORT_OPTIONS.find((o) => o.key === key);
  return { key, asc: opt?.defaultAsc ?? true };
}

function sortValue(p: Property, sort: SortState, discountRate: number): string | number {
  switch (sort.key) {
    case 'name':
      return p.name.toLowerCase();
    case 'val':
      return calcAMV(p);
    case 'eq':
      return calcNPVEquity(p, discountRate);
    case 'ncf':
      return calcNCF(p);
    case 'bid':
      return nv(p.bidDiff);
    case 'partner': {
      // Rank A before B; unassigned always lands last whichever direction is active.
      const rank = { a: 0, b: 1 } as const;
      return p.assign === 'none' ? (sort.asc ? 2 : -1) : rank[p.assign];
    }
  }
}

export function sortProperties(
  properties: readonly Property[],
  sort: SortState,
  discountRate: number,
): Property[] {
  const keyed = properties.map((p) => ({ p, v: sortValue(p, sort, discountRate) }));
  keyed.sort(({ v: av }, { v: bv }) => {
    const cmp =
      typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv)
        : Number(av) - Number(bv);
    return sort.asc ? cmp : -cmp;
  });
  return keyed.map(({ p }) => p);
}

/** A group or individual property as presented by the Partition workspace. */
export interface SelectionUnit {
  key: string;
  name: string;
  properties: readonly Property[];
  /** True when the unit represents a Group rather than one individual property. */
  grouped?: boolean;
}

function unitAssignment(properties: readonly Property[]): Assignment {
  const assignment = properties[0]?.assign ?? 'none';
  return properties.every((property) => property.assign === assignment) ? assignment : 'none';
}

function selectionUnitSortValue(unit: SelectionUnit, sort: SortState, discountRate: number): string | number {
  if (sort.key === 'name') return unit.name.toLowerCase();
  if (sort.key === 'partner') {
    const assignment = unitAssignment(unit.properties);
    const rank = { a: 0, b: 1 } as const;
    return assignment === 'none' ? (sort.asc ? 2 : -1) : rank[assignment];
  }
  return unit.properties.reduce((total, property) => {
    switch (sort.key) {
      case 'val': return total + calcAMV(property);
      case 'eq': return total + calcNPVEquity(property, discountRate);
      case 'ncf': return total + calcNCF(property);
      case 'bid': return total + nv(property.bidDiff);
      default: return total;
    }
  }, 0);
}

/** Sort the visible Partition cards by the values displayed on each selection unit. */
export function sortSelectionUnits(
  units: readonly SelectionUnit[],
  sort: SortState,
  discountRate: number,
): SelectionUnit[] {
  return [...units].sort((left, right) => {
    const leftValue = selectionUnitSortValue(left, sort, discountRate);
    const rightValue = selectionUnitSortValue(right, sort, discountRate);
    const cmp = typeof leftValue === 'string' && typeof rightValue === 'string'
      ? leftValue.localeCompare(rightValue)
      : Number(leftValue) - Number(rightValue);
    return sort.asc ? cmp : -cmp;
  });
}
