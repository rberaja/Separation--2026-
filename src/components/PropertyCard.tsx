import type { ReactNode } from 'react';
import { computeMetrics } from '../lib/finance';
import { DASH, fmtMoney, fmtText } from '../lib/format';
import { TAX, depreciationLabel } from '../lib/labels';
import { PARTNERS, type NumericField, type Partner, type Property } from '../lib/types';
import { useApp, useDiscountRate, usePartnerNames } from '../store/AppContext';
import type { RefKey } from '../lib/glossary';
import { NumberInput } from './ui/NumberInput';
import { Term } from './ui/Term';
import { signTone, toneClass, type Tone } from './ui/tone';

const ASSIGN_BORDER: Record<Property['assign'], string> = {
  none: 'border-l-border2',
  a: 'border-l-a',
  b: 'border-l-b',
};
const ASSIGN_BTN: Record<Partner, string> = {
  a: 'bg-a border-a text-white',
  b: 'bg-b border-b text-white',
};

export function PropertyCard({
  property: p,
  showAssignment = true,
  collapsed = false,
  onToggleCollapsed,
}: {
  property: Property;
  /** Group members inherit the consolidated selection-unit assignment. */
  showAssignment?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { state, dispatch } = useApp();
  const names = usePartnerNames();
  const m = computeMetrics(p, useDiscountRate());

  const setField = (field: NumericField) => (value: number | null) =>
    dispatch({ type: 'property/update', id: p.id, patch: { [field]: value } });

  return (
    <article className={`card rounded-[5px] overflow-hidden border-l-4 ${ASSIGN_BORDER[p.assign]}`}>
      {/* Header */}
      <div className="flex items-center gap-[9px] px-3 py-2 border-b border-border bg-surface2">
        <input
          type="text"
          placeholder="Property name"
          aria-label="Property name"
          className="flex-1 bg-transparent border-0 outline-none text-text font-serif text-[0.95rem] font-medium placeholder:text-muted2"
          value={p.name}
          onChange={(e) => dispatch({ type: 'property/update', id: p.id, patch: { name: e.target.value } })}
        />
        {showAssignment && <div className="flex gap-[3px]" role="group" aria-label="Assign to partner">
          {PARTNERS.map((partner) => (
            <button
              key={partner}
              type="button"
              aria-pressed={p.assign === partner}
              onClick={() => dispatch({ type: 'property/assign', id: p.id, partner: p.assign === partner ? 'none' : partner })}
              className={`px-2 py-[3px] rounded-[3px] border-[1.5px] font-mono text-[0.6rem] tracking-[0.05em] font-semibold cursor-pointer transition-all duration-100 ${
                p.assign === partner ? ASSIGN_BTN[partner] : 'border-border bg-transparent text-muted'
              }`}
            >
              {names[partner].split(' ')[0]}
            </button>
          ))}
        </div>}
        {onToggleCollapsed && <button type="button" className="font-mono text-[.61rem] text-muted hover:text-text cursor-pointer" aria-expanded={!collapsed} onClick={onToggleCollapsed}>
          {collapsed ? '▾ Expand' : '▴ Collapse'}
        </button>}
      </div>

      {/* Inputs — three columns */}
      {!collapsed && <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start">
        <Column label="Property">
          <Field label="Market Value" term="marketVal">
            <NumberInput className="field-input" placeholder="0" value={p.marketVal} onChange={setField('marketVal')} />
          </Field>
          <Field label="Bid Difference" term="bidDiff" hint="winning bid − market value">
            <NumberInput className="field-input" placeholder="0" value={p.bidDiff} onChange={setField('bidDiff')} />
          </Field>
          <Field label="Deferred CapEx" term="capex" hint="deducted from market value">
            <NumberInput className="field-input" placeholder="0" value={p.capex} onChange={setField('capex')} />
          </Field>
          <Field label="NOI / yr" term="noi">
            <NumberInput className="field-input" placeholder="0" value={p.noi} onChange={setField('noi')} />
          </Field>
          <Field label="Occupancy Actual" term="occupancyPct" suffix="%" hint="current actual occupancy">
            <NumberInput className="field-input field-input-short" placeholder="0" min={0} max={100} value={p.occupancyPct} onChange={setField('occupancyPct')} />
          </Field>
        </Column>

        <Column label="Loan">
          <Field label="Balance" term="loanBal">
            <NumberInput className="field-input" placeholder="0" value={p.loanBal} onChange={setField('loanBal')} />
          </Field>
          <Field label="Interest Rate" term="loanRate" suffix="%">
            <NumberInput className="field-input" placeholder="0.0" value={p.loanRate} onChange={setField('loanRate')} />
          </Field>
          <Field label="Amort. Period" term="amortPeriod" suffix="yrs" hint="payment schedule (typically 30)">
            <NumberInput className="field-input field-input-short" placeholder="30" value={p.amortPeriod} onChange={setField('amortPeriod')} />
          </Field>
          <Field label="LTV" term="ltv" suffix="%" hint="loan balance ÷ market value">
            <div className="field-readonly">{m.ltv > 0 ? m.ltv.toFixed(1) : DASH}</div>
          </Field>
        </Column>

        <Column label="Principal & Interest" last>
          <Field label="IO Period" term="ioYears" suffix="yrs" hint="0 = no interest-only period">
            <NumberInput className="field-input field-input-short" placeholder="0" value={p.ioYears} onChange={setField('ioYears')} />
          </Field>
          <Field label="Residual Loan Term" term="loanTerm" suffix="yrs" hint="yrs until rate reset / balloon">
            <NumberInput className="field-input field-input-short" placeholder="0" value={p.loanTerm} onChange={setField('loanTerm')} />
          </Field>
          <Field label="Monthly P&I" term="monthlyPmt" hint="from bank statement (overrides computed)">
            <NumberInput className="field-input" placeholder="0" value={p.monthlyPmt} onChange={setField('monthlyPmt')} />
          </Field>
        </Column>
      </div>

      {/* Computed strip — current values */}
      <Strip title="Current Values">
        <Cell label="Adjusted Net Value" term="amv" tone="neu">{fmtMoney(m.amv)}</Cell>
        <Cell label="Debt NPV" term="debtNpv" tone="neg">{fmtMoney(m.debtNpv)}</Cell>
        <Cell label="NPV Equity" term="npvEquity" tone={signTone(m.npvEquity)}>{fmtMoney(m.npvEquity)}</Cell>
        <Cell label="Annual Debt Svc" term="ads" tone="yel">{fmtMoney(m.ads)}</Cell>
        <Cell label="Net Cash Flow / yr" term="ncf" tone={signTone(m.ncf)}>{fmtMoney(m.ncf)}</Cell>
      </Strip>

      {/* Uploaded reference values — tax & compliance */}
      <Strip title="Tax and Compliance">
        <Cell label="Next 40-Yr Certification" term="cert40yr" tone="neu">{fmtText(p.cert40yr)}</Cell>
        <Cell label="Zoning" term="zoning" tone="neu">{fmtText(p.zoning)}</Cell>
        <Cell label="" tone="neu" />
        <Cell label={TAX.remainingBasis} term="remainingBasis" tone="neu">{fmtMoney(p.remainingBasis ?? 0)}</Cell>
        <Cell label={depreciationLabel(state.depreciationYear)} term="depreciation" tone="yel">{fmtMoney(p.depreciation ?? 0)}</Cell>
      </Strip>
      </>}
    </article>
  );
}

/* ── Layout primitives local to the card ─────────────────────────────── */

function Column({ label, last, children }: { label: string; last?: boolean; children: ReactNode }) {
  return (
    <div className={`px-3 py-2.5 ${last ? '' : 'lg:border-r border-border'}`}>
      <div className="font-mono uppercase text-[0.77rem] tracking-[0.05em] text-muted2 dark:text-text font-bold mb-2">{label}</div>
      {children}
    </div>
  );
}

function Field({ label, term, suffix, hint, children }: { label: string; term?: RefKey; suffix?: string; hint?: string; children: ReactNode }) {
  return (
    <>
      <label className="flex items-center justify-between gap-[5px] min-h-7 mb-[5px] last:mb-0">
        <span className="flex-1 font-mono uppercase text-[0.77rem] tracking-[0.05em] text-muted2 dark:text-text font-bold whitespace-nowrap">
          {term ? <Term term={term}>{label}</Term> : label}
        </span>
        {children}
        {/* Fixed-width unit slot (even when empty) keeps every input's right edge aligned. */}
        <span className="font-mono text-muted2 dark:text-text text-[0.75rem] font-bold shrink-0 w-6">{suffix}</span>
      </label>
      {/* pr-6 matches the unit slot width so the hint's right edge lines up with the input, not the unit. */}
      {hint && <div className="font-mono text-[0.58rem] text-muted2 text-right pr-6 -mt-[3px] mb-1">{hint}</div>}
    </>
  );
}

/** A labelled results row: a shaded title cell on the left, then the value cells. */
function Strip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex border-t border-border bg-surface2">
      <div className="w-[120px] shrink-0 flex items-center justify-center text-center px-2 py-2 border-r border-border bg-border/30 font-mono uppercase text-[0.77rem] tracking-[0.05em] text-muted2 dark:text-text font-bold leading-snug">
        {title}
      </div>
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
    </div>
  );
}

function Cell({ label, term, tone, children }: { label: string; term?: RefKey; tone: Tone; children?: ReactNode }) {
  return (
    <div className="text-center border-r border-border last:border-r-0 px-[7px] py-2">
      <div className="font-mono uppercase text-[0.77rem] tracking-[0.05em] text-muted2 dark:text-text font-bold leading-snug mb-1">
        {term ? <Term term={term}>{label}</Term> : label}
      </div>
      <div className={`font-mono text-[1.045rem] font-bold ${toneClass(tone)}`}>{children}</div>
    </div>
  );
}
