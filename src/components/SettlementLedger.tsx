import { fmtMoney } from '../lib/format';
import { isBalanced, type Gaps } from '../lib/settlement';
import { useApp, useOwnership, usePartnerNames, useSettlement } from '../store/AppContext';

const GAP_ROWS: readonly { label: string; key: keyof Omit<Gaps, 'total'> }[] = [
  { label: 'NPV Equity', key: 'npvEquity' },
  { label: 'Adj. Market Value', key: 'amv' },
  { label: 'Debt Service', key: 'ads' },
  { label: 'Net Cash Flow', key: 'ncf' },
  { label: 'Bid Difference', key: 'bidDiff' },
];

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
      <div className="font-mono uppercase text-[0.7rem] tracking-[0.08em] text-muted mb-1.5">Gap Analysis</div>
      <p className="font-sans text-[0.72rem] leading-snug text-text2 mb-2.5">
        For each metric: a positive number in a partner&rsquo;s column means that partner is under-allocated and is owed
        that amount; negative means they hold more than their target and owe it. Every row nets to zero across the two
        columns — one partner&rsquo;s credit is the other&rsquo;s debit.
      </p>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="text-left font-mono font-normal uppercase text-[0.62rem] tracking-[0.08em] text-muted pl-1.5 pb-1.5">Metric</th>
            <th className="text-right font-mono font-bold uppercase text-[0.62rem] tracking-[0.08em] text-a pb-1.5 pl-4">{names.a}</th>
            <th className="text-right font-mono font-bold uppercase text-[0.62rem] tracking-[0.08em] text-b pb-1.5 pl-4">{names.b}</th>
          </tr>
        </thead>
        <tbody>
          {GAP_ROWS.map(({ label, key }) => (
            <GapRow key={key} label={label} gap={gaps[key]} />
          ))}
          <tr className="border-b border-border">
            <td className="font-mono text-[0.78rem] text-text pl-1.5 py-[7px]">Cash &amp; Equivalents (ownership split)</td>
            <td className="font-mono text-[0.74rem] font-bold text-text text-right py-[7px] pl-4">{fmtMoney(cash.a)}</td>
            <td className="font-mono text-[0.74rem] font-bold text-text text-right py-[7px] pl-4">{fmtMoney(cash.b)}</td>
          </tr>
          <GapRow label="Total True-Up" gap={gaps.total} grand />
        </tbody>
      </table>

      <div className="mt-3.5 rounded-[3px] bg-hdr-bg text-center px-4 py-3">
        <div className="font-mono uppercase text-[0.6rem] tracking-[0.12em] text-[#aaaaaa] mb-1">Final Settlement</div>
        <div className={`font-mono font-bold ${hasData ? 'text-[1.05rem] text-gold' : 'text-[0.8rem] text-hdr-muted'}`}>
          {settlement}
        </div>
      </div>

      <p className="font-serif italic text-[0.68rem] leading-snug text-muted2 mt-2.5">
        Each row is (that partner&rsquo;s ownership % × the portfolio total for that metric) − that partner&rsquo;s own
        total. The Total row adds them all, and whichever partner&rsquo;s total comes out negative is the one who pays.
        Basis True-Up is calculated in the separate Tax Basis Depreciation tool and is not included above.
      </p>
    </section>
  );
}

function GapRow({ label, gap, grand }: { label: string; gap: number; grand?: boolean }) {
  return (
    <tr className={grand ? 'border-t-2 border-ink' : 'border-b border-border'}>
      <td className={`font-mono text-[0.78rem] text-text pl-1.5 py-[7px] ${grand ? 'font-bold' : ''}`}>{label}</td>
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
  return <td className={`font-mono text-[0.74rem] font-bold text-right py-[7px] pl-4 ${tone}`}>{text}</td>;
}
