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

export function SettlementLedger() {
  const { state } = useApp();
  const { gaps, cash } = useSettlement();
  const names = usePartnerNames();
  const share = useOwnership();

  const splitLabel = `${Math.round(share.a * 100)}/${Math.round(share.b * 100)}`;
  const note =
    state.properties.length === 0
      ? 'Upload a file or add properties to see the settlement ledger.'
      : isBalanced(gaps.total)
        ? `Settlement balanced at ${splitLabel} before Basis True-Up and Cash & Equivalents.`
        : `${gaps.total > 0 ? names.a : names.b} is owed ${fmtMoney(Math.abs(gaps.total))} to true up to the ${splitLabel} split, before Basis True-Up and the Cash & Equivalents split shown below.`;

  return (
    <section className="card p-[13px]">
      <div className="caption text-[0.58rem] tracking-[0.12em] font-bold mb-[9px]">
        Settlement Ledger — Gap vs. Proportional Target
      </div>

      <div className="flex flex-col gap-1.5">
        {GAP_ROWS.map(({ label, key }) => (
          <GapRow key={key} label={label} gap={gaps[key]} />
        ))}
      </div>

      <Divider />
      <div className="flex justify-between items-center">
        <span className="caption text-[0.62rem] tracking-[0.05em]">Cash &amp; Equivalents (ownership split)</span>
        <span className="font-mono text-[0.78rem] font-bold">
          {fmtMoney(cash.a)} / {fmtMoney(cash.b)}
        </span>
      </div>

      <Divider />
      <GapRow label="Total True-Up" gap={gaps.total} grand />

      <p className="note">{note}</p>
      <p className="note">Basis True-Up is calculated in the separate Tax Basis Depreciation tool and is not included above.</p>
    </section>
  );
}

function GapRow({ label, gap, grand }: { label: string; gap: number; grand?: boolean }) {
  const balanced = isBalanced(gap);
  return (
    <div className="flex justify-between items-center">
      <span className={grand ? 'font-mono text-[0.68rem] text-text font-bold' : 'caption text-[0.62rem] tracking-[0.05em]'}>
        {label}
      </span>
      <span className={`font-mono font-bold ${grand ? 'text-[0.92rem]' : 'text-[0.78rem]'} ${balanced ? 'text-green' : 'text-red'}`}>
        {balanced ? '✓ balanced' : `${fmtMoney(Math.abs(gap))} ${gap > 0 ? 'A↑' : 'B↑'}`}
      </span>
    </div>
  );
}

const Divider = () => <div className="h-px bg-border my-1.5" />;
