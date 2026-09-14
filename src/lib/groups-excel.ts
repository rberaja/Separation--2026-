import * as XLSX from 'xlsx';

export type GroupMember = {
  property: string;
  entity: string;
  city: string;
  state: string;
  zip: string;
  units: string;
};

export type ImportedGroup = { name: string; members: GroupMember[] };
export type GroupsImportResult = { groups: ImportedGroup[]; individualProperties: GroupMember[] };

export class GroupsImportError extends Error {
  override name = 'GroupsImportError';
}

const headerKey = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const valueAt = (row: unknown[], index: number | undefined) => index === undefined ? '' : String(row[index] ?? '').trim();
const GROUP_HEADERS = ['#', 'Owners', 'Owner(s)', 'Group', 'Property', 'City', 'State', 'Zip', 'Units'];

function groupRows(groups: readonly ImportedGroup[], individualProperties: readonly GroupMember[]) {
  let rowNumber = 1;
  const propertyRow = (member: GroupMember, groupName = '') => [
    rowNumber++, member.entity, '', groupName, member.property, member.city, member.state, member.zip, member.units,
  ];
  return [
    ...groups.flatMap((group) => group.members.map((member) => propertyRow(member, group.name))),
    ...individualProperties.map((member) => propertyRow(member)),
  ];
}

export function buildGroupsTemplateWorkbook(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['GROUPED - Planned Separation Values'],
    GROUP_HEADERS,
    ...Array.from({ length: 20 }, () => Array(GROUP_HEADERS.length).fill('')),
  ]);
  sheet['!cols'] = [6, 18, 24, 30, 32, 18, 8, 10, 9].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Property Grouped');

  const instructions = XLSX.utils.aoa_to_sheet([
    ['Groups workbook instructions'],
    ['Enter one property per row in Property Grouped.'],
    ['Use the same Group name for properties that form one combined lot or economic package.'],
    ['Leave Group blank for an individual selection unit.'],
    ['Property is required. Owner, city, state, ZIP, and units are optional but recommended.'],
  ]);
  instructions['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions');
  return workbook;
}

export function downloadGroupsTemplate(): void {
  XLSX.writeFile(buildGroupsTemplateWorkbook(), 'Property Groups Template.xlsx');
}

export function downloadGroupsWorkbook(groups: readonly ImportedGroup[], individualProperties: readonly GroupMember[]): void {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['GROUPED - Planned Separation Values'],
    GROUP_HEADERS,
    ...groupRows(groups, individualProperties),
  ]);
  sheet['!cols'] = [6, 18, 24, 30, 32, 18, 8, 10, 9].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Property Grouped');
  XLSX.writeFile(workbook, 'Property Groups Export.xlsx');
}

/** Read the canonical grouping workbook. It accepts the supplied Group / Property layout and close header variants. */
export function parseGroupsWorkbook(data: ArrayBuffer): GroupsImportResult {
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
  const sheet = workbook.SheetNames[0] ? workbook.Sheets[workbook.SheetNames[0]] : undefined;
  const rows = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) : [];
  const headerRow = rows.findIndex((row) => {
    const headers = row.map(headerKey);
    return headers.includes('group') && headers.includes('property');
  });
  if (headerRow < 0) throw new GroupsImportError('Could not find both Group and Property columns in the workbook.');

  const headers = rows[headerRow]!.map(headerKey);
  const column = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const groupColumn = column('group', 'groupname', 'propertygroup');
  const propertyColumn = column('property', 'propertyname', 'address');
  const entityColumn = column('owner', 'owners', 'entity', 'ownername');
  const cityColumn = column('city');
  const stateColumn = column('state');
  const zipColumn = column('zip', 'zipcode');
  const unitsColumn = column('units', 'unit');
  if (groupColumn < 0 || propertyColumn < 0) throw new GroupsImportError('The workbook needs Group and Property columns.');

  const groups = new Map<string, ImportedGroup>();
  const individualProperties: GroupMember[] = [];
  for (const row of rows.slice(headerRow + 1)) {
    const property = valueAt(row, propertyColumn);
    if (!property) continue;
    const groupName = valueAt(row, groupColumn);
    const member: GroupMember = {
      property,
      entity: valueAt(row, entityColumn),
      city: valueAt(row, cityColumn),
      state: valueAt(row, stateColumn),
      zip: valueAt(row, zipColumn),
      units: valueAt(row, unitsColumn),
    };
    if (!groupName) { individualProperties.push(member); continue; }
    const existing = groups.get(groupName);
    if (existing) existing.members.push(member);
    else groups.set(groupName, { name: groupName, members: [member] });
  }
  if (!groups.size && individualProperties.length === 0) throw new GroupsImportError('No property rows were found in the workbook.');
  return { groups: [...groups.values()], individualProperties };
}
