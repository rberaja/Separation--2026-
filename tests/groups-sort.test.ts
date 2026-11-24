import { describe, expect, it } from 'vitest';
import { sortGroupsDisplayUnits } from '../src/lib/groups-sort';

const member = (property: string, zoning: string) => ({ property, entity: '', city: '', state: '', zip: '', units: '', zoning, cert40yr: '' });

describe('Groups display sorting', () => {
  it('sorts grouped and individual selection units together by zoning', () => {
    const units = sortGroupsDisplayUnits([
      { id: 'high-group', name: 'High group', members: [member('Low member', 'T3-L'), member('High member', 'T6-8-O')] },
      { id: 'low-group', name: 'Low group', members: [member('T4 member', 'T4-R')] },
    ], [member('Individual T5', 'T5-L'), member('Individual MF2', 'MF2')], { key: 'zoning', asc: true });

    expect(units.map((unit) => unit.key)).toEqual(['group:low-group', 'property:Individual T5', 'group:high-group', 'property:Individual MF2']);
  });
});
