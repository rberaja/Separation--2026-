import { Fragment } from 'react';
import { fmtMoney } from '../lib/format';
import { PARTNER_TOTAL_GROUPS } from '../lib/labels';
import type { PartnerTotals } from '../lib/settlement';
import type { Partner } from '../lib/types';
import { useOwnership, usePartnerNames, useSettlement } from '../store/AppContext';
import { toneClass, type Tone } from './ui/tone';

/** Colour accents per row; everything else is neutral. */
const TONES: Partial<Record<keyof PartnerTotals, Tone>> = {
  capex: 'neg',
  loanBal: 'neg',
  debtNpv: 'neg',
  npvEquity: 'pos',
  ads: 'yel',
  ncf: 'pos',
};

const HEADER_STYLE: Record<Partner, string> = {
  a: 'bg-a-light border-l-a',
  b: 'bg-b-light border-l-b',
};

export function PartnerTotalsCard({ partner }: { partner: Partner }) {
  const names = usePartnerNames();
  const share = useOwnership();
  const totals = useSettlement().totals[partner];

  return (
    <section className="card overflow-hidden" aria-label={`${names[partner]} totals`}>
      <div className={`flex justify-between items-center px-3.5 py-[9px] border-b border-border border-l-4 ${HEADER_STYLE[partner]}`}>
        <span className="font-serif text-[1rem] font-medium text-text">{names[partner]}</span>
        <span className="font-mono text-[0.77rem] text-text font-bold">{Math.round(share[partner] * 100)}%</span>
      </div>

      {PARTNER_TOTAL_GROUPS.map((rows, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <div className="h-px bg-border" />}
          {rows.map(({ label, key }) => (
            <div key={key} className="flex justify-between items-center px-3.5 py-[7px] border-b border-border last:border-b-0">
              <span className="font-mono uppercase text-[0.77rem] tracking-[0.05em] text-muted2 dark:text-text font-bold">{label}</span>
              <span className={`font-mono text-[0.75rem] font-bold ${TONES[key] ? toneClass(TONES[key]) : 'text-text'}`}>
                {key === 'count' ? totals.count : fmtMoney(totals[key])}
              </span>
            </div>
          ))}
        </Fragment>
      ))}
    </section>
  );
}
