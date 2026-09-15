import * as XLSX from 'xlsx';

export type OccupancyRecord = {
  property: string;
  units: number;
  occupiedUnits: number;
  scheduledRent: number;
  asOf: string;
  /** Exact worksheet row used for this value; retained for audit and correction. */
  source?: string;
};

export class OccupancyImportError extends Error {
  override name = 'OccupancyImportError';
}

const key = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const text = (row: unknown[], column: number) => String(row[column] ?? '').trim();
const amount = (value: unknown) => Math.max(0, Number(String(value ?? '').replace(/[^0-9.-]/g, '')) || 0);

function columnFor(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.includes(header));
}

/** Accepts a property-level rent roll, as well as one row per unit when a Unit or Status column is present. */
export function parseOccupancyWorkbook(data: ArrayBuffer): OccupancyRecord[] {
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
  const sheet = workbook.SheetNames[0] ? workbook.Sheets[workbook.SheetNames[0]] : undefined;
  const rows = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) : [];
  const headerRow = rows.findIndex((row) => {
    const headers = row.map(key);
    return headers.some((header) => ['property', 'propertyname', 'address', 'building', 'asset'].includes(header));
  });
  if (headerRow < 0) throw new OccupancyImportError('Could not find a Property or Address column in the rent roll.');

  const headers = rows[headerRow]!.map(key);
  const propertyColumn = columnFor(headers, ['property', 'propertyname', 'address', 'building', 'asset']);
  const unitsColumn = columnFor(headers, ['units', 'totalunits', 'unitcount']);
  const occupiedColumn = columnFor(headers, ['occupiedunits', 'occupied', 'occupiedunitcount']);
  const rentColumn = columnFor(headers, ['scheduledrent', 'rent', 'monthlyrent', 'grosspotentialrent', 'gpr']);
  const unitColumn = columnFor(headers, ['unit', 'unitnumber', 'apt', 'apartment']);
  const statusColumn = columnFor(headers, ['status', 'occupancystatus']);
  const asOfColumn = columnFor(headers, ['asof', 'asofdate', 'reportdate', 'date']);
  if (propertyColumn < 0) throw new OccupancyImportError('The rent roll needs a Property or Address column.');

  const combined = new Map<string, OccupancyRecord>();
  for (const [rowIndex, row] of rows.slice(headerRow + 1).entries()) {
    const property = text(row, propertyColumn);
    if (!property) continue;
    const source = `${workbook.SheetNames[0] ?? 'Report'} row ${headerRow + rowIndex + 2}`;
    const existing = combined.get(property.toLowerCase()) ?? { property, units: 0, occupiedUnits: 0, scheduledRent: 0, asOf: '', source };
    const explicitUnits = unitsColumn >= 0 ? amount(row[unitsColumn]) : 0;
    const explicitOccupied = occupiedColumn >= 0 ? amount(row[occupiedColumn]) : 0;
    const isUnitRow = unitColumn >= 0 && Boolean(text(row, unitColumn));
    const status = statusColumn >= 0 ? text(row, statusColumn).toLowerCase() : '';
    const occupiedFromStatus = status && !/vacan|availab|offline|model/i.test(status) ? 1 : 0;
    existing.units += explicitUnits || (isUnitRow ? 1 : 0);
    existing.occupiedUnits += explicitOccupied || (isUnitRow ? occupiedFromStatus : 0);
    existing.scheduledRent += rentColumn >= 0 ? amount(row[rentColumn]) : 0;
    if (!existing.asOf && asOfColumn >= 0) existing.asOf = text(row, asOfColumn);
    existing.source = existing.source === source ? source : `${existing.source}; ${source}`;
    combined.set(property.toLowerCase(), existing);
  }
  const records = [...combined.values()];
  if (!records.length) throw new OccupancyImportError('No property rows were found in the rent roll.');
  return records;
}

export function buildOccupancyTemplateWorkbook(): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Rent Roll / Occupancy Import'],
    ['Property', 'Units', 'Occupied Units', 'Scheduled Rent', 'As Of'],
    ...Array.from({ length: 20 }, () => ['', '', '', '', '']),
  ]);
  sheet['!cols'] = [34, 12, 18, 18, 16].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Rent Roll');
  const instructions = XLSX.utils.aoa_to_sheet([
    ['Occupancy import instructions'],
    ['Use one row per property, or one row per unit with Property, Unit, Status, and Rent columns.'],
    ['Property is required and is matched to the Groups workbook using the property name or address.'],
  ]);
  instructions['!cols'] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions');
  return workbook;
}

export function downloadOccupancyTemplate() { XLSX.writeFile(buildOccupancyTemplateWorkbook(), 'Rent Roll Occupancy Template.xlsx'); }

export function downloadOccupancyWorkbook(records: readonly OccupancyRecord[]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Occupancy Export'],
    ['Property', 'Units', 'Occupied Units', 'Occupancy %', 'Scheduled Rent', 'As Of', 'Source'],
    ...records.map((record) => [record.property, record.units, record.occupiedUnits, record.units ? record.occupiedUnits / record.units : 0, record.scheduledRent, record.asOf, record.source ?? '']),
  ]);
  sheet['!cols'] = [34, 12, 18, 14, 18, 16, 28].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Occupancy');
  XLSX.writeFile(workbook, 'Occupancy Export.xlsx');
}
