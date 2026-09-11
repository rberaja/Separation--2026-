import { fmtMoney } from '../lib/format';
import type { PartnerTotals } from '../lib/settlement';
import { useOwnership, useSettlement } from '../store/AppContext';

interface MeterSpec {
  label: string;
  key: keyof PartnerTotals;
  /** Clamp negative totals to zero before drawing the bar. */
  floorZero: boolean;
}

const METERS: readonly MeterSpec[] = [
  { label: 'Adj. Market Value', key: 'amv', floorZero: true },
  { label: 'NPV Equity', key: 'npvEquity', floorZero: true },
  { label: 'Debt Service', key: 'ads', floorZero: false },
  { label: 'Net Cash Flow', key: 'ncf', floorZero: true },
  { label: 'Bid Difference', key: 'bidDiff', floorZero: true },
];

/** Side-by-side A/B share bars with a tick at the target ownership split. */
export function ProportionalityMeters() {
  const { totals } = useSettlement();
  const share = useOwnership();

  return (
    <section className="card p-[13px]">
      <div className="caption text-[0.58rem] tracking-[0.12em] font-bold mb-[11px]">Proportionality vs. Target ▮</div>

      {METERS.map(({ label, key, floorZero }) => {
        const a = floorZero ? Math.max(0, totals.a[key]) : totals.a[key];
        const b = floorZero ? Math.max(0, totals.b[key]) : totals.b[key];
        const total = a + b;
        const pctA = total > 0 ? (a / total) * 100 : 0;
        const pctB = total > 0 ? (b / total) * 100 : 0;

        return (
          <div key={key} className="mb-[9px] last:mb-0">
            <div className="flex justify-between mb-[3px]">
              <span className="font-mono text-[0.59rem] uppercase tracking-[0.06em] text-text2 font-bold">{label}</span>
              <span className="font-mono text-[0.59rem] text-muted">
                {fmtMoney(a)} / {fmtMoney(b)}
              </span>
            </div>
            <div className="relative h-[7px] bg-border rounded-[3px]" role="img" aria-label={`${label}: A ${pctA.toFixed(0)}%, B ${pctB.toFixed(0)}%`}>
              <div className="absolute left-0 top-0 h-full bg-a rounded-l-[3px] transition-[width] duration-300" style={{ width: `${pctA}%` }} />
              <div className="absolute right-0 top-0 h-full bg-b rounded-r-[3px] transition-[width] duration-300" style={{ width: `${pctB}%` }} />
              <div className="absolute -top-1 w-[3px] h-[15px] bg-ink rounded-[1px] opacity-35 transition-[left] duration-300" style={{ left: `${share.a * 100}%` }} />
            </div>
          </div>
        );
      })}
    </section>
  );
}
