import { fmtMoney } from '../lib/format';
import { isBalanced, type Gaps } from '../lib/settlement';
import { useApp, useOwnership, usePartnerNames, useSettlement } from '../store/AppContext';

interface GapRowSpec {
  label: string;
  key: keyof Omit<Gaps, 'total'>;
  /** Reference-only rows are shown but not added into Total True-Up. */
  reference?: boolean;
}

const GAP_ROWS: readonly GapRowSpec[] = [
  { label: 'NPV Equity', key: 'npvEquity' },
  { label: 'Adj. Market Value', key: 'amv' },
  { label: 'Debt Service', key: 'ads' },
  { label: 'Net Cash Flow', key: 'ncf' },
  { label: 'Remaining Tax Basis', key: 'remainingBasis', reference: true },
  { label: 'Bid Difference', key: 'bidDiff' },
];

/* Type scale sampled from the v1.8 mockup's Gap Analysis table. */
const METRIC_TEXT = 'font-mono text-[0.77rem] font-bold text-text';
const VALUE_TEXT = 'font-mono text-[0.75rem] font-bold text-right py-2 pl-4';
const HEAD_TEXT = 'font-mono uppercase text-[0.7rem] tracking-[0.08em] font-bold pb-1.5';

/**
 * Gap analysis table. A gap is Partner A's actual total minus their proportional
 * target, so A's column shows the gap as-is and B's column shows its negative —
 * every row nets to zero across the two columns.
 */
export function SettlementLedger() {
  const { state } = useApp();
  const { gaps, cash } = useSettlement();
  const names = usePartnerNames();
  const share = useOwnership();

  const hasData = state.properties.length > 0;
  const splitLabel = `${Math.round(share.a * 100)} / ${Math.round(share.b * 100)}`;

  const settlement = !hasData
    ? 'Upload a file or add properties to see the settlement'
    : isBalanced(gaps.total)
      ? `Balanced at ${splitLabel} — no payment due`
      : gaps.total > 0
        ? `${names.b} pays ${names.a} ${fmtMoney(Math.abs(gaps.total))}`
        : `${names.a} pays ${names.b} ${fmtMoney(Math.abs(gaps.total))}`;

  return (
    <section className="card px-4 pt-3.5 pb-3">
      <div className="font-mono uppercase text-[0.77rem] tracking-[0.08em] text-muted font-bold mb-1.5">Gap Analysis</div>
      <p className="font-serif text-[0.8rem] leading-snug text-text mb-3">
        For each metric: a positive number in a partner&rsquo;s column means that partner is under-allocated and is owed
        that amount; negative means they hold more than their target and owe it. Every row nets to zero across the two
        columns — one partner&rsquo;s credit is the other&rsquo;s debit.
      </p>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className={`${HEAD_TEXT} text-left text-muted pl-1.5`}>Metric</th>
            <th className={`${HEAD_TEXT} text-right font-bold text-a pl-4`}>{names.a}</th>
            <th className={`${HEAD_TEXT} text-right font-bold text-b pl-4`}>{names.b}</th>
          </tr>
        </thead>
        <tbody>
          {GAP_ROWS.map(({ label, key, reference }) => (
            <GapRow key={key} label={label} gap={gaps[key]} reference={reference} />
          ))}
          <tr className="border-b border-border">
            <td className={`${METRIC_TEXT} pl-1.5 py-2`}>Cash &amp; Equivalents (ownership split)</td>
            <td className={`${VALUE_TEXT} text-text`}>{fmtMoney(cash.a)}</td>
            <td className={`${VALUE_TEXT} text-text`}>{fmtMoney(cash.b)}</td>
          </tr>
          <GapRow label="Total True-Up" gap={gaps.total} grand />
        </tbody>
      </table>

      <div className="mt-3.5 rounded-[3px] bg-hdr-bg text-center px-4 py-3">
        <div className="font-mono uppercase text-[0.66rem] tracking-[0.12em] text-[#aaaaaa] font-bold mb-1">Final Settlement</div>
        <div className={`font-mono font-bold ${hasData ? 'text-[1.1rem] text-gold' : 'text-[0.8rem] text-hdr-muted'}`}>
          {settlement}
        </div>
      </div>

      <p className="font-serif italic text-[0.75rem] leading-snug text-muted2 mt-2.5">
        Each row is that partner&rsquo;s own total − (that partner&rsquo;s ownership % × the portfolio total for that
        metric). The Total row adds them all, and whichever partner&rsquo;s total comes out negative is the one who
        pays. Remaining Tax Basis is shown for reference only — the Basis True-Up is calculated in the separate Tax
        Basis Depreciation tool and is not included in the total.
      </p>
    </section>
  );
}

function GapRow({ label, gap, grand, reference }: { label: string; gap: number; grand?: boolean; reference?: boolean }) {
  return (
    <tr className={grand ? 'border-t-2 border-ink' : 'border-b border-border'}>
      <td className={`${METRIC_TEXT} pl-1.5 py-2 ${grand ? 'font-bold' : ''}`}>
        {label}
        {reference && <span className="font-mono text-[0.66rem] font-normal text-muted2 ml-1.5">(reference — not in total)</span>}
      </td>
      <SignedCell value={gap} />
      <SignedCell value={-gap} />
    </tr>
  );
}

/** +$X in green, −$X in red, plain $0 when balanced. */
function SignedCell({ value }: { value: number }) {
  const balanced = isBalanced(value);
  const tone = balanced ? 'text-text' : value > 0 ? 'text-green' : 'text-red';
  const text = balanced ? fmtMoney(0) : `${value > 0 ? '+' : '−'}${fmtMoney(Math.abs(value))}`;
  return <td className={`${VALUE_TEXT} ${tone}`}>{text}</td>;
}
