import type { ReactNode } from 'react';
import { fmtMoney } from '../lib/format';
import type { PartnerTotals } from '../lib/settlement';
import type { RefKey } from '../lib/glossary';
import { useOwnership, usePartnerNames, useSettlement } from '../store/AppContext';
import { Term } from './ui/Term';

interface MeterSpec {
  label: string;
  key: keyof PartnerTotals;
  /** Clamp negative totals to zero before drawing the bar. */
  floorZero: boolean;
  ref: RefKey;
}

const METERS: readonly MeterSpec[] = [
  { label: 'Adj. Market Value', key: 'amv', floorZero: true, ref: 'shareAmv' },
  { label: 'NPV Equity', key: 'npvEquity', floorZero: true, ref: 'shareNpvEquity' },
  { label: 'Debt Service', key: 'ads', floorZero: false, ref: 'shareAds' },
  { label: 'Net Cash Flow', key: 'ncf', floorZero: true, ref: 'shareNcf' },
  { label: 'Bid Difference', key: 'bidDiff', floorZero: true, ref: 'shareBidDiff' },
];

/** Side-by-side A/B share bars with a tick at the target ownership split. */
export function ProportionalityMeters() {
  const { totals } = useSettlement();
  const share = useOwnership();
  const names = usePartnerNames();
  const pctA = Math.round(share.a * 100);
  const pctB = Math.round(share.b * 100);

  return (
    <section className="card px-4 pt-3.5 pb-3">
      <div className="font-mono uppercase text-[0.77rem] tracking-[0.08em] text-muted font-bold mb-2">
        Proportionality vs. Target&nbsp;&nbsp;(Target split: {pctA} / {pctB})
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.7rem] text-muted2 font-bold mb-3.5">
        <LegendItem swatch="bg-a">{names.a} (actual share)</LegendItem>
        <LegendItem swatch="bg-b">{names.b} (actual share)</LegendItem>
        <LegendItem swatch="bg-ink w-[2px]"><Term term="targetSplit">Target split (tick)</Term></LegendItem>
      </div>

      {METERS.map(({ label, key, floorZero, ref }) => {
        const a = floorZero ? Math.max(0, totals.a[key]) : totals.a[key];
        const b = floorZero ? Math.max(0, totals.b[key]) : totals.b[key];
        const total = a + b;
        const shareA = total > 0 ? (a / total) * 100 : 0;
        const shareB = total > 0 ? (b / total) * 100 : 0;

        return (
          <div key={key} className="mb-[13px] last:mb-0">
            <div className="flex justify-between items-baseline mb-[5px]">
              <Term term={ref} className="font-mono text-[0.77rem] uppercase tracking-[0.04em] text-text font-bold">{label}</Term>
              <span className="font-mono text-[0.75rem] text-muted2 font-bold">
                {fmtMoney(a)} / {fmtMoney(b)}
              </span>
            </div>
            <div className="relative h-[6px] bg-border rounded-[3px]" role="img" aria-label={`${label}: A ${shareA.toFixed(0)}%, B ${shareB.toFixed(0)}%`}>
              <div className="absolute left-0 top-0 h-full bg-a rounded-l-[3px] transition-[width] duration-300" style={{ width: `${shareA}%` }} />
              <div className="absolute right-0 top-0 h-full bg-b rounded-r-[3px] transition-[width] duration-300" style={{ width: `${shareB}%` }} />
              <div className="absolute -top-[3px] -ml-px w-[2px] h-[12px] bg-ink transition-[left] duration-300" style={{ left: `${share.a * 100}%` }} />
            </div>
          </div>
        );
      })}

      <p className="font-serif italic text-[0.75rem] leading-snug text-muted2 mt-3.5">
        The tick marks the target split for each bar — {pctA}% for the {pctA}/{pctB} ownership stake. Orange fill is{' '}
        {names.a}&rsquo;s actual share of the bar; the blue remainder is {names.b}&rsquo;s. Where the orange edge lands
        relative to the tick shows the gap at a glance.
      </p>
    </section>
  );
}

function LegendItem({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-[9px] w-[9px] rounded-[1px] ${swatch}`} />
      {children}
    </span>
  );
}
