import type { ReactNode } from 'react';
import { DASH, fmtMoney } from '../lib/format';
import { isBalanced, type Gaps } from '../lib/settlement';
import { useApp, useOwnership, usePartnerNames, useSettlement } from '../store/AppContext';

const REFERENCE_ROWS: readonly { label: string; key: keyof Omit<Gaps, 'total'> }[] = [
  { label: 'Adj. Market Value', key: 'amv' },
  { label: 'Debt Service', key: 'ads' },
  { label: 'Net Cash Flow', key: 'ncf' },
  { label: 'Remaining Tax Basis (shortfall)', key: 'remainingBasis' },
];

/* Type scale sampled from the v1.8 mockup's Gap Analysis table. */
const METRIC_TEXT = 'font-mono text-[0.77rem] font-bold text-text';
const VALUE_TEXT = 'font-mono text-[0.75rem] font-bold text-right py-2 pl-4';
const HEAD_TEXT = 'font-mono uppercase text-[0.7rem] tracking-[0.08em] font-bold pb-1.5';
const BOX_TITLE = 'font-mono uppercase text-[0.66rem] tracking-[0.1em] text-muted2 font-bold px-3 py-1.5 bg-surface2 border-b border-border';

/**
 * Gap analysis per White Paper v6.10 §14.1. A gap is Partner A's target minus actual
 * (positive = A is owed), so A's column shows the gap as-is and B's column shows its
 * negative — every row nets to zero. Only the settlement rows feed Total True-Up.
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
        Each gap is a partner&rsquo;s proportional target minus what they actually received. A positive number means
        that partner is under-allocated and is owed cash; negative means they hold more than their share and owe it.
        Every row nets to zero across the two columns.
      </p>

      <GapBox title="Reference only — not part of the settlement" names={names}>
        {REFERENCE_ROWS.map(({ label, key }) => (
          <GapRow key={key} label={label} gap={gaps[key]} />
        ))}
      </GapBox>

      <GapBox title="Metrics used for settlement" names={names}>
        <GapRow label="NPV Equity" gap={gaps.npvEquity} />
        <tr className="border-b border-border">
          <td className={`${METRIC_TEXT} pl-1.5 py-2`}>Residual Basis True-Up</td>
          <td className={`${VALUE_TEXT} text-muted2`}>{DASH}</td>
          <td className={`${VALUE_TEXT} text-muted2`}>{DASH}</td>
        </tr>
        <GapRow label="Bid Difference" gap={gaps.bidDiff} />
        <tr className="border-b border-border">
          <td className={`${METRIC_TEXT} pl-1.5 py-2`}>
            Cash &amp; Equivalents
            <Tag>split {splitLabel}</Tag>
          </td>
          <td className={`${VALUE_TEXT} text-text`}>{fmtMoney(cash.a)}</td>
          <td className={`${VALUE_TEXT} text-text`}>{fmtMoney(cash.b)}</td>
        </tr>
        <GapRow label="Total True-Up" gap={gaps.total} grand />
      </GapBox>

      <div className="mt-3.5 rounded-[3px] bg-hdr-bg text-center px-4 py-3">
        <div className="font-mono uppercase text-[0.66rem] tracking-[0.12em] text-[#aaaaaa] font-bold mb-1">Final Settlement</div>
        <div className={`font-mono font-bold ${hasData ? 'text-[1.1rem] text-gold' : 'text-[0.8rem] text-hdr-muted'}`}>
          {settlement}
        </div>
      </div>

      <p className="font-serif italic text-[0.75rem] leading-snug text-muted2 mt-2.5">
        Total True-Up = NPV Equity gap + Residual Basis True-Up + Bid Difference gap (White Paper §14.1); whichever
        partner&rsquo;s total is negative pays the other. Cash &amp; Equivalents is split by ownership, so its gap is
        zero. The Residual Basis True-Up (present value of lost depreciation) is calculated in the separate Tax Basis
        Depreciation tool and must be added to the figure above. Debt Service is a burden, so in that reference row
        carrying more than your share is what shows as positive.
      </p>
    </section>
  );
}

/** Bordered sub-table with its own title bar and Metric / Partner A / Partner B header. */
function GapBox({ title, names, children }: { title: string; names: Record<'a' | 'b', string>; children: ReactNode }) {
  return (
    <div className="border-[1.5px] border-border rounded-[4px] overflow-hidden mb-3">
      <div className={BOX_TITLE}>{title}</div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className={`${HEAD_TEXT} text-left text-muted pl-3 pt-2`}>Metric</th>
            <th className={`${HEAD_TEXT} text-right text-a pl-4 pt-2`}>{names.a}</th>
            <th className={`${HEAD_TEXT} text-right text-b pl-4 pr-3 pt-2`}>{names.b}</th>
          </tr>
        </thead>
        <tbody className="[&>tr:last-child]:border-b-0 [&_td:first-child]:pl-3 [&_td:last-child]:pr-3">{children}</tbody>
      </table>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[0.66rem] font-normal text-muted2 ml-1.5">({children})</span>;
}

function GapRow({ label, gap, grand }: { label: string; gap: number; grand?: boolean }) {
  return (
    <tr className={grand ? 'border-t-2 border-b border-ink' : 'border-b border-border'}>
      <td className={`${METRIC_TEXT} pl-1.5 py-2`}>{label}</td>
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
