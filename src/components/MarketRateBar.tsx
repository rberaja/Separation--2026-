import type { ReactNode } from 'react';
import { useApp } from '../store/AppContext';
import { NumberInput } from './ui/NumberInput';

/** Portfolio-wide settings set once beneath the toolbar: market discount rate and cash & equivalents. */
export function MarketRateBar() {
  const { state, dispatch } = useApp();

  return (
    <div className="flex flex-wrap items-center gap-5 bg-surface border-b border-border px-7 py-2">
      <Setting label="Market Discount Rate" suffix="%">
        <NumberInput
          className="field-input field-input-short"
          value={state.discountRate}
          step={0.25}
          min={0}
          max={30}
          onChange={(value) => dispatch({ type: 'settings/discountRate', value })}
        />
      </Setting>

      <Setting label="Cash & Equivalents" suffix="$">
        <NumberInput
          className="field-input"
          value={state.cashEquiv}
          step={1000}
          min={0}
          onChange={(value) => dispatch({ type: 'settings/cashEquiv', value })}
        />
      </Setting>
    </div>
  );
}

function Setting({ label, suffix, children }: { label: string; suffix: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="font-mono uppercase text-[0.77rem] tracking-[0.05em] text-muted2 dark:text-text font-bold whitespace-nowrap">{label}</span>
      {children}
      <span className="font-mono text-muted2 dark:text-text text-[0.75rem] font-bold">{suffix}</span>
    </label>
  );
}
