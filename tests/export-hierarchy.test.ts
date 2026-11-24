import { describe, expect, it } from 'vitest';
import { groupExportRecords } from '../src/lib/export-hierarchy';

describe('groupExportRecords', () => {
  it('uses the Groups workbook order, nests group members, and leaves other properties as individuals', () => {
    const result = groupExportRecords([
      { property: 'Loose Property', amount: 1 },
      { property: '930 SW 6th Street', amount: 2 },
      { property: '600 SW 9th Avenue', amount: 3 },
    ], [{
      name: 'The 600-930',
      members: [{ property: '600 SW 9 AVE' }, { property: '930 SW 6th Street' }],
    }]);

    expect(result).toEqual([
      { group: 'The 600-930', record: { property: '600 SW 9th Avenue', amount: 3 } },
      { group: 'The 600-930', record: { property: '930 SW 6th Street', amount: 2 } },
      { group: '', record: { property: 'Loose Property', amount: 1 } },
    ]);
  });
});
