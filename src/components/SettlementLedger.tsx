import type { ReactNode } from 'react';
import { DASH, fmtMoney } from '../lib/format';
import { GAP_LABELS, GAP_REFERENCE_ROWS, TAX, WHITE_PAPER_VERSION } from '../lib/labels';
import { settlementSentence, splitLabel as fmtSplit } from '../lib/report';
import { isBalanced } from '../lib/settlement';
import type { RefKey } from '../lib/glossary';
import { useApp, useOwnership, usePartnerNames, useSettlement } from '../store/AppContext';
import { Term } from './ui/Term';

/* Type scale sampled from the v1.8 mockup's Gap Analysis table. */
const METRIC_TEXT = 'font-mono text-[0.77rem] font-bold text-text';
const VALUE_TEXT = 'font-mono text-[0.75rem] font-bold text-right py-2 pl-4 whitespace-nowrap';
const HEAD_TEXT = 'font-mono uppercase text-[0.7rem] tracking-[0.08em] font-bold pb-1.5';

/**
 * Gap analysis per White Paper v6.10 §14.1. A gap is Partner A's target minus actual
 * (positive = A is owed), so A's column shows the gap as-is and B's column shows its
 * negative — every row nets to zero. Only the settlement rows feed Total True-Up.
 */
export function SettlementLedger() {
  const { state } = useApp();
  const { gaps, cash, unassigned, complete } = useSettlement();
  const names = usePartnerNames();
  const share = useOwnership();

  const hasData = state.properties.length > 0;
  const splitLabel = fmtSplit(share.a);

  const settlement = hasData
    ? settlementSentence(gaps.total, names, share.a)
    : 'Upload a file or add properties to see the settlement';

  return (
    <section className="card px-4 pt-3.5 pb-3">
      <div className="font-mono uppercase text-[0.77rem] tracking-[0.08em] text-muted font-bold mb-1.5">Gap Analysis</div>
      <p className="font-serif text-[0.8rem] leading-snug text-text mb-3">
        Each gap is a partner&rsquo;s proportional target minus what they actually received. A positive number means
        that partner is under-allocated and is owed cash; negative means they hold more than their share and owe it.
        Every row nets to zero across the two columns.
      </p>

      <GapBox title={GAP_LABELS.referenceTitle} names={names}>
        {GAP_REFERENCE_ROWS.map(({ label, key, ref }) => (
          <GapRow key={key} label={label} term={ref} gap={gaps[key]} />
        ))}
      </GapBox>

      <GapBox title={GAP_LABELS.settlementTitle} names={names}>
        <GapRow label={GAP_LABELS.npvEquity} term="gapNpvEquity" gap={gaps.npvEquity} />
        <tr className="border-b border-border">
          <td className={`${METRIC_TEXT} pl-1.5 py-2`}>
            <Term term="basisTrueUp">{GAP_LABELS.basisTrueUp}</Term>
            <Tag>from {TAX.tool}</Tag>
          </td>
          <td className={`${VALUE_TEXT} text-muted2`}>{DASH}</td>
          <td className={`${VALUE_TEXT} text-muted2`}>{DASH}</td>
        </tr>
        <GapRow label={GAP_LABELS.bidDiff} term="gapBidDiff" gap={gaps.bidDiff} />
        <tr className="border-b border-border">
          <td className={`${METRIC_TEXT} pl-1.5 py-2`}>
            <Term term="gapCash">{GAP_LABELS.cash}</Term>
            <Tag>split {splitLabel}</Tag>
          </td>
          <td className={`${VALUE_TEXT} text-text`}>{fmtMoney(cash.a)}</td>
          <td className={`${VALUE_TEXT} text-text`}>{fmtMoney(cash.b)}</td>
        </tr>
        <GapRow label={GAP_LABELS.total} term="totalTrueUp" gap={gaps.total} grand />
      </GapBox>

      <div className="mt-3.5 rounded-[3px] bg-hdr-bg text-center px-4 py-3">
        <div className="font-mono uppercase text-[0.66rem] tracking-[0.12em] text-[#aaaaaa] font-bold mb-1"><Term term="finalSettlement">{GAP_LABELS.final}</Term></div>
        <div className={`font-mono font-bold ${hasData ? 'text-[1.1rem] text-gold' : 'text-[0.8rem] text-hdr-muted'}`}>
          {settlement}
        </div>
        {hasData && !complete && (
          <div className="font-mono text-[0.66rem] tracking-[0.05em] text-red mt-1.5">
            Provisional — {unassigned.count} {unassigned.count === 1 ? 'property' : 'properties'} unassigned
          </div>
        )}
      </div>

      <p className="font-serif italic text-[0.75rem] leading-snug text-muted2 mt-2.5">
        Total True-Up = NPV Equity gap + {TAX.basisTrueUp} + Bid Difference gap (White Paper v{WHITE_PAPER_VERSION} §14.1);
        whichever partner&rsquo;s total is negative pays the other. Cash &amp; Equivalents is split by ownership, so
        its gap is zero. The {TAX.basisTrueUp} (present value of lost depreciation) is calculated in the separate{' '}
        {TAX.tool} from the {TAX.basisShortfall} above (White Paper §11.3–11.4) and must be added to the figure shown. Debt Service is a burden,
        so in that reference row carrying more than your share is what shows as positive. Unassigned properties belong to
        neither partner and are left out of the portfolio the targets are taken from, so the settlement is provisional
        until every property is assigned.
      </p>
    </section>
  );
}

/** Bordered sub-table; the group title sits in the header row beside the Partner A / Partner B columns. */
function GapBox({ title, names, children }: { title: string; names: Record<'a' | 'b', string>; children: ReactNode }) {
  return (
    <div className="border-[1.5px] border-border rounded-[4px] overflow-hidden mb-3">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-ink">
            {/* The title may wrap; the partner columns are nowrap so values stay visible in a narrow aside. */}
            <th className={`${HEAD_TEXT} text-left text-muted pl-3 pt-2`}>{title}</th>
            <th className={`${HEAD_TEXT} text-right text-a pl-4 pt-2 whitespace-nowrap`}>{names.a}</th>
            <th className={`${HEAD_TEXT} text-right text-b pl-4 pr-3 pt-2 whitespace-nowrap`}>{names.b}</th>
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

function GapRow({ label, term, gap, grand }: { label: string; term: RefKey; gap: number; grand?: boolean }) {
  return (
    <tr className={grand ? 'border-t-2 border-b border-ink' : 'border-b border-border'}>
      <td className={`${METRIC_TEXT} pl-1.5 py-2`}><Term term={term}>{label}</Term></td>
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
