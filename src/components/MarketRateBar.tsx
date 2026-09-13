import type { ReactNode } from 'react';
import { fmtMoney } from '../lib/format';
import { useApp, useSettlement } from '../store/AppContext';
import type { RefKey } from '../lib/glossary';
import { NumberInput } from './ui/NumberInput';
import { Term } from './ui/Term';

/**
 * Portfolio-wide settings set once beneath the toolbar: market discount rate and
 * cash & equivalents, plus a read-only count of properties not yet in the split.
 */
export function MarketRateBar() {
  const { state, dispatch } = useApp();
  const { unassigned } = useSettlement();
  const hasData = state.properties.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-5 bg-surface border-b border-border px-7 py-2">
      <Setting label="Market Discount Rate" term="discountRate" suffix="%">
        <NumberInput
          className="field-input field-input-short"
          value={state.discountRate}
          step={0.25}
          min={0}
          max={30}
          onChange={(value) => dispatch({ type: 'settings/discountRate', value })}
        />
      </Setting>

      <Setting label="Cash & Equivalents" term="cashEquiv" suffix="$">
        <NumberInput
          className="field-input"
          value={state.cashEquiv}
          step={1000}
          min={0}
          onChange={(value) => dispatch({ type: 'settings/cashEquiv', value })}
        />
      </Setting>

      {hasData && (
        <div className="flex items-center gap-1.5 sm:ml-auto" role="status" aria-live="polite">
          <Term term="unassigned" className="font-mono uppercase text-[0.77rem] tracking-[0.05em] text-muted2 dark:text-text font-bold whitespace-nowrap">
            Unassigned
          </Term>
          {unassigned.count === 0 ? (
            <span className="font-mono text-[0.75rem] font-bold text-green">0 — split complete</span>
          ) : (
            <span className="font-mono text-[0.75rem] font-bold text-red">
              {unassigned.count} {unassigned.count === 1 ? 'property' : 'properties'} · {fmtMoney(unassigned.amv)} Adj. Net Value not in the split
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Setting({ label, term, suffix, children }: { label: string; term: RefKey; suffix: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-1.5">
      <Term term={term} className="font-mono uppercase text-[0.77rem] tracking-[0.05em] text-muted2 dark:text-text font-bold whitespace-nowrap">{label}</Term>
      {children}
      <span className="font-mono text-muted2 dark:text-text text-[0.75rem] font-bold">{suffix}</span>
    </label>
  );
}
