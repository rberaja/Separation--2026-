import type { GroupMember } from './groups-excel';
import { compareZoning, highestZoning } from './zoning';

export type GroupsSortKey = 'name' | 'zoning' | 'cert40yr';
export type GroupsSort = { key: GroupsSortKey; asc: boolean };

export interface ImportedGroupSelection {
  id: string;
  name: string;
  members: GroupMember[];
}

export type GroupsDisplayUnit =
  | { kind: 'group'; key: string; value: string; group: ImportedGroupSelection }
  | { kind: 'individual'; key: string; value: string; member: GroupMember };

function lowestNonBlank(values: readonly string[]): string {
  return values.filter(Boolean).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))[0] ?? '';
}

function groupValue(group: ImportedGroupSelection, key: GroupsSortKey): string {
  if (key === 'name') return group.name;
  if (key === 'zoning') return highestZoning(group.members.map((member) => member.zoning));
  return lowestNonBlank(group.members.map((member) => member.cert40yr));
}

function individualValue(member: GroupMember, key: GroupsSortKey): string {
  return key === 'name' ? member.property : member[key];
}

/** Sort Groups and individual properties together, as one visible selection-unit list. */
export function sortGroupsDisplayUnits(groups: readonly ImportedGroupSelection[], individuals: readonly GroupMember[], sort: GroupsSort): GroupsDisplayUnit[] {
  const units: GroupsDisplayUnit[] = [
    ...groups.map((group) => ({ kind: 'group' as const, key: `group:${group.id}`, value: groupValue(group, sort.key), group })),
    ...individuals.map((member) => ({ kind: 'individual' as const, key: `property:${member.property}`, value: individualValue(member, sort.key), member })),
  ];
  return units.sort((left, right) => sort.key === 'zoning'
    ? compareZoning(left.value, right.value, sort.asc)
    : left.value.localeCompare(right.value, undefined, { numeric: sort.key === 'cert40yr', sensitivity: 'base' }) * (sort.asc ? 1 : -1));
}
