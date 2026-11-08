import { useMemo, useState } from 'react';
import { computeMetrics, nv } from '../lib/finance';
import { useApp } from '../store/AppContext';
import type { TierAssignment } from '../store/reducer';
import type { Assignment, Property } from '../lib/types';

type TierValue = 0 | 1 | 2 | 3 | 4;
type TierSource = 'suggested' | 'auto' | 'override';
type SelectionUnit = { key: string; name: string; npvEquity: number; assignment: Assignment; members: number };
type PlacedUnit = SelectionUnit & { tier: TierValue; source: TierSource; needsRetiering: boolean };
type Tier = { number: 1 | 2 | 3 | 4; caption: string; units: PlacedUnit[] };

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const SAMPLE_UNITS: SelectionUnit[] = [
  { key: 'sample-1', name: 'Flagler Portfolio', npvEquity: 12_850_000, assignment: 'none', members: 2 },
  { key: 'sample-2', name: 'Douglas Road', npvEquity: 9_420_000, assignment: 'none', members: 1 },
  { key: 'sample-3', name: 'Menores Avenue', npvEquity: 7_760_000, assignment: 'none', members: 3 },
  { key: 'sample-4', name: 'Santillane Avenue', npvEquity: 5_980_000, assignment: 'none', members: 1 },
  { key: 'sample-5', name: 'SW 17th Court', npvEquity: 4_630_000, assignment: 'none', members: 1 },
  { key: 'sample-6', name: 'Coral Way', npvEquity: 3_240_000, assignment: 'none', members: 1 },
  { key: 'sample-7', name: 'Ponce de Leon', npvEquity: 2_180_000, assignment: 'none', members: 1 },
  { key: 'sample-8', name: 'West Avenue', npvEquity: 1_240_000, assignment: 'none', members: 1 },
];

function makeUnits(properties: readonly Property[], discountRate: number): SelectionUnit[] {
  const grouped = new Map<string, { name: string; properties: Property[] }>();
  for (const property of properties) {
    const group = property.groupName?.trim() ?? '';
    const key = group ? `group:${group}` : `property:${property.id}`;
    const current = grouped.get(key) ?? { name: group || property.name || `Untitled property ${property.id}`, properties: [] };
    current.properties.push(property);
    grouped.set(key, current);
  }
  return [...grouped.entries()].map(([key, group]) => {
    const assigned = new Set(group.properties.map((property) => property.assign));
    return { key, name: group.name, npvEquity: group.properties.reduce((sum, property) => sum + computeMetrics(property, discountRate).npvEquity, 0), assignment: assigned.size === 1 ? (group.properties[0]?.assign ?? 'none') : 'none', members: group.properties.length };
  }).sort((left, right) => right.npvEquity - left.npvEquity);
}

function tierDefinitions(count: 3 | 4): Array<{ number: 1 | 2 | 3 | 4; caption: string }> {
  return count === 4
    ? [{ number: 1, caption: 'Highest NPV Equity' }, { number: 2, caption: 'Upper-middle NPV Equity' }, { number: 3, caption: 'Lower-middle NPV Equity' }, { number: 4, caption: 'Lowest NPV Equity' }]
    : [{ number: 1, caption: 'Highest NPV Equity' }, { number: 2, caption: 'Middle NPV Equity' }, { number: 3, caption: 'Lowest NPV Equity' }];
}

function suggestedTiers(units: SelectionUnit[], count: 3 | 4): Map<string, TierValue> {
  const result = new Map<string, TierValue>();
  units.forEach((unit, index) => result.set(unit.key, Math.min(count, Math.floor((index * count) / Math.max(units.length, 1)) + 1) as TierValue));
  return result;
}

function buildTierPlan(units: SelectionUnit[], count: 3 | 4, assignments: Record<string, TierAssignment>) {
  const suggested = suggestedTiers(units, count);
  const tiers: Tier[] = tierDefinitions(count).map((definition) => ({ ...definition, units: [] }));
  const unplaced: PlacedUnit[] = [];
  for (const unit of units) {
    const saved = assignments[unit.key];
    const useSavedTier = Boolean(saved && (saved.manual || saved.tier <= count));
    const tier = useSavedTier ? saved!.tier : (suggested.get(unit.key) ?? 1);
    const placed: PlacedUnit = { ...unit, tier, source: useSavedTier && saved ? (saved.manual ? 'override' : 'auto') : 'suggested', needsRetiering: Boolean(saved?.manual && saved.tier > count) };
    if (tier === 0 || placed.needsRetiering) unplaced.push(placed);
    else tiers[tier - 1]?.units.push(placed);
  }
  return { tiers, unplaced, suggested };
}

/** Tier labels are persisted UI metadata only; they never change formulas or property assignments. */
export function TierAllocationMockup() {
  const { state, dispatch } = useApp();
  const [tierCount, setTierCount] = useState<3 | 4>(3);
  const [dragging, setDragging] = useState<string | null>(null);
  const discountRate = nv(state.discountRate) / 100;
  const loaded = state.properties.length > 0;
  const units = useMemo(() => loaded ? makeUnits(state.properties, discountRate) : SAMPLE_UNITS, [discountRate, loaded, state.properties]);
  const { tiers, unplaced, suggested } = useMemo(() => buildTierPlan(units, tierCount, state.tierAssignments), [tierCount, units, state.tierAssignments]);
  const names = { a: state.partnerNames.a || 'Partner A', b: state.partnerNames.b || 'Partner B' };
  const ownership = { a: state.pctA / 100, b: 1 - state.pctA / 100 };
  const setTier = (key: string, tier: TierValue, manual = true) => dispatch({ type: 'tier/set', key, assignment: { tier, manual } });
  const applySuggestions = () => dispatch({ type: 'tier/setMany', assignments: Object.fromEntries([...suggested.entries()].map(([key, tier]) => [key, { tier, manual: false }])) });

  return <main className="tier-allocation-readable min-h-[calc(100vh-110px)] bg-bg px-6 pb-6 pt-0"><div className="w-full">
    <div className="tier-allocation-sticky border-b-2 border-a pb-4 pt-6"><section className="flex flex-wrap items-end justify-between gap-5"><div><h2 className="font-serif text-[1.8rem] font-bold tracking-tight">Tier Allocation</h2><p className="mt-2 max-w-3xl text-[.82rem] leading-relaxed text-text2">Classify Groups and individual properties by NPV Equity before making any Partition assignment.</p></div><div className="card flex flex-wrap items-center gap-3 px-3 py-2"><span className="caption text-[.58rem]">Portfolio structure</span><div className="flex rounded-[3px] border border-border p-0.5">{([3, 4] as const).map((count) => <button key={count} type="button" onClick={() => setTierCount(count)} className={`rounded-[2px] px-3 py-1 font-mono text-[.68rem] font-bold uppercase tracking-[.08em] ${tierCount === count ? 'bg-a text-white' : 'text-muted hover:text-text'}`}>{count} tiers</button>)}</div><button type="button" onClick={applySuggestions} className="tool-btn tool-btn-primary text-[.62rem]">✦ Apply NPV suggestions</button></div></section><section className={`mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 ${tierCount === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>{tiers.map((tier) => <TierTargetsAbove key={tier.number} tier={tier} names={names} ownership={ownership} />)}</section></div>
    {!loaded && <div className="note mt-5 border-l-yellow">Illustrative properties are shown until the Partition Tool has loaded property data. You can try labeling and dragging these examples; loaded properties use the same controls.</div>}
    {unplaced.length > 0 && <section onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragging) setTier(dragging, 0); setDragging(null); }} className="mt-5 rounded-[5px] border border-dashed border-border2 bg-surface2 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="caption text-[.56rem]">Unassigned or needs re-tiering</div><p className="mt-1 text-[.7rem] text-muted2">Choose a tier from the property card or drag the card into a tier column.</p></div><div className="flex flex-wrap gap-2">{unplaced.map((unit) => <UnitChip key={unit.key} unit={unit} tierCount={tierCount} names={names} dragging={dragging} onDragStart={setDragging} onSetTier={setTier} />)}</div></div></section>}
    <section className={`mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 ${tierCount === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>{tiers.map((tier) => <TierCard key={tier.number} tier={tier} tierCount={tierCount} names={names} ownership={ownership} dragging={dragging} onDragStart={setDragging} onDrop={(key) => setTier(key, tier.number)} onSetTier={setTier} />)}</section>
    <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3"><SummaryCard label="Portfolio NPV Equity" value={money(units.reduce((sum, unit) => sum + unit.npvEquity, 0))} detail={`${units.length} selection ${units.length === 1 ? 'unit' : 'units'} · ${tierCount}-tier planning view`} /><SummaryCard label={`${names.a} target`} value={`${Math.round(ownership.a * 100)}%`} detail="Applied inside each tier and across the full portfolio" tone="a" /><SummaryCard label={`${names.b} target`} value={`${Math.round(ownership.b * 100)}%`} detail="Cash settlement resolves the remaining feasible difference" tone="b" /></section>
  </div></main>;
}

function TierCard({ tier, tierCount, names, ownership, dragging, onDragStart, onDrop, onSetTier }: { tier: Tier; tierCount: 3 | 4; names: Record<'a' | 'b', string>; ownership: Record<'a' | 'b', number>; dragging: string | null; onDragStart: (key: string | null) => void; onDrop: (key: string) => void; onSetTier: (key: string, tier: TierValue) => void }) {
  const total = tier.units.reduce((sum, unit) => sum + unit.npvEquity, 0);
  return <article onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragging) onDrop(dragging); onDragStart(null); }} className={`card min-w-0 overflow-hidden transition-colors ${dragging ? 'ring-1 ring-dashed ring-a' : ''}`}><header className="border-b border-border bg-surface2 px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="caption text-[.56rem]">Tier {tier.number} of {tierCount}</div><h3 className="mt-0.5 font-serif text-[1.08rem] font-bold">{tier.caption}</h3></div><div className="text-right"><div className="caption text-[.52rem]">Tier total</div><div className="font-mono text-[.88rem] font-bold text-a">{money(total)}</div></div></div></header><div className="min-h-28 divide-y divide-border">{tier.units.length === 0 ? <div className="px-4 py-6 text-[.7rem] text-muted">Drop a Group or property here.</div> : tier.units.map((unit) => <UnitCard key={unit.key} unit={unit} tierCount={tierCount} names={names} ownership={ownership} dragging={dragging} onDragStart={onDragStart} onSetTier={onSetTier} />)}</div></article>;
}

function UnitCard({ unit, tierCount, names, ownership, dragging, onDragStart, onSetTier }: { unit: PlacedUnit; tierCount: 3 | 4; names: Record<'a' | 'b', string>; ownership: Record<'a' | 'b', number>; dragging: string | null; onDragStart: (key: string | null) => void; onSetTier: (key: string, tier: TierValue) => void }) {
  return <div draggable onDragStart={() => onDragStart(unit.key)} onDragEnd={() => onDragStart(null)} className={`cursor-grab px-4 py-3 active:cursor-grabbing ${dragging === unit.key ? 'opacity-45' : ''}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><div className="text-[.77rem] font-semibold">{unit.name}</div><TierBadge unit={unit} /></div><div className="mt-0.5 font-mono text-[.58rem] uppercase tracking-[.06em] text-muted">{unit.members > 1 ? `${unit.members} grouped properties` : 'Individual property'} · {unit.assignment === 'none' ? 'Current allocation: unassigned' : `Current allocation: ${unit.assignment === 'a' ? names.a : names.b}`}</div></div><div className="shrink-0 font-mono text-[.72rem] font-bold text-text2">{money(unit.npvEquity)}</div></div><div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[.56rem] uppercase tracking-[.05em] text-muted"><span>NPV Equity: <b className="normal-case tracking-normal text-text2">{money(unit.npvEquity)}</b></span><span>{names.a} target: <b className="normal-case tracking-normal text-a">{money(unit.npvEquity * ownership.a)}</b></span><span>{names.b} target: <b className="normal-case tracking-normal text-b">{money(unit.npvEquity * ownership.b)}</b></span></div><TierSelect value={unit.needsRetiering ? 0 : unit.tier} count={tierCount} onChange={(tier) => onSetTier(unit.key, tier)} /></div>;
}

function UnitChip({ unit, tierCount, names, dragging, onDragStart, onSetTier }: { unit: PlacedUnit; tierCount: 3 | 4; names: Record<'a' | 'b', string>; dragging: string | null; onDragStart: (key: string | null) => void; onSetTier: (key: string, tier: TierValue) => void }) {
  return <div draggable onDragStart={() => onDragStart(unit.key)} onDragEnd={() => onDragStart(null)} className={`rounded-[3px] border border-border bg-surface px-2.5 py-2 ${dragging === unit.key ? 'opacity-45' : ''}`}><div className="flex items-center gap-2"><div className="max-w-40 truncate text-[.68rem] font-semibold">{unit.name}</div><TierBadge unit={unit} /></div><div className="mt-1"><TierSelect value={unit.needsRetiering ? 0 : unit.tier} count={tierCount} onChange={(tier) => onSetTier(unit.key, tier)} /></div><span className="sr-only">{names.a} and {names.b} tier planning unit</span></div>;
}

function TierBadge({ unit }: { unit: PlacedUnit }) {
  const label = unit.needsRetiering ? `Tier ${unit.tier} · re-tier` : unit.tier === 0 ? 'Unassigned' : `Tier ${unit.tier}`;
  const source = unit.source === 'override' ? 'Override' : unit.source === 'auto' ? 'Auto' : 'Suggested';
  return <span className={`rounded px-1.5 py-0.5 font-mono text-[.51rem] font-bold uppercase tracking-[.05em] ${unit.source === 'override' ? 'bg-a text-white' : 'bg-surface2 text-muted2'}`}>{label} · {source}</span>;
}

function TierSelect({ value, count, onChange }: { value: TierValue; count: 3 | 4; onChange: (tier: TierValue) => void }) {
  return <label className="mt-2 flex items-center gap-2 font-mono text-[.56rem] uppercase tracking-[.06em] text-muted">Tier <select aria-label="Tier label" value={value} onChange={(event) => onChange(Number(event.target.value) as TierValue)} className="rounded border border-border bg-surface px-1.5 py-1 font-mono text-[.62rem] font-bold normal-case tracking-normal text-text outline-none focus:border-a"><option value={0}>Unassigned</option>{Array.from({ length: count }, (_, index) => <option key={index + 1} value={index + 1}>Tier {index + 1}</option>)}</select></label>;
}

function TierTargetsAbove({ tier, names, ownership }: { tier: Tier; names: Record<'a' | 'b', string>; ownership: Record<'a' | 'b', number> }) {
  const total = tier.units.reduce((sum, unit) => sum + unit.npvEquity, 0);
  const assigned = { a: tier.units.filter((unit) => unit.assignment === 'a').reduce((sum, unit) => sum + unit.npvEquity, 0), b: tier.units.filter((unit) => unit.assignment === 'b').reduce((sum, unit) => sum + unit.npvEquity, 0) };
  return <section className="rounded-[5px] border-[1.5px] border-border bg-surface px-3 py-2.5 shadow-card"><div className="flex items-center justify-between gap-2"><div className="caption text-[.53rem]">Tier {tier.number} targets</div><div className="font-mono text-[.62rem] font-bold text-muted">{money(total)}</div></div><div className="mt-2 grid grid-cols-2 gap-2"><TargetBox name={names.a} target={total * ownership.a} current={assigned.a} tone="a" /><TargetBox name={names.b} target={total * ownership.b} current={assigned.b} tone="b" /></div></section>;
}

function TargetBox({ name, target, current, tone }: { name: string; target: number; current: number; tone: 'a' | 'b' }) {
  const border = tone === 'a' ? 'border-a bg-a-light' : 'border-b bg-b-light';
  const color = tone === 'a' ? 'text-a' : 'text-b';
  const remaining = target - current;
  return <div className={`min-w-0 rounded-[3px] border px-2 py-1.5 ${border}`}><div className="truncate font-mono text-[.5rem] font-bold uppercase tracking-[.05em] text-text2">{name} target</div><div className={`mt-0.5 truncate font-mono text-[.7rem] font-bold ${color}`}>{money(target)}</div><div className="mt-1 border-t border-border/70 pt-1 font-mono text-[.5rem] leading-relaxed text-muted2">Current: <b className="text-text2">{money(current)}</b><br />{remaining >= 0 ? <>Remaining: <b className={color}>{money(remaining)}</b></> : <>Over target: <b className="text-red">{money(Math.abs(remaining))}</b></>}</div></div>;
}

function SummaryCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: 'a' | 'b' }) {
  return <div className="card px-5 py-4"><div className="caption text-[.57rem]">{label}</div><div className={`mt-1 font-mono text-[1.15rem] font-bold ${tone === 'a' ? 'text-a' : tone === 'b' ? 'text-b' : 'text-text'}`}>{value}</div><p className="mt-1 text-[.66rem] text-muted2">{detail}</p></div>;
}
