import { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';

type Owner = 'a' | 'b';

type Asset = {
  property: string;
  entity: string;
  owner: Owner;
  remainingBasis: number;
  annualDepreciation: number;
  schedules: { label: string; basis: number; years: number; annual: number }[];
};

const ASSETS: Asset[] = [
  {
    property: 'Juniper Commons', entity: 'JCP Holdings LP', owner: 'a', remainingBasis: 4_860_000, annualDepreciation: 176_400,
    schedules: [
      { label: 'Building', basis: 4_100_000, years: 22, annual: 151_000 },
      { label: 'Tenant improvements', basis: 760_000, years: 6, annual: 25_400 },
    ],
  },
  {
    property: 'Old Mill Lofts', entity: 'Mill Portfolio LLC', owner: 'a', remainingBasis: 1_900_000, annualDepreciation: 82_700,
    schedules: [{ label: 'Building & improvements', basis: 1_900_000, years: 19, annual: 82_700 }],
  },
  {
    property: 'Cedar Row', entity: 'Cedar Development LP', owner: 'a', remainingBasis: 1_115_000, annualDepreciation: 59_900,
    schedules: [{ label: 'Building', basis: 1_115_000, years: 16, annual: 59_900 }],
  },
  {
    property: 'River Station', entity: 'River Station LLC', owner: 'b', remainingBasis: 3_320_000, annualDepreciation: 124_000,
    schedules: [
      { label: 'Building', basis: 2_830_000, years: 20, annual: 106_000 },
      { label: 'Equipment', basis: 490_000, years: 5, annual: 18_000 },
    ],
  },
  {
    property: 'Lakeview Center', entity: 'Lakeview Properties LP', owner: 'b', remainingBasis: 1_200_000, annualDepreciation: 61_500,
    schedules: [{ label: 'Building & improvements', basis: 1_200_000, years: 18, annual: 61_500 }],
  },
];

const money = (value: number, compact = false) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  notation: compact ? 'compact' : 'standard',
}).format(value);

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

/** Visual prototype for the companion Tax Basis Tool described in White Paper §11. */
export function TaxBasisMockup({ onOpenPartition }: { onOpenPartition: () => void }) {
  const { state, dispatch } = useApp();
  const [taxYear, setTaxYear] = useState(2026);
  const [taxRate, setTaxRate] = useState(0.32);
  const [discountRate, setDiscountRate] = useState(0.07);
  const [expanded, setExpanded] = useState('Juniper Commons');

  const model = useMemo(() => {
    const totalBasis = ASSETS.reduce((sum, asset) => sum + asset.remainingBasis, 0);
    const totalDepreciation = ASSETS.reduce((sum, asset) => sum + asset.annualDepreciation, 0);
    const actualA = ASSETS.filter((asset) => asset.owner === 'a').reduce((sum, asset) => sum + asset.remainingBasis, 0);
    const targetA = totalBasis * 0.6;
    const shortfallA = targetA - actualA;
    const components = ASSETS.filter((asset) => asset.owner === 'b').flatMap((asset) => asset.schedules);
    const bBasis = components.reduce((sum, component) => sum + component.basis, 0);
    const pvShield = components.reduce((sum, component) => {
      const portionOfShortfall = bBasis ? shortfallA * component.basis / bBasis : 0;
      const annualLostDeduction = portionOfShortfall / component.years;
      const annuityFactor = (1 - Math.pow(1 + discountRate, -component.years)) / discountRate;
      return sum + annualLostDeduction * taxRate * annuityFactor;
    }, 0);
    return { totalBasis, totalDepreciation, actualA, actualB: totalBasis - actualA, targetA, targetB: totalBasis * .4, shortfallA, pvShield };
  }, [discountRate, taxRate]);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-hdr-bg border-b-[3px] border-a px-7 py-[13px]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-[1.15rem] font-bold text-hdr-text">Real Estate Partition Tool</h1>
            <span className="font-mono text-[0.57rem] tracking-[0.1em] uppercase text-hdr-accent border border-hdr-input-brd rounded px-1.5 py-0.5">Companion tool</span>
          </div>
          <div className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-hdr-accent mt-1">Tax Basis Analyzer · Depreciation Schedule · White Paper §11</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="font-mono text-[0.68rem] uppercase tracking-[0.07em] text-hdr-muted hover:text-white cursor-pointer" onClick={onOpenPartition}>← Partition workspace</button>
          <div className="flex overflow-hidden rounded bg-hdr-input-bg border border-hdr-input-brd" role="group" aria-label="Theme">
            {(['light', 'dark'] as const).map((theme) => <button key={theme} type="button" onClick={() => dispatch({ type: 'theme/set', theme })} className={`font-mono text-[0.62rem] tracking-[0.08em] uppercase px-[11px] py-[5px] cursor-pointer ${state.theme === theme ? 'bg-a text-white' : 'text-hdr-muted'}`}>{theme === 'light' ? '☼ Light' : '☾ Dark'}</button>)}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 bg-surface border-b border-border px-7 py-2.5">
        <button className="tool-btn tool-btn-primary">↑ Import tax return workbook</button>
        <button className="tool-btn">↓ Download input template</button>
        <span className="font-mono text-[0.68rem] text-muted2">Source: <strong className="text-text">2025 Partnership Return.xlsx</strong> · 5 properties · 7 depreciation schedules</span>
        <span className="ml-auto font-mono text-[0.65rem] uppercase tracking-[0.08em] text-green font-bold">● Schedule complete</span>
      </div>

      <main className="max-w-[1540px] mx-auto px-6 py-5">
        <div className="flex flex-wrap justify-between items-end gap-4 mb-5">
          <div>
            <div className="caption text-[0.66rem] mb-1">A. Tax return review</div>
            <h2 className="font-serif text-[1.55rem] font-bold">Remaining basis, by property</h2>
            <p className="mt-1 text-[0.78rem] text-muted max-w-3xl">Import the partnership depreciation schedules, confirm each remaining depreciable item, and see the basis that follows each property in the proposed allocation.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Setting label="Tax year" value={String(taxYear)} onChange={(v) => setTaxYear(Number(v) || 2026)} suffix="" />
            <Setting label="Blended tax rate" value={String(taxRate * 100)} onChange={(v) => setTaxRate(Math.max(0, Number(v) / 100))} suffix="%" />
            <Setting label="Discount rate" value={String(discountRate * 100)} onChange={(v) => setDiscountRate(Math.max(.001, Number(v) / 100))} suffix="%" />
          </div>
        </div>

        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_365px] gap-5 items-start">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex flex-wrap gap-3 justify-between items-center bg-surface2">
              <div className="font-mono font-bold text-[0.71rem] uppercase tracking-[0.08em]">Depreciation schedule extracted from return</div>
              <span className="font-mono text-[0.64rem] text-muted">Click a property to review its components</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[0.75rem]">
                <thead className="font-mono uppercase tracking-[0.07em] text-[0.62rem] text-muted border-b-[1.5px] border-border">
                  <tr><th className="text-left px-4 py-2.5">Property / entity</th><th className="text-left px-3 py-2.5">Proposed owner</th><th className="text-right px-3 py-2.5">Remaining tax basis</th><th className="text-right px-3 py-2.5">Depreciation {taxYear}</th><th className="text-right px-4 py-2.5">Schedules</th></tr>
                </thead>
                <tbody>
                  {ASSETS.map((asset) => <AssetRow key={asset.property} asset={asset} taxYear={taxYear} open={expanded === asset.property} onToggle={() => setExpanded(expanded === asset.property ? '' : asset.property)} />)}
                </tbody>
                <tfoot className="bg-surface2 border-t-[1.5px] border-border font-mono font-bold">
                  <tr><td colSpan={2} className="px-4 py-3 uppercase text-[0.66rem] tracking-[.08em]">Portfolio total</td><td className="text-right px-3 py-3">{money(model.totalBasis)}</td><td className="text-right px-3 py-3 text-yellow">{money(model.totalDepreciation)}</td><td /></tr>
                </tfoot>
              </table>
            </div>
            <div className="mx-4 my-3 note">The basis total is the sum of all remaining depreciable items. The tax-year total is the current-year depreciation deduction from the uploaded schedules, not a re-calculation of original cost.</div>
          </div>

          <aside className="flex flex-col gap-4">
            <div>
              <div className="caption text-[0.66rem] mb-2">B. Basis allocation check</div>
              <div className="card overflow-hidden">
                <div className="px-4 py-3 bg-surface2 border-b border-border"><div className="font-serif font-bold text-[1.02rem]">60 / 40 target comparison</div><div className="font-mono text-[0.61rem] uppercase tracking-[.08em] text-muted mt-1">Target basis − basis received</div></div>
                <Allocation partner="Partner A" share="60% owner" tone="a" target={model.targetA} actual={model.actualA} />
                <Allocation partner="Partner B" share="40% owner" tone="b" target={model.targetB} actual={model.actualB} />
              </div>
            </div>
            <div>
              <div className="caption text-[0.66rem] mb-2">C. White paper §11.4</div>
              <div className="card p-4 border-l-[4px] border-l-a">
                <div className="flex justify-between items-start gap-3"><div><div className="font-serif font-bold text-[1.03rem]">Basis True-Up</div><div className="font-mono text-[0.61rem] uppercase tracking-[.08em] text-muted mt-1">PV of lost depreciation shield</div></div><span className="font-mono text-[.59rem] border border-border2 rounded px-1.5 py-1 text-muted">LIVE PREVIEW</span></div>
                <div className="mt-4 flex items-end justify-between"><div><div className="caption text-[.61rem]">Due to Partner A</div><div className="font-mono text-[1.42rem] font-bold text-a">{money(model.pvShield)}</div></div><div className="text-right font-mono text-[.66rem] text-muted">on {money(model.shortfallA)}<br />basis shortfall</div></div>
                <div className="note">Annual lost deductions are valued year by year at {percent(taxRate)}, then discounted at {percent(discountRate)}. This result is already present value—do not discount it again.</div>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-5 card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex flex-wrap gap-3 justify-between bg-surface2"><div><div className="caption text-[.62rem]">D. Tax-year deduction</div><div className="font-serif text-[1.05rem] font-bold mt-0.5">Depreciation used for {taxYear}</div></div><div className="text-right"><div className="font-mono text-[1.15rem] font-bold text-yellow">{money(model.totalDepreciation)}</div><div className="font-mono text-[.6rem] uppercase tracking-[.07em] text-muted">Portfolio deduction</div></div></div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
            <Metric label="Partner A properties" value={money(ASSETS.filter(a => a.owner === 'a').reduce((sum, a) => sum + a.annualDepreciation, 0))} detail="Deductions that follow the proposed allocation" tone="a" />
            <Metric label="Partner B properties" value={money(ASSETS.filter(a => a.owner === 'b').reduce((sum, a) => sum + a.annualDepreciation, 0))} detail="Deductions that follow the proposed allocation" tone="b" />
            <Metric label="Items flagged for review" value="0" detail="All schedules have remaining life and annual deduction" tone="green" />
          </div>
        </section>
      </main>
    </div>
  );
}

function Setting({ label, value, suffix, onChange }: { label: string; value: string; suffix: string; onChange: (value: string) => void }) {
  return <label className="flex items-center gap-1.5 border-[1.5px] border-border rounded-[3px] bg-surface px-2.5 py-1.5"><span className="font-mono text-[.59rem] uppercase tracking-[.07em] text-muted">{label}</span><input value={value} onChange={e => onChange(e.target.value)} className="w-9 bg-transparent text-right outline-none font-mono text-[.74rem] font-bold" inputMode="decimal" />{suffix && <span className="font-mono text-[.68rem] text-muted">{suffix}</span>}</label>;
}

function AssetRow({ asset, taxYear, open, onToggle }: { asset: Asset; taxYear: number; open: boolean; onToggle: () => void }) {
  return <>
    <tr className="border-b border-border hover:bg-surface2/70 cursor-pointer" onClick={onToggle}>
      <td className="px-4 py-3"><div className="font-semibold">{asset.property}</div><div className="font-mono text-[.61rem] text-muted mt-0.5">{asset.entity}</div></td>
      <td className="px-3 py-3"><span className={`inline-flex font-mono text-[.61rem] font-bold uppercase tracking-[.06em] px-1.5 py-1 rounded ${asset.owner === 'a' ? 'bg-a-light text-a' : 'bg-b-light text-b'}`}>Partner {asset.owner.toUpperCase()}</span></td>
      <td className="px-3 py-3 text-right font-mono font-bold">{money(asset.remainingBasis)}</td><td className="px-3 py-3 text-right font-mono text-yellow font-bold">{money(asset.annualDepreciation)}</td>
      <td className="px-4 py-3 text-right font-mono text-muted">{asset.schedules.length} <span className="text-[.65rem]">{open ? '▴' : '▾'}</span></td>
    </tr>
    {open && <tr className="bg-surface2 border-b border-border"><td colSpan={5} className="px-4 py-3"><div className="ml-4 pl-3 border-l-2 border-border"><div className="grid grid-cols-[1fr_110px_90px_130px] gap-3 font-mono uppercase tracking-[.07em] text-[.58rem] text-muted mb-1.5"><span>Depreciable item</span><span className="text-right">Remaining basis</span><span className="text-right">Life left</span><span className="text-right">{taxYear} deduction</span></div>{asset.schedules.map(s => <div key={s.label} className="grid grid-cols-[1fr_110px_90px_130px] gap-3 font-mono text-[.7rem] py-1"><span>{s.label}</span><span className="text-right">{money(s.basis)}</span><span className="text-right">{s.years} yrs</span><span className="text-right text-yellow">{money(s.annual)}</span></div>)}</div></td></tr>}
  </>;
}

function Allocation({ partner, share, tone, target, actual }: { partner: string; share: string; tone: 'a' | 'b'; target: number; actual: number }) {
  const gap = target - actual;
  return <div className="p-4 border-b last:border-b-0 border-border"><div className="flex justify-between items-start"><div><div className={`font-bold ${tone === 'a' ? 'text-a' : 'text-b'}`}>{partner}</div><div className="font-mono text-[.61rem] uppercase tracking-[.06em] text-muted mt-0.5">{share}</div></div><div className={`font-mono text-[.76rem] font-bold ${gap > 0 ? 'text-a' : 'text-green'}`}>{gap > 0 ? 'Short' : 'Excess'} {money(Math.abs(gap))}</div></div><div className="mt-3 h-1.5 rounded bg-bg overflow-hidden"><div className={`h-full ${tone === 'a' ? 'bg-a' : 'bg-b'}`} style={{ width: `${Math.min(100, actual / target * 100)}%` }} /></div><div className="mt-2 flex justify-between font-mono text-[.64rem] text-muted"><span>Received <strong className="text-text">{money(actual)}</strong></span><span>Target <strong className="text-text">{money(target)}</strong></span></div></div>;
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'a' | 'b' | 'green' }) {
  const color = tone === 'a' ? 'text-a' : tone === 'b' ? 'text-b' : 'text-green';
  return <div className="p-4"><div className="caption text-[.61rem]">{label}</div><div className={`font-mono text-[1.15rem] font-bold mt-1 ${color}`}>{value}</div><div className="text-[.68rem] text-muted mt-1.5">{detail}</div></div>;
}
