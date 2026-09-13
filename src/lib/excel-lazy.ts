/**
 * Lazy entry points for the SheetJS-backed modules. SheetJS is ~900 kB minified, so it is
 * only fetched when the user first uploads, downloads the template, or exports a report.
 */
import type { Report } from './report';

export const loadExcel = () => import('./excel');
export const loadReportExcel = () => import('./report-excel');

export async function downloadTemplate(): Promise<void> {
  (await loadExcel()).downloadTemplate();
}

export async function downloadReport(report: Report): Promise<void> {
  (await loadReportExcel()).downloadReport(report);
}
