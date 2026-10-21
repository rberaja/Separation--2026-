import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

if (typeof window !== 'undefined') GlobalWorkerOptions.workerSrc = workerUrl;

/** The tax return shows the recovery method; it does not by itself prove a formal cost-segregation study. */
export type ExtractedMethod = 'MACRS / accelerated' | 'Straight-line';

export interface ExtractedComponent {
  label: string;
  method: ExtractedMethod;
  basis: number;
  recoveryPeriod: string;
  yearsLeft: number;
  annual: number;
}

export interface ExtractedPropertySchedule {
  property: string;
  entity: string;
  source: string;
  /** File timestamp used to prefer the newest return when a property appears in more than one return. */
  sourceModifiedAt: number;
  schedules: ExtractedComponent[];
}

export interface ExtractionProgress {
  file: string;
  fileIndex: number;
  fileCount: number;
  page: number;
  pageCount: number;
}

export interface TaxReturnExtraction {
  schedules: ExtractedPropertySchedule[];
  sourceFiles: string[];
  taxYears: number[];
  warnings: string[];
}

type PositionedText = { x: number; y: number; text: string };
type ParsedAsset = ExtractedComponent & { key: string };

const numberFrom = (text: string) => {
  const match = text.replace(/\*/g, '').match(/[\d,]+(?:\.\d+)?/);
  return match ? Number(match[0].replace(/,/g, '')) : 0;
};

const estimateYearsLeft = (basis: number, annual: number, recoveryPeriod: string) => {
  if (!basis || !annual) return 0;
  const estimate = Math.ceil(basis / annual);
  const recoveryLife = numberFrom(recoveryPeriod);
  return recoveryLife ? Math.min(estimate, Math.ceil(recoveryLife)) : estimate;
};

const textAt = (row: PositionedText[], min: number, max: number) => row
  .filter((item) => item.x >= min && item.x < max)
  .sort((a, b) => a.x - b.x)
  .map((item) => item.text)
  .join(' ')
  .replace(/\s+/g, ' ')
  .trim();

const rowsFrom = (items: PositionedText[]) => {
  const rows = new Map<number, PositionedText[]>();
  for (const item of items) {
    const y = Math.round(item.y);
    rows.set(y, [...(rows.get(y) ?? []), item]);
  }
  return [...rows.entries()].map(([y, row]) => ({ y, row: row.sort((a, b) => a.x - b.x) }));
};

const cleanName = (text: string) => text.replace(/\s+/g, ' ').replace(/\s+PAGE\s+\d+.*$/i, '').trim();
const taxYearFrom = (text: string) => {
  const match = text.match(/(?:calendar|tax)\s+year\D{0,12}(20\d{2})|\b(20\d{2})\s+Form\s+1065\b/i);
  const year = Number(match?.[1] ?? match?.[2]);
  return year >= 2000 && year <= 2100 ? year : undefined;
};

function parseDepreciationPage(items: PositionedText[]): { property?: string; entity?: string; assets: ParsedAsset[] } {
  const rows = rowsFrom(items);
  const propertyRow = rows.find(({ row }) => textAt(row, 300, 680).includes('FORM 8825'));
  if (!propertyRow) return { assets: [] };

  const header = textAt(propertyRow.row, 300, 680);
  const property = cleanName(header.replace(/^.*FORM\s+8825\s*-\s*/i, ''));
  const entityRow = rows.find(({ y, row }) => {
    const text = textAt(row, 20, 230);
    return y <= propertyRow.y - 25 && y >= propertyRow.y - 60 && /^[A-Z0-9 .,&'-]+$/.test(text);
  });
  const entity = entityRow ? cleanName(textAt(entityRow.row, 20, 230)) : '';
  const assets: ParsedAsset[] = [];

  for (const { row } of rows) {
    const description = textAt(row, 25, 139);
    const dateText = textAt(row, 135, 180);
    const cost = numberFrom(textAt(row, 180, 240));
    const currentBasis = numberFrom(textAt(row, 430, 470));
    const lifeText = textAt(row, 470, 495);
    const methodText = textAt(row, 495, 535);
    const currentDepreciation = numberFrom(textAt(row, 625, 670));
    const accumulatedDepreciation = numberFrom(textAt(row, 670, 715));
    const adjustmentText = textAt(row, 325, 430);

    if (!/^\d/.test(description) || !/^\d{2}-\d{2}-\d{4}$/.test(dateText) || !cost || /\bLAND\b|\bNDA\b/i.test(`${description} ${lifeText}`)) continue;

    // Tax detail lists a post-bonus depreciable basis and accumulated depreciation.
    // Subtracting the bonus component from accumulated depreciation avoids deducting it twice.
    const bonusOr179 = /\bCY\b/i.test(adjustmentText) ? numberFrom(adjustmentText) : 0;
    const depreciableBasis = currentBasis || cost;
    const remainingBasis = Math.max(0, depreciableBasis - Math.max(0, accumulatedDepreciation - bonusOr179));
    const life = numberFrom(lifeText);
    const method: ExtractedMethod = /\bSL\b/i.test(methodText) ? 'Straight-line' : 'MACRS / accelerated';
    const annual = currentDepreciation + bonusOr179;
    if (!remainingBasis && !annual) continue;

    assets.push({
      key: `${life || 'other'}:${method}`,
      label: life ? `${life}-year ${method === 'Straight-line' ? 'straight-line' : 'accelerated'} property` : 'Other depreciable property',
      method,
      basis: remainingBasis,
      recoveryPeriod: life ? `${life} yrs` : 'See return',
      yearsLeft: estimateYearsLeft(remainingBasis, annual, life ? `${life} yrs` : 'See return'),
      annual,
    });
  }

  return { property, entity, assets };
}

/**
 * Drake Accounting's Federal Asset Report uses different headings and columns
 * from the older accountant's "Depreciation Detail Listing." Each report page
 * names one property, then lists its assets with original cost, prior
 * depreciation, current-year depreciation, recovery period, and method.
 */
function parseFederalAssetReportPage(items: PositionedText[]): { property?: string; entity?: string; assets: ParsedAsset[] } {
  const rows = rowsFrom(items);
  const reportIndex = rows.findIndex(({ row }) => textAt(row, 180, 380).includes('Federal Asset Report'));
  if (reportIndex < 0) return { assets: [] };

  const reportRow = rows[reportIndex];
  const propertyRow = rows
    .filter(({ y }) => y < reportRow.y && y >= reportRow.y - 35)
    .sort((left, right) => right.y - left.y)[0];
  const property = propertyRow ? cleanName(textAt(propertyRow.row, 180, 610)) : '';
  const entity = cleanName(textAt(reportRow.row, 0, 195));
  const assets: ParsedAsset[] = [];

  for (const { row } of rows) {
    const description = textAt(row, 30, 195);
    const inService = textAt(row, 195, 245);
    const cost = numberFrom(textAt(row, 245, 340));
    const recoveryLife = textAt(row, 408, 426);
    const methodText = textAt(row, 426, 480);
    const priorDepreciation = numberFrom(textAt(row, 480, 528));
    const currentDepreciation = numberFrom(textAt(row, 528, 590));

    if (!/^\d+$/.test(textAt(row, 10, 35)) || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(inService) || !cost || /\bLAND\b/i.test(`${description} ${methodText}`)) continue;

    const method: ExtractedMethod = /S\/?L/i.test(methodText) ? 'Straight-line' : 'MACRS / accelerated';
    const remainingBasis = Math.max(0, cost - priorDepreciation);
    if (!remainingBasis && !currentDepreciation) continue;

    assets.push({
      key: `${recoveryLife || 'other'}:${method}`,
      label: recoveryLife ? `${recoveryLife}-year ${method === 'Straight-line' ? 'straight-line' : 'accelerated'} property` : 'Other depreciable property',
      method,
      basis: remainingBasis,
      recoveryPeriod: recoveryLife ? `${recoveryLife} yrs` : 'See return',
      yearsLeft: estimateYearsLeft(remainingBasis, currentDepreciation, recoveryLife ? `${recoveryLife} yrs` : 'See return'),
      annual: currentDepreciation,
    });
  }

  return { property, entity, assets };
}

function combineAssets(assets: ParsedAsset[]): ExtractedComponent[] {
  const combined = new Map<string, ExtractedComponent>();
  for (const asset of assets) {
    const current = combined.get(asset.key);
    if (current) {
      current.basis += asset.basis;
      current.annual += asset.annual;
      current.yearsLeft = estimateYearsLeft(current.basis, current.annual, current.recoveryPeriod);
    } else {
      combined.set(asset.key, { ...asset });
    }
  }
  return [...combined.values()];
}

/** Extracts Form 8825 depreciation-detail pages from a text-based partnership return PDF. */
export async function extractTaxReturnSchedules(files: File[], onProgress?: (progress: ExtractionProgress) => void): Promise<TaxReturnExtraction> {
  // Process older files first. A later tax return replaces an earlier return for
  // the same property; multiple detail pages inside one return are still combined.
  const orderedFiles = files
    .map((file, index) => ({ file, index }))
    .sort((left, right) => (left.file.lastModified - right.file.lastModified) || (left.index - right.index));
  const schedules = new Map<string, { property: string; entity: string; source: string; sourceModifiedAt: number; assets: ParsedAsset[] }>();
  const taxYears = new Set<number>();
  const warnings: string[] = [];

  for (const [fileIndex, { file }] of orderedFiles.entries()) {
    const fileTaxYear = taxYearFrom(file.name);
    if (fileTaxYear) taxYears.add(fileTaxYear);
    const schedulesInFile = new Map<string, { property: string; entity: string; source: string; sourceModifiedAt: number; assets: ParsedAsset[] }>();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocument({ data }).promise;
    let detailPages = 0;
    let form4562Pages = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress?.({ file: file.name, fileIndex: fileIndex + 1, fileCount: files.length, page: pageNumber, pageCount: pdf.numPages });
      // Yield to the browser so the progress indicator can repaint between pages.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const items = textContent.items
        .filter((item): item is typeof item & { str: string; transform: number[] } => 'str' in item && 'transform' in item)
        .map((item) => ({ x: item.transform[4], y: item.transform[5], text: item.str }));
      const pageText = items.map((item) => item.text).join(' ');
      const pageTaxYear = taxYearFrom(pageText);
      if (pageTaxYear) taxYears.add(pageTaxYear);
      if (/Form\s*4562/i.test(pageText)) form4562Pages += 1;
      const isLegacyDetail = /Depreciation Detail Listing/i.test(pageText) && /FORM\s*8825/i.test(pageText);
      const isFederalAssetReport = /Federal Asset Report/i.test(pageText);
      if (!isLegacyDetail && !isFederalAssetReport) continue;

      detailPages += 1;
      const parsed = isFederalAssetReport ? parseFederalAssetReportPage(items) : parseDepreciationPage(items);
      if (!parsed.property || !parsed.assets.length) continue;
      // Property is the authoritative key for the Partition Tool. An entity can
      // change between filings, but the newer filing must still replace the old one.
      const key = parsed.property.toLocaleLowerCase();
      const existing = schedulesInFile.get(key) ?? {
        property: parsed.property,
        entity: parsed.entity ?? '',
        source: `${file.name}, p. ${pageNumber}`,
        sourceModifiedAt: file.lastModified,
        assets: [],
      };
      existing.assets.push(...parsed.assets);
      schedulesInFile.set(key, existing);
    }

    // Because files are ordered oldest to newest, this overwrites only the
    // older filing for a matching property.
    for (const [key, schedule] of schedulesInFile) schedules.set(key, schedule);

    // A filing copy carries Form 4562 summaries only; remaining basis per property needs the preparer's asset-level listing.
    if (!detailPages) warnings.push(form4562Pages
      ? `${file.name}: this copy has Form 4562 summaries but no property-level depreciation schedule. Ask the preparer for the client copy that includes an asset report or depreciation detail listing with cost, prior depreciation, and current-year deduction for each property.`
      : `${file.name}: no property-level depreciation schedule was found. If the PDF is a scanned image, request a text-based copy from the preparer.`);
  }

  return {
    sourceFiles: files.map((file) => file.name),
    schedules: [...schedules.values()].map((schedule) => ({ ...schedule, schedules: combineAssets(schedule.assets) })),
    taxYears: [...taxYears].sort((a, b) => a - b),
    warnings,
  };
}
