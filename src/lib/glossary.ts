/**
 * Glossary for the on-screen tooltips, parsed from the Field Reference so the
 * definitions users hover over are literally the document's text. Rows are
 * addressed by their `#` column, which the Field Reference keeps stable.
 */
import fieldReference from '../../docs/03_RE_Partition_Field_Reference.md?raw';

export interface GlossaryEntry {
  row: number;
  /** The Field column, e.g. "Market Value". */
  term: string;
  /** Reference name, e.g. "market_value" (markdown emphasis stripped). */
  ref: string;
  /** "Uploaded", "Calculated", "Tool input", … */
  source: string;
  /** Formula / Notes column, markdown stripped. */
  notes: string;
}

/** Strip the light markdown used inside table cells. */
function plain(cell: string): string {
  return cell
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/↑\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parse(md: string): ReadonlyMap<number, GlossaryEntry> {
  const map = new Map<number, GlossaryEntry>();
  for (const line of md.split(/\r?\n/)) {
    const m = /^\|\s*(\d+)\s*\|(.*)\|\s*$/.exec(line);
    if (!m) continue;
    const cells = m[2]!.split('|').map(plain);
    if (cells.length < 5) continue;
    const [term, ref, source, , notes] = cells;
    if (!term || !notes) continue; // e.g. the "BLANK" spacer row
    map.set(Number(m[1]), { row: Number(m[1]), term, ref: ref ?? '', source: source ?? '', notes });
  }
  return map;
}

export const GLOSSARY: ReadonlyMap<number, GlossaryEntry> = parse(fieldReference);

/** Field Reference version, from the document title ("… Field Reference V1.4"). */
export const FIELD_REFERENCE_VERSION = /Field Reference V([\d.]+)/.exec(fieldReference)?.[1] ?? '';

/**
 * Named handles for every term the UI shows, so components never carry raw row
 * numbers. `tests/glossary.test.ts` checks each one resolves to a real row.
 */
export const REF = {
  // Global
  name: 2,
  assign: 3,
  discountRate: 4,
  cashEquiv: 5,
  // Property card — inputs
  marketVal: 8,
  bidDiff: 9,
  capex: 10,
  noi: 11,
  occupancyPct: 12,
  loanBal: 14,
  loanRate: 15,
  amortPeriod: 16,
  ltv: 17,
  ioYears: 19,
  loanTerm: 20,
  monthlyPmt: 21,
  // Property card — current values
  amv: 23,
  debtNpv: 24,
  npvEquity: 25,
  ads: 26,
  ncf: 27,
  // Property card — tax & compliance
  cert40yr: 29,
  zoning: 30,
  remainingBasis: 31,
  depreciation: 33,
  // Partner totals
  totalMarketVal: 35,
  totalCapex: 36,
  totalAmv: 37,
  totalLoanBal: 38,
  totalDebtNpv: 39,
  totalNpvEquity: 40,
  totalNoi: 41,
  totalAds: 42,
  totalNcf: 43,
  totalCount: 44,
  totalRemainingBasis: 45,
  totalBidDiff: 46,
  // Proportionality meters
  shareAmv: 48,
  shareNpvEquity: 49,
  shareAds: 50,
  shareNcf: 51,
  shareBidDiff: 52,
  targetSplit: 53,
  // Gap analysis — reference
  gapAmv: 56,
  gapAds: 57,
  gapNcf: 58,
  basisShortfall: 59,
  // Gap analysis — settlement
  gapNpvEquity: 60,
  basisTrueUp: 61,
  gapBidDiff: 62,
  gapCash: 63,
  totalTrueUp: 64,
  finalSettlement: 65,
} as const;

export type RefKey = keyof typeof REF;
