import { useState } from 'react';
import { useApp } from '../store/AppContext';

type DepreciationMethod = 'Cost segregation' | 'Straight-line';

type ScheduleItem = {
  label: string;
  method: DepreciationMethod;
  basis: number;
  recoveryPeriod: string;
  yearsLeft: number;
  annual: number;
};

type PropertySchedule = {
  property: string;
  entity: string;
  source: string;
  schedules: ScheduleItem[];
};

/* Illustrative rows only — the finished importer will create these from the partnership return's fixed-asset detail. */
const PROPERTIES: PropertySchedule[] = [
  {
    property: 'Juniper Commons', entity: 'JCP Holdings LP', source: 'Form 4562 · Fixed asset detail',
    schedules: [
      { label: 'Residential building', method: 'Straight-line', basis: 4_100_000, recoveryPeriod: '27.5 yrs', yearsLeft: 22, annual: 151_000 },
      { label: 'Tenant improvements', method: 'Straight-line', basis: 760_000, recoveryPeriod: '15 yrs', yearsLeft: 6, annual: 25_400 },
    ],
  },
  {
    property: 'Old Mill Lofts', entity: 'Mill Portfolio LLC', source: 'Form 4562 · Fixed asset detail',
    schedules: [{ label: 'Residential building', method: 'Straight-line', basis: 1_000_000, recoveryPeriod: '27.5 yrs', yearsLeft: 19, annual: 53_000 }],
  },
  {
    property: 'Cedar Row', entity: 'Cedar Development LP', source: 'Cost segregation study · 2023',
    schedules: [
      { label: 'Building structure', method: 'Straight-line', basis: 440_000, recoveryPeriod: '27.5 yrs', yearsLeft: 16, annual: 20_000 },
      { label: 'Land improvements', method: 'Cost segregation', basis: 120_000, recoveryPeriod: '15 yrs', yearsLeft: 8, annual: 9_000 },
      { label: 'Personal property', method: 'Cost segregation', basis: 60_000, recoveryPeriod: '5 yrs', yearsLeft: 2, annual: 5_000 },
    ],
  },
  {
    property: 'River Station', entity: 'River Station LLC', source: 'Cost segregation study · 2022',
    schedules: [
      { label: 'Building structure', method: 'Straight-line', basis: 2_830_000, recoveryPeriod: '27.5 yrs', yearsLeft: 20, annual: 106_000 },
      { label: 'Land improvements', method: 'Cost segregation', basis: 310_000, recoveryPeriod: '15 yrs', yearsLeft: 9, annual: 11_000 },
      { label: 'Equipment & fixtures', method: 'Cost segregation', basis: 180_000, recoveryPeriod: '5 yrs', yearsLeft: 3, annual: 7_000 },
    ],
  },
  {
    property: 'Lakeview Center', entity: 'Lakeview Properties LP', source: 'Form 4562 · Fixed asset detail',
    schedules: [{ label: 'Commercial building', method: 'Straight-line', basis: 1_200_000, recoveryPeriod: '39 yrs', yearsLeft: 18, annual: 61_500 }],
  },
];

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(value);

/** Step 1 companion tool: capture property schedules for export to the completed partition workspace. */
export function TaxBasisMockup({ onOpenPartition }: { onOpenPartition: () => void }) {
  const { state, dispatch } = useApp();
  const [taxYear, setTaxYear] = useState(2026);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-hdr-bg border-b-[3px] border-a px-7 py-[13px]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-[1.15rem] font-bold text-hdr-text">Real Estate Partition Tool</h1>
            <span className="font-mono text-[0.57rem] tracking-[0.1em] uppercase text-hdr-accent border border-hdr-input-brd rounded px-1.5 py-0.5">Step 1 · Input tool</span>
          </div>
          <div className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-hdr-accent mt-1">Tax Basis Schedule · Per-Property Depreciation Detail</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="font-mono text-[0.68rem] uppercase tracking-[0.07em] text-hdr-muted hover:text-white cursor-pointer" onClick={onOpenPartition}>Open Partition workspace →</button>
          <div className="flex overflow-hidden rounded bg-hdr-input-bg border border-hdr-input-brd" role="group" aria-label="Theme">
            {(['light', 'dark'] as const).map((theme) => <button key={theme} type="button" onClick={() => dispatch({ type: 'theme/set', theme })} className={`font-mono text-[0.62rem] tracking-[0.08em] uppercase px-[11px] py-[5px] cursor-pointer ${state.theme === theme ? 'bg-a text-white' : 'text-hdr-muted'}`}>{theme === 'light' ? '☼ Light' : '☾ Dark'}</button>)}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 bg-surface border-b border-border px-7 py-2.5">
        <button className="tool-btn tool-btn-primary">↑ Import partnership tax return (PDF)</button>
        <button className="tool-btn">+ Add depreciation detail / cost seg report</button>
        <button className="tool-btn">⇧ Send property basis to Partition Tool</button>
        <span className="ml-auto font-mono text-[0.65rem] uppercase tracking-[0.08em] text-green font-bold">● Ready to export</span>
      </div>

      <main className="max-w-[1450px] mx-auto px-6 py-5">
        <div className="flex flex-wrap justify-between items-end gap-4 mb-5">
          <div>
            <div className="caption text-[0.66rem] mb-1">Tax return schedule capture</div>
            <h2 className="font-serif text-[1.55rem] font-bold">Remaining Depreciation by Property</h2>
            <p className="mt-1 text-[0.78rem] text-muted max-w-3xl">Enter or import each property’s remaining depreciable components exactly as they appear in the partnership fixed-asset detail. Cost-segregation and straight-line items stay separate.</p>
          </div>
          <label className="flex items-center gap-1.5 border-[1.5px] border-border rounded-[3px] bg-surface px-2.5 py-1.5"><span className="font-mono text-[.59rem] uppercase tracking-[.07em] text-muted">Tax year</span><input value={taxYear} onChange={e => setTaxYear(Number(e.target.value) || 2026)} className="w-11 bg-transparent text-right outline-none font-mono text-[.74rem] font-bold" inputMode="numeric" /></label>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {PROPERTIES.map((property) => <PropertyScheduleCard key={property.property} property={property} taxYear={taxYear} />)}
          <button className="min-h-[166px] border-[1.5px] border-dashed border-border2 rounded-[5px] text-muted hover:text-a hover:border-a transition-colors cursor-pointer flex flex-col items-center justify-center gap-2"><span className="font-serif text-[1.6rem] leading-none">+</span><span className="font-mono text-[.7rem] font-bold uppercase tracking-[.08em]">Add property schedule</span><span className="text-[.7rem]">Add its remaining depreciation components</span></button>
        </div>

        <div className="mt-5 note max-w-5xl">This page records the source schedule only. It does not assign properties, compare partners, or calculate a settlement. When exported, each property supplies its <strong>Remaining Tax Basis</strong> and <strong>Depreciation {taxYear}</strong> to the completed Partition Tool.</div>
      </main>
    </div>
  );
}

function PropertyScheduleCard({ property, taxYear }: { property: PropertySchedule; taxYear: number }) {
  const hasCostSeg = property.schedules.some((item) => item.method === 'Cost segregation');
  const remainingBasis = property.schedules.reduce((sum, item) => sum + item.basis, 0);
  const taxYearDepreciation = property.schedules.reduce((sum, item) => sum + item.annual, 0);

  return <article className="card overflow-hidden">
    <header className="px-4 py-3 bg-surface2 border-b border-border flex flex-wrap justify-between gap-3 items-start">
      <div><h3 className="font-serif text-[1.08rem] font-bold">{property.property}</h3><div className="font-mono text-[.61rem] uppercase tracking-[.07em] text-muted mt-1">{property.entity} · {property.source}</div></div>
      <span className={`font-mono text-[.59rem] uppercase tracking-[.06em] rounded px-1.5 py-1 ${hasCostSeg ? 'bg-a-light text-a' : 'bg-surface border border-border text-muted'}`}>{hasCostSeg ? 'Cost seg included' : 'Straight-line only'}</span>
    </header>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[610px] text-[.73rem]">
        <thead className="font-mono uppercase tracking-[.07em] text-[.58rem] text-muted border-b border-border"><tr><th className="text-left px-4 py-2.5">Depreciable component</th><th className="text-left px-3 py-2.5">Method</th><th className="text-right px-3 py-2.5">Basis left</th><th className="text-right px-3 py-2.5">Recovery / left</th><th className="text-right px-4 py-2.5">{taxYear} deduction</th></tr></thead>
        <tbody>{property.schedules.map((item) => <tr key={item.label} className="border-b last:border-b-0 border-border"><td className="px-4 py-3 font-semibold">{item.label}</td><td className="px-3 py-3"><span className={`font-mono text-[.58rem] uppercase tracking-[.04em] ${item.method === 'Cost segregation' ? 'text-a font-bold' : 'text-muted'}`}>{item.method}</span></td><td className="px-3 py-3 text-right font-mono font-bold">{money(item.basis)}</td><td className="px-3 py-3 text-right font-mono text-muted">{item.recoveryPeriod} / {item.yearsLeft} yrs</td><td className="px-4 py-3 text-right font-mono font-bold text-yellow">{money(item.annual)}</td></tr>)}</tbody>
        <tfoot className="bg-surface2 border-t-[1.5px] border-border"><tr><td colSpan={2} className="px-4 py-3 font-mono text-[.57rem] uppercase tracking-[.07em] text-muted">Property totals → Partition Tool</td><td className="px-3 py-3 text-right font-mono text-[1rem] font-bold text-a">{money(remainingBasis)}</td><td /><td className="px-4 py-3 text-right font-mono text-[1rem] font-bold text-yellow">{money(taxYearDepreciation)}</td></tr></tfoot>
      </table>
    </div>
  </article>;
}
