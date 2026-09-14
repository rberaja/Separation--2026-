import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

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
  const schedules = new Map<string, { property: string; entity: string; source: string; assets: ParsedAsset[] }>();
  const warnings: string[] = [];

  for (const [fileIndex, file] of files.entries()) {
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
      if (/Form\s*4562/i.test(pageText)) form4562Pages += 1;
      if (!/Depreciation Detail Listing/i.test(pageText) || !/FORM\s*8825/i.test(pageText)) continue;

      detailPages += 1;
      const parsed = parseDepreciationPage(items);
      if (!parsed.property || !parsed.assets.length) continue;
      const key = `${parsed.entity}|${parsed.property}`.toLocaleLowerCase();
      const existing = schedules.get(key) ?? { property: parsed.property, entity: parsed.entity ?? '', source: `${file.name}, p. ${pageNumber}`, assets: [] };
      existing.assets.push(...parsed.assets);
      schedules.set(key, existing);
    }

    // A filing copy carries Form 4562 summaries only; remaining basis per property needs the preparer's asset-level listing.
    if (!detailPages) warnings.push(form4562Pages
      ? `${file.name}: this copy has Form 4562 summaries but no "Depreciation Detail Listing" pages, so remaining basis per property cannot be read. Ask the preparer for the client copy that includes the depreciation detail listings (asset-by-asset cost, prior depreciation, and current-year deduction).`
      : `${file.name}: no Form 8825 "Depreciation Detail Listing" pages were found. If the PDF is a scanned image, request a text-based copy from the preparer.`);
  }

  return {
    sourceFiles: files.map((file) => file.name),
    schedules: [...schedules.values()].map((schedule) => ({ ...schedule, schedules: combineAssets(schedule.assets) })),
    warnings,
  };
}
