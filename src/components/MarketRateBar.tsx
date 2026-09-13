import type { ReactNode } from 'react';
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

      <Setting label="Unassigned Properties" term="unassigned" suffix="">
        <div
          className={`field-readonly ${unassigned.count > 0 ? 'text-red border-red' : ''}`}
          role="status"
          aria-live="polite"
          aria-label="Unassigned properties"
        >
          {unassigned.count}
        </div>
      </Setting>
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
