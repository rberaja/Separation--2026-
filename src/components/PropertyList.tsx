import { useApp, useDiscountRate, usePartnerNames, useSortedProperties } from '../store/AppContext';
import { PropertyCard } from './PropertyCard';
import { SectionHeading } from './ui/SectionHeading';
import { computeMetrics, nv } from '../lib/finance';
import { fmtMoney } from '../lib/format';
import { PARTNERS, type Assignment, type Partner, type Property } from '../lib/types';

const ASSIGN_BORDER: Record<Assignment, string> = { none: 'border-l-border2', a: 'border-l-a', b: 'border-l-b' };
const ASSIGN_BTN: Record<Partner, string> = { a: 'bg-a border-a text-white', b: 'bg-b border-b text-white' };

export function PropertyList() {
  const { state, dispatch } = useApp();
  const properties = useSortedProperties();
  const collapsed = new Set(state.collapsedSelectionUnits);
  const toggleCollapsed = (key: string) => dispatch({ type: 'selectionUnits/toggleCollapsed', key });

  return (
    <section>
      <SectionHeading>A. Properties</SectionHeading>

      {properties.length === 0 ? (
        <div className="text-center px-5 py-11 text-muted2 font-mono text-[0.73rem] tracking-[0.04em] leading-loose">
          No properties yet.
          <br />
          Upload property data from the Data workspace to display it here.
        </div>
      ) : (
        <GroupedPropertyList properties={properties} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      )}
    </section>
  );
}

/** Groups are presentation-only summaries: their member properties remain the only values in the settlement math. */
function GroupedPropertyList({ properties, collapsed, onToggleCollapsed }: { properties: Property[]; collapsed: Set<string>; onToggleCollapsed: (key: string) => void }) {
  const groups = new Map<string, Property[]>();
  const individual: Property[] = [];
  for (const property of properties) {
    const name = property.groupName.trim();
    if (!name) individual.push(property);
    else groups.set(name, [...(groups.get(name) ?? []), property]);
  }
  return <div className="flex flex-col gap-[11px]">
    {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([name, members]) => <PartitionGroup key={name} name={name} members={members} collapsed={collapsed.has(`group:${name}`)} onToggleCollapsed={() => onToggleCollapsed(`group:${name}`)} />)}
    {individual.map((property) => <PropertyCard key={property.id} property={property} collapsed={collapsed.has(`property:${property.id}`)} onToggleCollapsed={() => onToggleCollapsed(`property:${property.id}`)} />)}
  </div>;
}

function PartitionGroup({ name, members, collapsed, onToggleCollapsed }: { name: string; members: Property[]; collapsed: boolean; onToggleCollapsed: () => void }) {
  const { dispatch } = useApp();
  const names = usePartnerNames();
  const discountRate = useDiscountRate();
  const assignment: Assignment = members.every((property) => property.assign === members[0]?.assign) ? members[0]?.assign ?? 'none' : 'none';
  const totals = members.reduce((total, property) => {
    const metrics = computeMetrics(property, discountRate);
    return {
      adjustedValue: total.adjustedValue + metrics.amv,
      debtNpv: total.debtNpv + metrics.debtNpv,
      equityNpv: total.equityNpv + metrics.npvEquity,
      cashFlow: total.cashFlow + metrics.ncf,
      remainingBasis: total.remainingBasis + nv(property.remainingBasis),
    };
  }, { adjustedValue: 0, debtNpv: 0, equityNpv: 0, cashFlow: 0, remainingBasis: 0 });
  const unique = (field: 'zoning' | 'cert40yr') => [...new Set(members.map((property) => property[field].trim()).filter(Boolean))].join(' · ') || '—';
  return <section className={`card overflow-hidden border-l-4 ${ASSIGN_BORDER[assignment]}`}>
    <header className="px-3 py-2.5 border-b border-border bg-surface2 flex flex-wrap items-start justify-between gap-3">
      <div><div className="font-mono uppercase text-[.62rem] tracking-[.07em] text-muted">Grouped selection unit · {members.length} properties</div><h3 className="font-serif text-[1.08rem] font-bold mt-1">{name}</h3><div className="mt-1 font-mono text-[.61rem] text-muted"><span>Zoning: {unique('zoning')}</span><span className="ml-3">Next 40-Yr Certification: {unique('cert40yr')}</span></div></div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-right font-mono text-[.67rem]">
        <GroupMetric label="Net Present Value Equity" value={fmtMoney(totals.equityNpv)} />
        <GroupMetric label="Adjusted Value" value={fmtMoney(totals.adjustedValue)} />
        <GroupMetric label="Net Present Value Debt" value={fmtMoney(totals.debtNpv)} />
        <GroupMetric label="Net Present Value Equity" value={fmtMoney(totals.equityNpv)} />
        <GroupMetric label="Cash Flow" value={fmtMoney(totals.cashFlow)} />
        <GroupMetric label="Remaining Tax Basis" value={fmtMoney(totals.remainingBasis)} />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-[3px]" role="group" aria-label={`Assign ${name} to partner`}>
          {PARTNERS.map((partner) => <button key={partner} type="button" aria-pressed={assignment === partner} onClick={() => dispatch({ type: 'properties/assign', ids: members.map((property) => property.id), partner: assignment === partner ? 'none' : partner })} className={`px-2 py-[3px] rounded-[3px] border-[1.5px] font-mono text-[0.6rem] tracking-[0.05em] font-semibold cursor-pointer transition-all duration-100 ${assignment === partner ? ASSIGN_BTN[partner] : 'border-border bg-transparent text-muted'}`}>{names[partner].split(' ')[0]}</button>)}
        </div>
        <button type="button" className="font-mono text-[.61rem] text-muted hover:text-text cursor-pointer" aria-expanded={!collapsed} onClick={onToggleCollapsed}>{collapsed ? '▾ Expand' : '▴ Collapse'}</button>
      </div>
    </header>
    {!collapsed && <div className="p-3 bg-bg flex flex-col gap-[11px]">{members.map((property) => <PropertyCard key={property.id} property={property} showAssignment={false} />)}</div>}
  </section>;
}

function GroupMetric({ label, value }: { label: string; value: string }) { return <div className="text-center"><div className="uppercase text-[.55rem] tracking-[.06em] text-muted">{label}</div><div className="font-bold text-a mt-0.5">{value}</div></div>; }
