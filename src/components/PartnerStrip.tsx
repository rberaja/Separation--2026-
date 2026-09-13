import { PARTNERS, type Partner } from '../lib/types';
import { useApp, useOwnership } from '../store/AppContext';
import { NumberInput } from './ui/NumberInput';
import { Term } from './ui/Term';

const ACCENT: Record<Partner, string> = { a: 'before:bg-a', b: 'before:bg-b' };

/** Partner name / ownership % editors plus the split bar beneath them. */
export function PartnerStrip() {
  const { state, dispatch } = useApp();
  const share = useOwnership();

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {PARTNERS.map((partner) => (
          <div
            key={partner}
            className={`card relative px-[15px] py-[11px] before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t ${ACCENT[partner]}`}
          >
            <div className="caption text-[0.58rem] tracking-[0.12em] font-semibold mb-1.5">Partner {partner.toUpperCase()}</div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                aria-label={`Partner ${partner.toUpperCase()} name`}
                className="underline-input flex-1 font-serif text-[0.9rem]"
                value={state.partnerNames[partner]}
                onChange={(e) => dispatch({ type: 'partner/setName', partner, name: e.target.value })}
              />
              <NumberInput
                aria-label={`Partner ${partner.toUpperCase()} ownership percent`}
                className="underline-input w-[42px] font-mono text-[0.9rem] text-right"
                min={1}
                max={99}
                value={Math.round(share[partner] * 100)}
                onChange={(v) =>
                  dispatch({ type: 'partner/setPctA', value: v === null ? null : partner === 'a' ? v : 100 - v })
                }
              />
              <Term term="targetSplit" className="font-mono text-muted text-[0.8rem]">% ownership</Term>
            </div>
          </div>
        ))}
      </div>

      <div className="flex h-1 rounded-sm overflow-hidden mb-4 bg-border" aria-hidden="true">
        <div className="bg-a transition-[width] duration-300 ease-out" style={{ width: `${share.a * 100}%` }} />
        <div className="bg-b transition-[width] duration-300 ease-out" style={{ width: `${share.b * 100}%` }} />
      </div>
    </>
  );
}
