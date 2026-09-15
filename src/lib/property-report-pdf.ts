import * as XLSX from 'xlsx';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

type PositionedText = { x: number; y: number; width: number; text: string };

/**
 * Converts a text-based property-management PDF table to a temporary workbook.
 * The normal Excel importers then apply their familiar header aliases. Scanned
 * PDFs have no text layer and deliberately report a clear, actionable error.
 */
export async function reportPdfToWorkbook(file: File): Promise<ArrayBuffer> {
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const rows: string[][] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const content = await (await pdf.getPage(pageNumber)).getTextContent();
    const lines = new Map<number, PositionedText[]>();
    for (const item of content.items) {
      if (!('str' in item) || !('transform' in item)) continue;
      const text = item.str.trim(); if (!text) continue;
      const y = Math.round(item.transform[5]);
      lines.set(y, [...(lines.get(y) ?? []), { x: item.transform[4], y, width: 'width' in item ? Number(item.width) || 0 : 0, text }]);
    }
    for (const line of [...lines.values()]) {
      const cells: string[] = []; let current = ''; let previous: PositionedText | null = null;
      for (const item of line.sort((a, b) => a.x - b.x)) {
        const gap = previous ? item.x - (previous.x + previous.width) : 0;
        if (previous && gap > 14) { cells.push(current.trim()); current = item.text; }
        else current = `${current}${current ? ' ' : ''}${item.text}`;
        previous = item;
      }
      if (current.trim()) { cells.push(current.trim()); rows.push(cells); }
    }
  }
  if (!rows.length) throw new Error('This PDF has no readable text table. Export a text-based Excel or CSV report from the property-management software.');
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'PDF Report');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
