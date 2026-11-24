import { propertyMatches } from './property-match';

type GroupMember = { property: string };
type ExportGroup = { name: string; members: readonly GroupMember[] };

export type GroupedExportRecord<T> = { group: string; record: T };

/** Order records by the Groups workbook, retaining unmatched records as individual rows. */
export function groupExportRecords<T extends { property: string }>(records: readonly T[], groups: readonly ExportGroup[]): GroupedExportRecord<T>[] {
  const used = new Set<number>();
  const ordered: GroupedExportRecord<T>[] = [];
  for (const group of groups) {
    for (const member of group.members) {
      records.forEach((record, index) => {
        if (!used.has(index) && propertyMatches(member.property, record.property)) {
          ordered.push({ group: group.name, record });
          used.add(index);
        }
      });
    }
  }
  records.forEach((record, index) => {
    if (!used.has(index)) ordered.push({ group: '', record });
  });
  return ordered;
}
