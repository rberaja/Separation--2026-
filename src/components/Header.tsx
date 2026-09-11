import type { ReactNode } from 'react';
import { APP_VERSION } from '../lib/constants';
import type { Theme } from '../lib/types';
import { useApp } from '../store/AppContext';
import { NumberInput } from './ui/NumberInput';

const THEMES: readonly { value: Theme; label: string }[] = [
  { value: 'light', label: '☼ Light' },
  { value: 'dark', label: '☾ Dark' },
];

export function Header() {
  const { state, dispatch } = useApp();

  return (
    <header className="flex flex-wrap items-center justify-between gap-2.5 bg-hdr-bg border-b-2 border-a px-7 py-[13px]">
      <div>
        <h1 className="font-serif text-[1.1rem] font-medium text-hdr-text">Real Estate Partition Tool</h1>
        <div className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-hdr-muted mt-0.5">
          Loan-Aware · CapEx-Adjusted · Settlement Ledger · v{APP_VERSION} · Client-Side
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <HeaderField label="Discount Rate" suffix="%">
          <NumberInput
            className="hdr-input"
            value={state.discountRate}
            step={0.25}
            min={0}
            max={30}
            onChange={(value) => dispatch({ type: 'settings/discountRate', value })}
          />
        </HeaderField>

        <HeaderField label="Cash & Equivalents ($)">
          <NumberInput
            className="hdr-input"
            value={state.cashEquiv}
            step={1000}
            min={0}
            onChange={(value) => dispatch({ type: 'settings/cashEquiv', value })}
          />
        </HeaderField>

        <div className="flex overflow-hidden rounded bg-hdr-input-bg border border-hdr-input-brd" role="group" aria-label="Theme">
          {THEMES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={state.theme === value}
              onClick={() => dispatch({ type: 'theme/set', theme: value })}
              className={`font-mono text-[0.62rem] tracking-[0.08em] uppercase px-[11px] py-[5px] cursor-pointer transition-all duration-150 ${
                state.theme === value ? 'bg-a text-white' : 'text-hdr-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="font-mono text-[0.58rem] bg-hdr-input-bg border border-hdr-input-brd rounded-[3px] px-[7px] py-[3px] text-hdr-muted tracking-[0.1em]">
          v{APP_VERSION}
        </span>
      </div>
    </header>
  );
}

function HeaderField({ label, suffix, children }: { label: string; suffix?: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="font-mono text-[0.62rem] tracking-[0.1em] uppercase text-hdr-muted whitespace-nowrap">{label}</span>
      {children}
      {suffix && <span className="font-mono text-hdr-muted text-[0.78rem]">{suffix}</span>}
    </label>
  );
}
