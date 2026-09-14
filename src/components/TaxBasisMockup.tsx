import { useRef, useState, type ChangeEvent } from 'react';
import type { GroupMember } from '../lib/groups-excel';
import type { ExtractedMethod } from '../lib/tax-return-pdf';
import { useApp } from '../store/AppContext';

type ScheduleItem = { id: string; label: string; method: ExtractedMethod; basis: number; recoveryPeriod: string; yearsLeft: number; annual: number };
type PropertySchedule = { id: string; property: string; entity: string; source: string; schedules: ScheduleItem[] };
type DealGroup = { id: string; name: string; members: GroupMember[] };
type Tab = 'groups' | 'data';
type GroupsSortKey = 'name' | 'zoning' | 'cert40yr';

let nextLocalId = 1;
const makeId = (kind: string) => `${kind}-${nextLocalId++}`;
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const numeric = (value: string) => Math.max(0, Number(value.replace(/[^\d.]/g, '')) || 0);
const totals = (properties: PropertySchedule[]) => ({ basis: properties.reduce((sum, property) => sum + property.schedules.reduce((total, item) => total + item.basis, 0), 0), depreciation: properties.reduce((sum, property) => sum + property.schedules.reduce((total, item) => total + item.annual, 0), 0) });
/** Normalizes common address variations between the Groups workbook and tax-return schedules. */
const propertyKey = (value: string) => value
  .toLocaleUpperCase()
  .replace(/\b(\d+)(?:ST|ND|RD|TH)\b/g, '$1')
  .replace(/\bAVENUE\b/g, 'AVE')
  .replace(/\bSTREET\b/g, 'ST')
  .replace(/\bBOULEVARD\b/g, 'BLVD')
  .replace(/\bDRIVE\b/g, 'DR')
  .replace(/\bROAD\b/g, 'RD')
  .replace(/\bNORTH\b/g, 'N')
  .replace(/\bSOUTH\b/g, 'S')
  .replace(/\bEAST\b/g, 'E')
  .replace(/\bWEST\b/g, 'W')
  .replace(/[^A-Z0-9]/g, '');
const propertyMatches = (workbookProperty: string, taxReturnProperty: string) => {
  const workbookKey = propertyKey(workbookProperty);
  const taxReturnKey = propertyKey(taxReturnProperty);
  if (!workbookKey || !taxReturnKey) return false;
  if (workbookKey === taxReturnKey) return true;
  const [shorter, longer] = workbookKey.length <= taxReturnKey.length ? [workbookKey, taxReturnKey] : [taxReturnKey, workbookKey];
  return shorter.length >= 8 && longer.startsWith(shorter);
};
const hasMember = (group: DealGroup, property: PropertySchedule) => group.members.some((member) => propertyMatches(member.property, property.property));

function groupAssignments(groups: DealGroup[], properties: PropertySchedule[]) {
  const assignments = new Map<string, string>();
  for (const group of groups) for (const property of properties) if (!assignments.has(property.id) && hasMember(group, property)) assignments.set(property.id, group.id);
  return assignments;
}

/** Two-stage workflow: define deal groups first, then import and inspect property-level tax schedules. */
export function TaxBasisMockup() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('groups');
  const [taxYear, setTaxYear] = useState(state.depreciationYear);
  const [properties, setProperties] = useState<PropertySchedule[]>([]);
  const [groups, setGroups] = useState<DealGroup[]>([]);
  const [groupWorkbook, setGroupWorkbook] = useState<{ name: string; individualProperties: GroupMember[] } | null>(null);
  const [documents, setDocuments] = useState<string[]>([]);
  const [notice, setNotice] = useState('Set up deal groups, then upload the partnership tax returns.');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [collapsedProperties, setCollapsedProperties] = useState<Set<string>>(new Set());
  const [groupsSort, setGroupsSort] = useState<{ key: GroupsSortKey; asc: boolean }>({ key: 'name', asc: true });
  const [groupsOutputOpen, setGroupsOutputOpen] = useState(false);
  const returnFileRef = useRef<HTMLInputElement>(null);
  const groupsFileRef = useRef<HTMLInputElement>(null);

  const updateProperty = (id: string, patch: Partial<Omit<PropertySchedule, 'id' | 'schedules'>>) => setProperties((current) => current.map((property) => property.id === id ? { ...property, ...patch } : property));
  const updateComponent = (propertyId: string, componentId: string, patch: Partial<ScheduleItem>) => setProperties((current) => current.map((property) => property.id === propertyId ? { ...property, schedules: property.schedules.map((component) => component.id === componentId ? { ...component, ...patch } : component) } : property));
  const updateGroup = (id: string, patch: Partial<DealGroup>) => setGroups((current) => current.map((group) => group.id === id ? { ...group, ...patch } : group));
  const removeGroup = (id: string) => setGroups((current) => current.filter((group) => group.id !== id));

  const handleGroupsFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const { parseGroupsWorkbook } = await import('../lib/groups-excel');
      const imported = parseGroupsWorkbook(await file.arrayBuffer());
      setGroups(imported.groups.map((group) => ({ id: makeId('group'), ...group })));
      setGroupWorkbook({ name: file.name, individualProperties: imported.individualProperties });
      setNotice(`Loaded ${imported.groups.length} groups from ${file.name}. ${imported.individualProperties.length} properties will remain individual selection units.`);
      setActiveTab('groups');
    } catch (error) { setNotice(`Could not read the Groups workbook: ${error instanceof Error ? error.message : String(error)}`); }
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!files.length) return;
    setIsImporting(true); setWarnings([]); setNotice(`Reading ${files.length} tax ${files.length === 1 ? 'return' : 'returns'} locally…`);
    try {
      const { extractTaxReturnSchedules } = await import('../lib/tax-return-pdf');
      const result = await extractTaxReturnSchedules(files);
      const extracted = result.schedules.map((schedule) => ({ id: makeId('property'), property: schedule.property, entity: schedule.entity, source: schedule.source, schedules: schedule.schedules.map((component) => ({ ...component, id: makeId('component') })) }));
      setProperties(extracted);
      setDocuments(result.sourceFiles); setWarnings(result.warnings); setActiveTab('data');
      setNotice(extracted.length ? `Extracted ${extracted.length} property ${extracted.length === 1 ? 'schedule' : 'schedules'}. Group membership is matched from the Groups workbook.` : 'No property depreciation schedules could be extracted from the selected PDFs.');
    } catch (error) { setNotice(`Could not read the selected return: ${error instanceof Error ? error.message : String(error)}`); }
    finally { setIsImporting(false); }
  };

  const exportToPartition = () => {
    const assignments = groupAssignments(groups, properties);
    const groupedIds = new Set(assignments.keys());
    const units = [
      ...groups.map((group) => ({ name: group.name.trim(), properties: properties.filter((property) => assignments.get(property.id) === group.id) })).filter((unit) => unit.name && unit.properties.length),
      ...properties.filter((property) => !groupedIds.has(property.id)).map((property) => ({ name: property.property.trim(), properties: [property] })).filter((unit) => unit.name),
    ];
    if (!units.length) { setNotice('Upload property schedules before sending grouped totals to the Partition Tool.'); return; }
    dispatch({ type: 'settings/depreciationYear', value: taxYear });
    for (const unit of units) {
      const total = totals(unit.properties);
      const match = state.properties.find((property) => property.name.trim().toLocaleLowerCase() === unit.name.toLocaleLowerCase());
      if (match) dispatch({ type: 'property/update', id: match.id, patch: { remainingBasis: total.basis, depreciation: total.depreciation } });
      else dispatch({ type: 'property/add', input: { name: unit.name, remainingBasis: total.basis, depreciation: total.depreciation } });
    }
    setNotice(`Sent ${units.length} selection ${units.length === 1 ? 'unit' : 'units'}—groups plus ungrouped properties—to the Partition Tool for ${taxYear}.`);
  };

  const clearGroups = () => {
    if ((groups.length || properties.length || groupWorkbook) && !window.confirm('Clear all imported Groups and tax-return data? This cannot be undone.')) return;
    setGroups([]); setProperties([]); setGroupWorkbook(null); setDocuments([]); setWarnings([]); setExpandedGroups(new Set()); setCollapsedProperties(new Set());
    setNotice('Groups data cleared. Upload a Groups workbook to begin.');
  };

  const exportGroupsWorkbook = async () => {
    const { downloadGroupsWorkbook } = await import('../lib/groups-excel');
    downloadGroupsWorkbook(groups, groupWorkbook?.individualProperties ?? []);
    setGroupsOutputOpen(false);
  };

  const assignments = groupAssignments(groups, properties);
  const toggleExpanded = (id: string) => setExpandedGroups((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const togglePropertyCollapsed = (id: string) => setCollapsedProperties((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });

  return <div className="min-h-screen bg-bg text-text">
    <header className="flex flex-wrap items-center justify-between gap-3 bg-hdr-bg border-b-[3px] border-a px-7 py-[13px]"><div><h1 className="font-serif text-[1.15rem] font-bold text-hdr-text">Real Estate Partition Tool</h1><div className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-hdr-accent mt-1">Groups · Tax Basis Schedule · Per-Property Depreciation</div></div><div className="flex overflow-hidden rounded bg-hdr-input-bg border border-hdr-input-brd" role="group" aria-label="Theme">{(['light', 'dark'] as const).map((theme) => <button key={theme} type="button" onClick={() => dispatch({ type: 'theme/set', theme })} className={`font-mono text-[0.62rem] tracking-[0.08em] uppercase px-[11px] py-[5px] cursor-pointer ${state.theme === theme ? 'bg-a text-white' : 'text-hdr-muted'}`}>{theme === 'light' ? '☼ Light' : '☾ Dark'}</button>)}</div></header>
    <div className="flex flex-wrap items-center gap-3 bg-surface border-b border-border px-7 py-2.5"><input ref={returnFileRef} className="hidden" type="file" accept="application/pdf,.pdf" multiple onChange={(event) => void handleFiles(event)} />{activeTab === 'groups' && <><button type="button" className="tool-btn tool-btn-primary" onClick={() => groupsFileRef.current?.click()}>↑ Upload Groups Excel</button><button type="button" className="tool-btn" onClick={() => void import('../lib/groups-excel').then(({ downloadGroupsTemplate }) => downloadGroupsTemplate())}>⇩ Download Template</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!groups.length && !groupWorkbook?.individualProperties.length} onClick={() => setGroupsOutputOpen(true)}>▣ Print / Export</button><button type="button" className="tool-btn tool-btn-danger" onClick={clearGroups}>▣ Clear All</button><span className="font-mono uppercase text-[.7rem] tracking-[.06em] text-muted">Sort</span>{([['name', 'Name'], ['zoning', 'Zoning'], ['cert40yr', 'Next 40-Yr Cert']] as const).map(([key, label]) => { const active = groupsSort.key === key; return <button key={key} type="button" className={`sort-btn ${active ? 'sort-btn-active' : ''}`} onClick={() => setGroupsSort((current) => current.key === key ? { ...current, asc: !current.asc } : { key, asc: true })}><span>{label}</span><span className="text-[.75rem]">{active && !groupsSort.asc ? '↓' : '↑'}</span></button>; })}</>}{activeTab === 'data' && <><button type="button" className="tool-btn tool-btn-primary disabled:opacity-50" disabled={isImporting} onClick={() => returnFileRef.current?.click()}>{isImporting ? 'Reading tax returns…' : '↑ Upload tax return PDFs'}</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!properties.length || isImporting} onClick={exportToPartition}>⇧ Send grouped basis to Partition Tool</button></>}<span className="ml-auto font-mono text-[0.65rem] text-muted" role="status">{notice}</span></div>
    <input ref={groupsFileRef} className="hidden" type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(event) => void handleGroupsFile(event)} />
    <main className={`${activeTab === 'groups' ? 'max-w-none mx-0' : 'max-w-[1450px] mx-auto'} px-6 py-5`}>
      <nav className="flex gap-1 border-b border-border mb-5" aria-label="Tax basis workflow"><TabButton active={activeTab === 'groups'} onClick={() => setActiveTab('groups')} number="1" label="Groups" /><TabButton active={activeTab === 'data'} onClick={() => setActiveTab('data')} number="2" label="Remaining Depreciation" /></nav>
      {activeTab === 'groups' ? <GroupsTabView groups={groups} groupWorkbook={groupWorkbook} sort={groupsSort} onUpdate={updateGroup} onRemove={removeGroup} /> : <DataTabView taxYear={taxYear} setTaxYear={setTaxYear} properties={properties} groups={groups} assignments={assignments} expandedGroups={expandedGroups} collapsedProperties={collapsedProperties} warnings={warnings} documents={documents} onToggleExpanded={toggleExpanded} onTogglePropertyCollapsed={togglePropertyCollapsed} onUpdateProperty={updateProperty} onUpdateComponent={updateComponent} onGoGroups={() => setActiveTab('groups')} />}
      <GroupsOutputDialog open={groupsOutputOpen} hasData={Boolean(groups.length || groupWorkbook?.individualProperties.length)} onClose={() => setGroupsOutputOpen(false)} onExport={() => void exportGroupsWorkbook()} />
    </main>
  </div>;
}

function TabButton({ active, onClick, number, label }: { active: boolean; onClick: () => void; number: string; label: string }) { return <button type="button" onClick={onClick} className={`px-4 py-2.5 font-mono text-[.7rem] uppercase tracking-[.08em] cursor-pointer border-b-[3px] -mb-px ${active ? 'border-a text-a font-bold' : 'border-transparent text-muted hover:text-text'}`}><span className="mr-2 text-[.58rem]">{number}</span>{label}</button>; }

function GroupsTabView({ groups, groupWorkbook, sort, onUpdate, onRemove }: { groups: DealGroup[]; groupWorkbook: { name: string; individualProperties: GroupMember[] } | null; sort: { key: GroupsSortKey; asc: boolean }; onUpdate: (id: string, patch: Partial<DealGroup>) => void; onRemove: (id: string) => void }) {
  const memberValue = (member: GroupMember) => member[sort.key === 'name' ? 'property' : sort.key].toLocaleLowerCase();
  const compare = (left: string, right: string) => left.localeCompare(right, undefined, { numeric: sort.key === 'cert40yr' }) * (sort.asc ? 1 : -1);
  const sortedGroups = [...groups].sort((left, right) => compare(sort.key === 'name' ? left.name.toLocaleLowerCase() : left.members.map(memberValue).filter(Boolean).sort()[0] ?? '', sort.key === 'name' ? right.name.toLocaleLowerCase() : right.members.map(memberValue).filter(Boolean).sort()[0] ?? ''));
  const sortedIndividuals = groupWorkbook ? [...groupWorkbook.individualProperties].sort((left, right) => compare(memberValue(left), memberValue(right))) : [];
  return <section>
    <h2 className="font-serif text-[1.55rem] font-bold mb-5">Groups, Zoning, and Next 40-Yr Certification</h2>
    {!groupWorkbook && <div className="card mb-5 px-6 py-12 text-center"><h3 className="font-serif text-[1.45rem] font-bold">Upload the Groups workbook</h3><p className="max-w-2xl mx-auto mt-3 text-[.9rem] leading-snug">Use the Upload Groups Excel button in the toolbar. Properties with no group remain individual selection units.</p></div>}
    <div className="flex flex-col gap-5">{sortedGroups.map((group) => <ImportedGroupCard key={group.id} group={group} onUpdate={onUpdate} onRemove={onRemove} />)}</div>
    {sortedIndividuals.length > 0 && <IndividualPropertiesCard properties={sortedIndividuals} />}
  </section>;
}

function WorkbookPropertyDetails({ member }: { member: GroupMember }) {
  return <div className="font-mono text-[.61rem] text-muted mt-0.5"><span>{[member.entity, member.city, member.state, member.units && `${member.units} units`].filter(Boolean).join(' · ')}</span>{(member.zoning || member.cert40yr) && <span className="block mt-0.5">{[member.zoning && `Zoning: ${member.zoning}`, member.cert40yr && `Next 40-year: ${member.cert40yr}`].filter(Boolean).join(' · ')}</span>}</div>;
}

function ImportedGroupCard({ group, onUpdate, onRemove }: { group: DealGroup; onUpdate: (id: string, patch: Partial<DealGroup>) => void; onRemove: (id: string) => void }) {
  return <article className="card overflow-hidden"><header className="px-4 py-3 bg-surface2 border-b border-border flex justify-between gap-3"><div><div className="caption text-[.58rem]">Combined lot / economic package · {group.members.length} properties</div><input aria-label="Group name" value={group.name} onChange={(event) => onUpdate(group.id, { name: event.target.value })} className="mt-1 bg-transparent border-b border-border focus:border-ink outline-none font-serif text-[1.08rem] font-bold w-60" /></div><button type="button" onClick={() => onRemove(group.id)} className="font-mono text-[.6rem] uppercase text-muted hover:text-red cursor-pointer">Remove</button></header><div className="p-4"><div className="font-mono text-[.61rem] uppercase tracking-[.07em] text-muted mb-2">Member properties</div><div className="flex flex-col gap-2">{group.members.map((member) => <div key={member.property} className="text-[.78rem]"><div className="font-semibold">{member.property}</div><WorkbookPropertyDetails member={member} /></div>)}</div></div></article>;
}

function LegacyImportedGroupCard({ group, properties, assignments, onUpdate, onRemove, onToggleMember }: { group: DealGroup; properties: PropertySchedule[]; assignments: Map<string, string>; onUpdate: (id: string, patch: Partial<DealGroup>) => void; onRemove: (id: string) => void; onToggleMember: (groupId: string, property: PropertySchedule) => void }) {
  const unmatched = group.members.filter((member) => !properties.some((property) => propertyMatches(member.property, property.property)));
  return <article className="card overflow-hidden"><header className="px-4 py-3 bg-surface2 border-b border-border flex justify-between gap-3"><div><div className="caption text-[.58rem]">Combined lot / economic package · {group.members.length} properties</div><input aria-label="Group name" value={group.name} onChange={(event) => onUpdate(group.id, { name: event.target.value })} className="mt-1 bg-transparent border-b border-border focus:border-ink outline-none font-serif text-[1.08rem] font-bold w-60" /></div><button type="button" onClick={() => onRemove(group.id)} className="font-mono text-[.6rem] uppercase text-muted hover:text-red cursor-pointer">Remove</button></header><div className="p-4"><div className="font-mono text-[.61rem] uppercase tracking-[.07em] text-muted mb-2">Member properties</div>{properties.length === 0 ? <div className="flex flex-col gap-2">{group.members.map((member) => <div key={member.property} className="text-[.78rem]"><div className="font-semibold">{member.property}</div><div className="font-mono text-[.61rem] text-muted">{[member.entity, member.city, member.state, member.units && `${member.units} units`].filter(Boolean).join(' · ')}</div></div>)}</div> : <div className="flex flex-col gap-2">{properties.map((property) => <label key={property.id} className="flex gap-2.5 items-start cursor-pointer"><input type="checkbox" checked={assignments.get(property.id) === group.id} onChange={() => onToggleMember(group.id, property)} className="mt-0.5 accent-[var(--a)]" /><span><span className="font-semibold text-[.78rem]">{property.property}</span><span className="block font-mono text-[.61rem] text-muted mt-0.5">{property.entity || 'Entity not detected'}</span></span></label>)}{unmatched.length > 0 && <div className="mt-2 pt-2 border-t border-border font-mono text-[.61rem] text-muted">Waiting to match from tax returns: {unmatched.map((member) => member.property).join(', ')}</div>}</div>}</div></article>;
}

function IndividualPropertiesCard({ properties }: { properties: GroupMember[] }) {
  return <section className="card overflow-hidden mt-5"><header className="px-4 py-3 bg-surface2 border-b border-border"><div className="caption text-[.58rem]">Individual selection units · {properties.length} properties</div><h3 className="font-serif text-[1.08rem] font-bold mt-1">Individual Properties</h3></header><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-[.75rem]"><thead className="font-mono uppercase tracking-[.07em] text-[.58rem] text-muted border-b border-border"><tr><th className="text-left px-4 py-2.5">Property</th><th className="text-left px-3 py-2.5">Owner</th><th className="text-left px-3 py-2.5">Location</th><th className="text-right px-3 py-2.5">Units</th><th className="text-left px-3 py-2.5">Zoning</th><th className="text-left px-4 py-2.5">Next 40-Year Certification</th></tr></thead><tbody>{properties.map((property) => <tr key={property.property} className="border-b last:border-b-0 border-border"><td className="px-4 py-3 font-semibold">{property.property}</td><td className="px-3 py-3">{property.entity || '—'}</td><td className="px-3 py-3">{[property.city, property.state, property.zip].filter(Boolean).join(', ') || '—'}</td><td className="px-3 py-3 text-right font-mono">{property.units || '—'}</td><td className="px-3 py-3">{property.zoning || '—'}</td><td className="px-4 py-3">{property.cert40yr || '—'}</td></tr>)}</tbody></table></div></section>;
}

function LegacyIndividualPropertiesCard({ properties }: { properties: GroupMember[] }) {
  return <section className="card overflow-hidden mt-5"><header className="px-4 py-3 bg-surface2 border-b border-border"><div className="caption text-[.58rem]">Individual selection units · {properties.length} properties</div><h3 className="font-serif text-[1.08rem] font-bold mt-1">Individual Properties</h3></header><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4 p-4">{properties.map((property) => <div key={property.property} className="text-[.78rem]"><div className="font-semibold">{property.property}</div><div className="font-mono text-[.61rem] text-muted mt-0.5">{[property.entity, property.city, property.state, property.units && `${property.units} units`].filter(Boolean).join(' · ')}</div></div>)}</div></section>;
}

function GroupsOutputDialog({ open, hasData, onClose, onExport }: { open: boolean; hasData: boolean; onClose: () => void; onExport: () => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-5" role="presentation"><section className="card w-full max-w-md p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="groups-output-title"><div className="flex items-start justify-between gap-4"><div><div className="caption text-[.61rem]">Groups output</div><h2 id="groups-output-title" className="font-serif text-[1.35rem] font-bold mt-1">Print or export Groups</h2></div><button type="button" className="font-mono text-muted hover:text-text cursor-pointer" onClick={onClose}>Close</button></div><p className="mt-3 text-[.8rem] text-muted">Export the loaded Groups workbook to Excel, or open your browser print dialog to save this page as a PDF.</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" className="tool-btn tool-btn-primary disabled:opacity-40" disabled={!hasData} onClick={onExport}>Export Excel</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!hasData} onClick={() => { window.print(); onClose(); }}>Print / Save PDF</button></div></section></div>;
}

function GroupsTab({ groups, properties, onAdd, onUpdate, onRemove, onToggleMember, onUpload }: { groups: DealGroup[]; properties: PropertySchedule[]; onAdd: () => void; onUpdate: (id: string, patch: Partial<DealGroup>) => void; onRemove: (id: string) => void; onToggleMember: (groupId: string, property: PropertySchedule) => void; onUpload: () => void }) {
  return <section><div className="flex flex-wrap justify-between items-end gap-4 mb-5"><div><div className="caption text-[.66rem] mb-1">Step 1 · Selection-unit setup</div><h2 className="font-serif text-[1.55rem] font-bold">Groups</h2><p className="mt-1 text-[.78rem] text-muted max-w-3xl">Define combined lots and economic packages here. This mapping controls the totals sent to the Partition Tool and the collapsed view in Remaining Depreciation; it never merges the underlying tax schedules.</p></div><button type="button" className="tool-btn tool-btn-primary" onClick={onAdd}>+ Add group</button></div>{properties.length === 0 && <div className="note mb-4">Create group names now if useful. After uploading tax returns, return here to assign the extracted properties to each group.<button type="button" className="ml-2 underline text-a cursor-pointer" onClick={onUpload}>Upload tax returns</button></div>}<div className="grid grid-cols-1 xl:grid-cols-2 gap-5">{groups.map((group) => <GroupCard key={group.id} group={group} properties={properties} onUpdate={onUpdate} onRemove={onRemove} onToggleMember={onToggleMember} />)}{groups.length === 0 && <div className="card p-8 text-center text-muted"><div className="font-serif text-[1.15rem] font-bold text-text">No groups defined</div><p className="max-w-md mx-auto mt-2 text-[.78rem]">Add only properties that should be selected as one combined lot or economic package. Ungrouped properties remain individual selection units.</p><button type="button" onClick={onAdd} className="tool-btn tool-btn-primary mt-5">+ Add first group</button></div>}</div></section>;
}

function GroupCard({ group, properties, onUpdate, onRemove, onToggleMember }: { group: DealGroup; properties: PropertySchedule[]; onUpdate: (id: string, patch: Partial<DealGroup>) => void; onRemove: (id: string) => void; onToggleMember: (groupId: string, property: PropertySchedule) => void }) { return <article className="card overflow-hidden"><header className="px-4 py-3 bg-surface2 border-b border-border flex justify-between gap-3"><div><div className="caption text-[.58rem]">Combined lot / economic package</div><input aria-label="Group name" value={group.name} onChange={(event) => onUpdate(group.id, { name: event.target.value })} className="mt-1 bg-transparent border-b border-border focus:border-ink outline-none font-serif text-[1.08rem] font-bold w-60" /></div><button type="button" onClick={() => onRemove(group.id)} className="font-mono text-[.6rem] uppercase text-muted hover:text-red cursor-pointer">Remove</button></header><div className="p-4"><div className="font-mono text-[.61rem] uppercase tracking-[.07em] text-muted mb-2">Member properties</div>{properties.length === 0 ? <p className="text-[.75rem] text-muted">Property choices will appear after tax-return import.</p> : <div className="flex flex-col gap-2">{properties.map((property) => <label key={property.id} className="flex gap-2.5 items-start cursor-pointer"><input type="checkbox" checked={hasMember(group, property)} onChange={() => onToggleMember(group.id, property)} className="mt-0.5 accent-[var(--a)]" /><span><span className="font-semibold text-[.78rem]">{property.property}</span><span className="block font-mono text-[.61rem] text-muted mt-0.5">{property.entity || 'Entity not detected'}</span></span></label>)}</div>}</div></article>; }

function DataTabView({ taxYear, setTaxYear, properties, groups, assignments, expandedGroups, collapsedProperties, warnings, documents, onToggleExpanded, onTogglePropertyCollapsed, onUpdateProperty, onUpdateComponent, onGoGroups }: { taxYear: number; setTaxYear: (year: number) => void; properties: PropertySchedule[]; groups: DealGroup[]; assignments: Map<string, string>; expandedGroups: Set<string>; collapsedProperties: Set<string>; warnings: string[]; documents: string[]; onToggleExpanded: (id: string) => void; onTogglePropertyCollapsed: (id: string) => void; onUpdateProperty: (id: string, patch: Partial<Omit<PropertySchedule, 'id' | 'schedules'>>) => void; onUpdateComponent: (propertyId: string, componentId: string, patch: Partial<ScheduleItem>) => void; onGoGroups: () => void }) {
  const groupedIds = new Set(assignments.keys());
  return <section>
    <div className="flex flex-wrap justify-between items-end gap-4 mb-5"><div><div className="caption text-[.66rem] mb-1">Step 2 · Tax-return data extraction</div><h2 className="font-serif text-[1.55rem] font-bold">Remaining Tax Basis and Depreciation</h2><p className="mt-1 text-[.78rem] text-muted max-w-3xl">Grouped properties collapse to one selection-unit total. Expand a group to review the underlying property schedules, remaining basis, and current-year depreciation.</p></div><label className="flex items-center gap-1.5 border-[1.5px] border-border rounded-[3px] bg-surface px-2.5 py-1.5"><span className="font-mono text-[.59rem] uppercase tracking-[.07em] text-muted">Tax year</span><input value={taxYear} onChange={(event) => setTaxYear(Number(event.target.value) || taxYear)} className="w-11 bg-transparent text-right outline-none font-mono text-[.74rem] font-bold" inputMode="numeric" /></label></div>
    {documents.length > 0 && <div className="mb-4 flex flex-wrap gap-2 items-center"><span className="caption text-[.61rem]">Imported returns</span>{documents.map((document) => <span key={document} className="font-mono text-[.65rem] border border-border rounded px-2 py-1 bg-surface">{document}</span>)}</div>}
    {warnings.length > 0 && <div className="mb-4 note border-l-red">{warnings.map((warning) => <div key={warning}>{warning}</div>)}</div>}
    {properties.length === 0 ? <div className="card text-center py-16 px-6"><div className="font-serif text-[1.25rem] font-bold">No tax returns imported</div><p className="text-muted max-w-md mx-auto mt-2 text-[.78rem]">Upload the Form 1065 packages above. The importer creates the property schedules automatically.</p></div> : <div className="flex flex-col gap-5">{groups.map((group) => { const members = properties.filter((property) => assignments.get(property.id) === group.id); return <GroupedSchedule key={group.id} group={group} properties={members} workbookMembers={group.members} taxYear={taxYear} expanded={expandedGroups.has(group.id)} collapsedProperties={collapsedProperties} onToggle={() => onToggleExpanded(group.id)} onTogglePropertyCollapsed={onTogglePropertyCollapsed} onUpdateProperty={onUpdateProperty} onUpdateComponent={onUpdateComponent} />; })}{properties.filter((property) => !groupedIds.has(property.id)).map((property) => <PropertyScheduleCard key={property.id} property={property} taxYear={taxYear} collapsed={collapsedProperties.has(property.id)} onToggleCollapsed={() => onTogglePropertyCollapsed(property.id)} onUpdateProperty={onUpdateProperty} onUpdateComponent={onUpdateComponent} />)}</div>}
    <div className="mt-5 note max-w-5xl">The Groups tab controls these roll-ups. Changes to the workbook-derived membership update both the totals here and the values sent to the Partition Tool.<button type="button" onClick={onGoGroups} className="ml-2 underline text-a cursor-pointer">Open Groups</button></div>
  </section>;
}

function LegacyDataTabView({ taxYear, setTaxYear, properties, groups, assignments, expandedGroups, warnings, documents, onToggleExpanded, onUpdateProperty, onUpdateComponent, onGoGroups }: { taxYear: number; setTaxYear: (year: number) => void; properties: PropertySchedule[]; groups: DealGroup[]; assignments: Map<string, string>; expandedGroups: Set<string>; warnings: string[]; documents: string[]; onToggleExpanded: (id: string) => void; onUpdateProperty: (id: string, patch: Partial<Omit<PropertySchedule, 'id' | 'schedules'>>) => void; onUpdateComponent: (propertyId: string, componentId: string, patch: Partial<ScheduleItem>) => void; onGoGroups: () => void }) {
  const groupedIds = new Set(assignments.keys());
  return <section><div className="flex flex-wrap justify-between items-end gap-4 mb-5"><div><div className="caption text-[.66rem] mb-1">Step 2 · Tax-return data extraction</div><h2 className="font-serif text-[1.55rem] font-bold">Data</h2><p className="mt-1 text-[.78rem] text-muted max-w-3xl">Grouped properties collapse to one selection-unit total. Expand a group to review the underlying property schedules, remaining basis, and current-year depreciation.</p></div><label className="flex items-center gap-1.5 border-[1.5px] border-border rounded-[3px] bg-surface px-2.5 py-1.5"><span className="font-mono text-[.59rem] uppercase tracking-[.07em] text-muted">Tax year</span><input value={taxYear} onChange={(event) => setTaxYear(Number(event.target.value) || taxYear)} className="w-11 bg-transparent text-right outline-none font-mono text-[.74rem] font-bold" inputMode="numeric" /></label></div>{documents.length > 0 && <div className="mb-4 flex flex-wrap gap-2 items-center"><span className="caption text-[.61rem]">Imported returns</span>{documents.map((document) => <span key={document} className="font-mono text-[.65rem] border border-border rounded px-2 py-1 bg-surface">{document}</span>)}</div>}{warnings.length > 0 && <div className="mb-4 note border-l-red">{warnings.map((warning) => <div key={warning}>{warning}</div>)}</div>}{properties.length === 0 ? <div className="card text-center py-16 px-6"><div className="font-serif text-[1.25rem] font-bold">No tax returns imported</div><p className="text-muted max-w-md mx-auto mt-2 text-[.78rem]">Upload the Form 1065 packages above. The importer creates the property schedules automatically.</p></div> : <div className="flex flex-col gap-5">{groups.map((group) => { const members = properties.filter((property) => assignments.get(property.id) === group.id); return members.length ? <GroupedSchedule key={group.id} group={group} properties={members} taxYear={taxYear} expanded={expandedGroups.has(group.id)} onToggle={() => onToggleExpanded(group.id)} onUpdateProperty={onUpdateProperty} onUpdateComponent={onUpdateComponent} /> : null; })}{properties.filter((property) => !groupedIds.has(property.id)).map((property) => <PropertyScheduleCard key={property.id} property={property} taxYear={taxYear} onUpdateProperty={onUpdateProperty} onUpdateComponent={onUpdateComponent} />)}</div>}<div className="mt-5 note max-w-5xl">The Groups tab controls these roll-ups. Changes to the workbook-derived membership update both the totals here and the values sent to the Partition Tool.<button type="button" onClick={onGoGroups} className="ml-2 underline text-a cursor-pointer">Open Groups</button></div></section>;
}

function DepreciationTab({ taxYear, setTaxYear, properties, groups, groupedIds, expandedGroups, warnings, documents, onToggleExpanded, onUpdateProperty, onUpdateComponent, onGoGroups }: { taxYear: number; setTaxYear: (year: number) => void; properties: PropertySchedule[]; groups: DealGroup[]; groupedIds: Set<string>; expandedGroups: Set<string>; warnings: string[]; documents: string[]; onToggleExpanded: (id: string) => void; onUpdateProperty: (id: string, patch: Partial<Omit<PropertySchedule, 'id' | 'schedules'>>) => void; onUpdateComponent: (propertyId: string, componentId: string, patch: Partial<ScheduleItem>) => void; onGoGroups: () => void }) {
  // Legacy visual retained during transition to the Data tab.
  // @ts-expect-error The Data tab above owns the workbook-based group mapping.
  return <section><div className="flex flex-wrap justify-between items-end gap-4 mb-5"><div><div className="caption text-[.66rem] mb-1">Step 2 · Tax return schedule extraction</div><h2 className="font-serif text-[1.55rem] font-bold">Remaining Depreciation by Property</h2><p className="mt-1 text-[.78rem] text-muted max-w-3xl">Groups are collapsed to a single total. Expand a group to inspect every individual property and its tax-return depreciation sections.</p></div><label className="flex items-center gap-1.5 border-[1.5px] border-border rounded-[3px] bg-surface px-2.5 py-1.5"><span className="font-mono text-[.59rem] uppercase tracking-[.07em] text-muted">Tax year</span><input value={taxYear} onChange={(event) => setTaxYear(Number(event.target.value) || taxYear)} className="w-11 bg-transparent text-right outline-none font-mono text-[.74rem] font-bold" inputMode="numeric" /></label></div>{documents.length > 0 && <div className="mb-4 flex flex-wrap gap-2 items-center"><span className="caption text-[.61rem]">Imported returns</span>{documents.map((document) => <span key={document} className="font-mono text-[.65rem] border border-border rounded px-2 py-1 bg-surface">{document}</span>)}</div>}{warnings.length > 0 && <div className="mb-4 note border-l-red">{warnings.map((warning) => <div key={warning}>{warning}</div>)}</div>}{properties.length === 0 ? <div className="card text-center py-16 px-6"><div className="font-serif text-[1.25rem] font-bold">No tax returns imported</div><p className="text-muted max-w-md mx-auto mt-2 text-[.78rem]">Upload the Form 1065 packages above. The importer creates the property schedules automatically.</p></div> : <div className="flex flex-col gap-5">{groups.filter((group) => group.members.length).map((group) => { const members = properties.filter((property) => group.members.includes(property.id)); return <GroupedSchedule key={group.id} group={group} properties={members} taxYear={taxYear} expanded={expandedGroups.has(group.id)} onToggle={() => onToggleExpanded(group.id)} onUpdateProperty={onUpdateProperty} onUpdateComponent={onUpdateComponent} />; })}{properties.filter((property) => !groupedIds.has(property.id)).map((property) => <PropertyScheduleCard key={property.id} property={property} taxYear={taxYear} onUpdateProperty={onUpdateProperty} onUpdateComponent={onUpdateComponent} />)}</div>}<div className="mt-5 note max-w-5xl">The Groups tab controls these roll-ups. Return there to change membership; the group totals and the export to the Partition Tool update from the same mapping.<button type="button" onClick={onGoGroups} className="ml-2 underline text-a cursor-pointer">Open Groups</button></div></section>;
}

function GroupedSchedule({ group, properties, workbookMembers = group.members, taxYear, expanded, collapsedProperties = new Set<string>(), onToggle, onTogglePropertyCollapsed, onUpdateProperty, onUpdateComponent }: { group: DealGroup; properties: PropertySchedule[]; workbookMembers?: GroupMember[]; taxYear: number; expanded: boolean; collapsedProperties?: Set<string>; onToggle: () => void; onTogglePropertyCollapsed?: (id: string) => void; onUpdateProperty: (id: string, patch: Partial<Omit<PropertySchedule, 'id' | 'schedules'>>) => void; onUpdateComponent: (propertyId: string, componentId: string, patch: Partial<ScheduleItem>) => void }) {
  const total = totals(properties);
  const unmatchedMembers = workbookMembers.filter((member) => !properties.some((property) => propertyMatches(member.property, property.property)));
  return <article className="card overflow-hidden border-l-[4px] border-l-a"><button type="button" onClick={onToggle} className="w-full px-4 py-3 bg-surface2 border-b border-border flex flex-wrap justify-between gap-3 items-center text-left cursor-pointer hover:bg-bg"><div><div className="caption text-[.58rem]">Group total · {workbookMembers.length} properties</div><div className="font-serif text-[1.12rem] font-bold mt-1">{group.name}</div></div><div className="flex gap-7 text-right"><div><div className="caption text-[.56rem]">Basis left</div><div className="font-mono font-bold text-a mt-1">{money(total.basis)}</div></div><div><div className="caption text-[.56rem]">Depreciation {taxYear}</div><div className="font-mono font-bold text-yellow mt-1">{money(total.depreciation)}</div></div><div className="font-mono text-muted self-center">{expanded ? '▴ Collapse' : '▾ Expand'}</div></div></button>{expanded && <div className="p-4 bg-bg flex flex-col gap-4">{properties.map((property) => <PropertyScheduleCard key={property.id} property={property} taxYear={taxYear} collapsed={collapsedProperties.has(property.id)} onToggleCollapsed={onTogglePropertyCollapsed ? () => onTogglePropertyCollapsed(property.id) : undefined} onUpdateProperty={onUpdateProperty} onUpdateComponent={onUpdateComponent} nested />)}{unmatchedMembers.map((member) => <article key={member.property} className="border border-border rounded-[3px] bg-surface px-4 py-3"><div className="font-serif text-[1rem] font-bold">{member.property}</div><WorkbookPropertyDetails member={member} /><div className="mt-2 font-mono text-[.61rem] text-muted">No matching tax-return schedule has been imported for this property yet.</div></article>)}</div>}</article>;
}

function PropertyScheduleCard({ property, taxYear, collapsed = false, onToggleCollapsed, onUpdateProperty, onUpdateComponent, nested = false }: { property: PropertySchedule; taxYear: number; collapsed?: boolean; onToggleCollapsed?: () => void; onUpdateProperty: (id: string, patch: Partial<Omit<PropertySchedule, 'id' | 'schedules'>>) => void; onUpdateComponent: (propertyId: string, componentId: string, patch: Partial<ScheduleItem>) => void; nested?: boolean }) {
  const hasAccelerated = property.schedules.some((item) => item.method === 'MACRS / accelerated');
  const total = totals([property]);
  return <article className={`card overflow-hidden ${nested ? 'shadow-none' : ''}`}><header className="px-4 py-3 bg-surface2 border-b border-border flex flex-wrap justify-between gap-3 items-start"><div className="grid gap-1.5"><input aria-label="Property name" value={property.property} onChange={(event) => onUpdateProperty(property.id, { property: event.target.value })} className="bg-transparent border-b border-border focus:border-ink outline-none font-serif text-[1.08rem] font-bold w-60" /><div className="font-mono text-[.61rem] uppercase tracking-[.07em] text-muted">{property.entity} · {property.source}</div></div><div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-right"><span className={`font-mono text-[.59rem] uppercase tracking-[.06em] rounded px-1.5 py-1 ${hasAccelerated ? 'bg-a-light text-a' : 'bg-surface border border-border text-muted'}`}>{hasAccelerated ? 'MACRS included' : 'Straight-line only'}</span><div><div className="caption text-[.56rem]">Basis left</div><div className="font-mono font-bold text-a">{money(total.basis)}</div></div><div><div className="caption text-[.56rem]">Depreciation {taxYear}</div><div className="font-mono font-bold text-yellow">{money(total.depreciation)}</div></div>{onToggleCollapsed && <button type="button" onClick={onToggleCollapsed} className="font-mono text-[.62rem] text-muted hover:text-text cursor-pointer">{collapsed ? '▾ Expand' : '▴ Collapse'}</button>}</div></header>{!collapsed && <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-[.73rem]"><thead className="font-mono uppercase tracking-[.07em] text-[.58rem] text-muted border-b border-border"><tr><th className="text-left px-4 py-2.5">Depreciable section</th><th className="text-left px-3 py-2.5">Method</th><th className="text-right px-3 py-2.5">Basis left</th><th className="text-right px-3 py-2.5">Recovery / est. left</th><th className="text-right px-4 py-2.5">{taxYear} deduction</th></tr></thead><tbody>{property.schedules.map((item) => <tr key={item.id} className="border-b last:border-b-0 border-border"><td className="px-4 py-2.5 font-semibold">{item.label}</td><td className="px-3 py-2.5"><span className={`font-mono text-[.58rem] uppercase tracking-[.04em] ${item.method === 'MACRS / accelerated' ? 'text-a font-bold' : 'text-muted'}`}>{item.method}</span></td><td className="px-3 py-2.5"><CurrencyField label="Basis left" value={item.basis} onChange={(value) => onUpdateComponent(property.id, item.id, { basis: value })} /></td><td className="px-3 py-2.5 text-right font-mono text-muted">{item.recoveryPeriod}{item.yearsLeft ? ` / ${item.yearsLeft} yrs` : ''}</td><td className="px-4 py-2.5"><NumberField label={`${taxYear} deduction`} value={item.annual} onChange={(value) => onUpdateComponent(property.id, item.id, { annual: value })} tone="text-yellow" /></td></tr>)}</tbody><tfoot className="bg-surface2 border-t-[1.5px] border-border"><tr><td colSpan={2} className="px-4 py-3 font-mono text-[.57rem] uppercase tracking-[.07em] text-muted">Property totals → Partition Tool</td><td className="px-3 py-3 text-right font-mono text-[1rem] font-bold text-a">{money(total.basis)}</td><td /><td className="px-4 py-3 text-right font-mono text-[1rem] font-bold text-yellow">{money(total.depreciation)}</td></tr></tfoot></table></div>}</article>;
}

function CurrencyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <div className="flex items-center justify-end gap-0.5 border-b border-border focus-within:border-ink"><span className="font-mono font-bold">$</span><input aria-label={label} value={value ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : ''} onChange={(event) => onChange(numeric(event.target.value))} inputMode="decimal" placeholder="0" className="min-w-0 flex-1 bg-transparent outline-none text-right font-mono font-bold" /></div>; }

function NumberField({ label, value, onChange, tone = '' }: { label: string; value: number; onChange: (value: number) => void; tone?: string }) { return <input aria-label={label} value={value || ''} onChange={(event) => onChange(numeric(event.target.value))} inputMode="decimal" placeholder="0" className={`w-full bg-transparent border-b border-border focus:border-ink outline-none text-right font-mono font-bold ${tone}`} />; }
