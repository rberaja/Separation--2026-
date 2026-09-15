import { useApp, useSortedProperties } from '../store/AppContext';
import { PropertyCard } from './PropertyCard';
import { SectionHeading } from './ui/SectionHeading';
import { fmtMoney } from '../lib/format';
import type { Property } from '../lib/types';

export function PropertyList() {
  const { dispatch } = useApp();
  const properties = useSortedProperties();

  return (
    <section>
      <SectionHeading
        action={
          <button
            type="button"
            className="tool-btn text-[0.6rem] tracking-[0.1em] px-2.5 py-1 hover:bg-surface2"
            onClick={() => dispatch({ type: 'property/add' })}
          >
            + Add Property
          </button>
        }
      >
        A. Properties
      </SectionHeading>

      {properties.length === 0 ? (
        <div className="text-center px-5 py-11 text-muted2 font-mono text-[0.73rem] tracking-[0.04em] leading-loose">
          No properties yet.
          <br />
          Upload an Excel file above, or click <strong>+ Add Property</strong>.
        </div>
      ) : (
        <GroupedPropertyList properties={properties} />
      )}
    </section>
  );
}

/** Groups are presentation-only summaries: their member properties remain the only values in the settlement math. */
function GroupedPropertyList({ properties }: { properties: Property[] }) {
  const groups = new Map<string, Property[]>();
  const individual: Property[] = [];
  for (const property of properties) {
    const name = property.groupName.trim();
    if (!name) individual.push(property);
    else groups.set(name, [...(groups.get(name) ?? []), property]);
  }
  return <div className="flex flex-col gap-[11px]">
    {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([name, members]) => <PartitionGroup key={name} name={name} members={members} />)}
    {individual.map((property) => <PropertyCard key={property.id} property={property} />)}
  </div>;
}

function PartitionGroup({ name, members }: { name: string; members: Property[] }) {
  const sum = (field: 'marketVal' | 'capex' | 'loanBal' | 'remainingBasis' | 'depreciation') => members.reduce((total, property) => total + (property[field] ?? 0), 0);
  const unique = (field: 'zoning' | 'cert40yr') => [...new Set(members.map((property) => property[field].trim()).filter(Boolean))].join(' · ') || '—';
  return <section className="card overflow-hidden border-l-4 border-l-a">
    <header className="px-3 py-2.5 border-b border-border bg-surface2 flex flex-wrap items-start justify-between gap-3">
      <div><div className="font-mono uppercase text-[.62rem] tracking-[.07em] text-muted">Grouped selection unit · {members.length} properties</div><h3 className="font-serif text-[1.08rem] font-bold mt-1">{name}</h3><div className="mt-1 font-mono text-[.61rem] text-muted"><span>Zoning: {unique('zoning')}</span><span className="ml-3">Next 40-Yr Certification: {unique('cert40yr')}</span></div></div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-right font-mono text-[.67rem]"><GroupMetric label="Market Value" value={fmtMoney(sum('marketVal'))} /><GroupMetric label="CapEx" value={fmtMoney(sum('capex'))} /><GroupMetric label="Loan Balance" value={fmtMoney(sum('loanBal'))} /><GroupMetric label="Remaining Basis" value={fmtMoney(sum('remainingBasis'))} /><GroupMetric label="Depreciation" value={fmtMoney(sum('depreciation'))} /></div>
    </header>
    <div className="p-3 bg-bg flex flex-col gap-[11px]">{members.map((property) => <PropertyCard key={property.id} property={property} />)}</div>
  </section>;
}

function GroupMetric({ label, value }: { label: string; value: string }) { return <div><div className="uppercase text-[.55rem] tracking-[.06em] text-muted">{label}</div><div className="font-bold text-a mt-0.5">{value}</div></div>; }
