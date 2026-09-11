/**
 * Lazy entry point for the Excel module. SheetJS is ~900 kB minified, so it is
 * split into its own chunk and only fetched the first time it is needed.
 */
export const loadExcel = () => import('./excel');

export async function downloadTemplate(): Promise<void> {
  (await loadExcel()).downloadTemplate();
}
