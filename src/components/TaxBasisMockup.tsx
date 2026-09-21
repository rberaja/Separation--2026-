import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { GroupMember } from '../lib/groups-excel';
import type { OccupancyRecord } from '../lib/occupancy-excel';
import type { LoanRecord } from '../lib/loans-excel';
import type { CapitalExpenseRecord } from '../lib/capital-expenses-excel';
import type { MarketValueRecord } from '../lib/market-value-excel';
import type { IncomeExpenseRecord } from '../lib/income-expenses-excel';
import { deleteSourceReports, loadWorkspaceSnapshot, saveSourceReport, saveWorkspaceSnapshot, type StoredSource } from '../lib/browser-data';
import type { ExtractedMethod, ExtractionProgress } from '../lib/tax-return-pdf';
import { useApp } from '../store/AppContext';

type ScheduleItem = { id: string; label: string; method: ExtractedMethod; basis: number; recoveryPeriod: string; yearsLeft: number; annual: number };
type PropertySchedule = { id: string; property: string; entity: string; source: string; importedAt?: number; schedules: ScheduleItem[] };
type DealGroup = { id: string; name: string; members: GroupMember[] };
type Tab = 'groups' | 'data' | 'occupancy' | 'loans' | 'capitalExpenses' | 'marketValue' | 'incomeExpenses';
type GroupsSortKey = 'name' | 'zoning' | 'cert40yr';
type GroupWorkbook = { name: string; individualProperties: GroupMember[] };
type PersistedState = { taxYear: number; groups: DealGroup[]; groupWorkbook: GroupWorkbook | null; properties: PropertySchedule[]; documents: string[]; warnings: string[]; occupancy: OccupancyRecord[]; loans: LoanRecord[]; capitalExpenses: CapitalExpenseRecord[]; marketValues: MarketValueRecord[]; incomeExpenses: IncomeExpenseRecord[]; sourceReports: StoredSource[] };

/** Imported Groups and tax-return data survive tab switches and reloads until the user clears them. */
const STORAGE_KEY = 'separation.taxBasis.v1';
function loadPersisted(): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<PersistedState>;
    if (!Array.isArray(saved.groups) || !Array.isArray(saved.properties)) return null;
    return { taxYear: Number(saved.taxYear) || new Date().getFullYear() - 1, groups: saved.groups, groupWorkbook: saved.groupWorkbook ?? null, properties: saved.properties, documents: saved.documents ?? [], warnings: saved.warnings ?? [], occupancy: saved.occupancy ?? [], loans: saved.loans ?? [], capitalExpenses: saved.capitalExpenses ?? [], marketValues: saved.marketValues ?? [], incomeExpenses: saved.incomeExpenses ?? [], sourceReports: saved.sourceReports ?? [] };
  } catch { return null; }
}
function savePersisted(state: PersistedState) { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable (private window, quota) — keep working in memory */ } }

let nextLocalId = 1;
const makeId = (kind: string) => `${kind}-${nextLocalId++}`;
const reserveIds = (ids: string[]) => { for (const id of ids) { const n = Number(id.split('-').pop()); if (Number.isFinite(n) && n >= nextLocalId) nextLocalId = n + 1; } };
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

/** One property can appear in multiple historical returns; only its newest schedule may feed Partition. */
const latestTaxSchedule = (properties: PropertySchedule[], propertyName: string) => properties
  .filter((property) => propertyMatches(property.property, propertyName))
  .reduce<PropertySchedule | undefined>((latest, property) =>
    !latest || (property.importedAt ?? 0) >= (latest.importedAt ?? 0) ? property : latest,
  undefined);

function groupAssignments(groups: DealGroup[], properties: PropertySchedule[]) {
  const assignments = new Map<string, string>();
  for (const group of groups) for (const property of properties) if (!assignments.has(property.id) && hasMember(group, property)) assignments.set(property.id, group.id);
  return assignments;
}
function recordGroupAssignments<T extends { property: string }>(groups: DealGroup[], records: T[]) {
  const assignments = new Map<number, string>();
  records.forEach((record, index) => {
    const match = groups.find((group) => group.members.some((member) => propertyMatches(member.property, record.property)));
    if (match) assignments.set(index, match.id);
  });
  return assignments;
}

/** Two-stage workflow: define deal groups first, then import and inspect property-level tax schedules. */
export function TaxBasisMockup() {
  const { state, dispatch } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('groups');
  const [taxYear, setTaxYear] = useState(state.depreciationYear);
  const [properties, setProperties] = useState<PropertySchedule[]>([]);
  const [groups, setGroups] = useState<DealGroup[]>([]);
  const [groupWorkbook, setGroupWorkbook] = useState<GroupWorkbook | null>(null);
  const [documents, setDocuments] = useState<string[]>([]);
  const [notice, setNotice] = useState('Set up deal groups, then upload the partnership tax returns.');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ExtractionProgress | null>(null); const [importError, setImportError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [restored, setRestored] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [collapsedProperties, setCollapsedProperties] = useState<Set<string>>(new Set());
  const [groupsSort, setGroupsSort] = useState<{ key: GroupsSortKey; asc: boolean }>({ key: 'name', asc: true });
  const [groupsOutputOpen, setGroupsOutputOpen] = useState(false);
  const [dataOutputOpen, setDataOutputOpen] = useState(false);
  const [dataSortAsc, setDataSortAsc] = useState(true);
  const [occupancy, setOccupancy] = useState<OccupancyRecord[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [capitalExpenses, setCapitalExpenses] = useState<CapitalExpenseRecord[]>([]);
  const [marketValues, setMarketValues] = useState<MarketValueRecord[]>([]);
  const [incomeExpenses, setIncomeExpenses] = useState<IncomeExpenseRecord[]>([]);
  const [sourceReports, setSourceReports] = useState<StoredSource[]>([]);
  const [occupancyExpanded, setOccupancyExpanded] = useState<Set<string>>(new Set());
  const [occupancyCollapsed, setOccupancyCollapsed] = useState<Set<string>>(new Set());
  const [loansExpanded, setLoansExpanded] = useState<Set<string>>(new Set());
  const [occupancyOutputOpen, setOccupancyOutputOpen] = useState(false);
  const [loansOutputOpen, setLoansOutputOpen] = useState(false);
  const [occupancySortAsc, setOccupancySortAsc] = useState(true);
  const [loansSortAsc, setLoansSortAsc] = useState(true);
  const [capitalExpensesExpanded, setCapitalExpensesExpanded] = useState<Set<string>>(new Set());
  const [marketValueExpanded, setMarketValueExpanded] = useState<Set<string>>(new Set());
  const [capitalExpensesOutputOpen, setCapitalExpensesOutputOpen] = useState(false);
  const [marketValueOutputOpen, setMarketValueOutputOpen] = useState(false);
  const [capitalExpensesSortAsc, setCapitalExpensesSortAsc] = useState(true);
  const [marketValueSortAsc, setMarketValueSortAsc] = useState(true);
  const [incomeExpensesExpanded, setIncomeExpensesExpanded] = useState<Set<string>>(new Set());
  const [incomeExpensesOutputOpen, setIncomeExpensesOutputOpen] = useState(false);
  const [incomeExpensesSort, setIncomeExpensesSort] = useState<{ key: 'income' | 'expenses' | 'noi'; asc: boolean }>({ key: 'income', asc: false });
  const returnFileRef = useRef<HTMLInputElement>(null);
  const groupsFileRef = useRef<HTMLInputElement>(null);
  const occupancyFileRef = useRef<HTMLInputElement>(null);
  const loansFileRef = useRef<HTMLInputElement>(null);
  const capitalExpensesFileRef = useRef<HTMLInputElement>(null);
  const marketValueFileRef = useRef<HTMLInputElement>(null);
  const incomeExpensesFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = loadPersisted();
    if (saved) {
      reserveIds([...saved.groups.map((group) => group.id), ...saved.properties.flatMap((property) => [property.id, ...property.schedules.map((item) => item.id)])]);
      setTaxYear(saved.taxYear); setGroups(saved.groups); setGroupWorkbook(saved.groupWorkbook); setProperties(saved.properties); setDocuments(saved.documents); setWarnings(saved.warnings); setOccupancy(saved.occupancy); setLoans(saved.loans); setCapitalExpenses(saved.capitalExpenses); setMarketValues(saved.marketValues); setIncomeExpenses(saved.incomeExpenses); setSourceReports(saved.sourceReports);
      const restoredParts = [saved.groups.length ? `${saved.groups.length} groups${saved.groupWorkbook ? ` from ${saved.groupWorkbook.name}` : ''}` : '', saved.properties.length ? `${saved.properties.length} property ${saved.properties.length === 1 ? 'schedule' : 'schedules'}` : ''].filter(Boolean);
      if (restoredParts.length) setNotice(`Restored ${restoredParts.join(' and ')}. Use Clear All to start over.`);
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    const snapshot = { taxYear, groups, groupWorkbook, properties, documents, warnings, occupancy, loans, capitalExpenses, marketValues, incomeExpenses, sourceReports };
    savePersisted(snapshot);
    void saveWorkspaceSnapshot(snapshot).catch(() => { /* localStorage fallback is still available */ });
  }, [restored, taxYear, groups, groupWorkbook, properties, documents, warnings, occupancy, loans, capitalExpenses, marketValues, incomeExpenses, sourceReports]);

  useEffect(() => {
    void loadWorkspaceSnapshot<PersistedState>().then((saved) => {
      if (!saved || !Array.isArray(saved.groups) || !Array.isArray(saved.properties)) return;
      setTaxYear(saved.taxYear); setGroups(saved.groups); setGroupWorkbook(saved.groupWorkbook); setProperties(saved.properties); setDocuments(saved.documents ?? []); setWarnings(saved.warnings ?? []); setOccupancy(saved.occupancy ?? []); setLoans(saved.loans ?? []); setCapitalExpenses(saved.capitalExpenses ?? []); setMarketValues(saved.marketValues ?? []); setIncomeExpenses(saved.incomeExpenses ?? []); setSourceReports(saved.sourceReports ?? []);
    }).catch(() => { /* IndexedDB may be disabled; localStorage was already tried */ });
  }, []);

  const preserveSource = (kind: string, file: File) => {
    const source: StoredSource = { id: `${kind}-${file.name}-${file.lastModified}-${file.size}`, kind, name: file.name, type: file.type || 'application/octet-stream', importedAt: new Date().toISOString() };
    setSourceReports((current) => [...current.filter((item) => item.id !== source.id), source]);
    void saveSourceReport(source, file).catch(() => setNotice('The extracted values were kept, but this browser could not retain the original report file.'));
  };

  const updateProperty = (id: string, patch: Partial<Omit<PropertySchedule, 'id' | 'schedules'>>) => setProperties((current) => current.map((property) => property.id === id ? { ...property, ...patch } : property));
  const updateComponent = (propertyId: string, componentId: string, patch: Partial<ScheduleItem>) => setProperties((current) => current.map((property) => property.id === propertyId ? { ...property, schedules: property.schedules.map((component) => component.id === componentId ? { ...component, ...patch } : component) } : property));
  const updateGroup = (id: string, patch: Partial<DealGroup>) => setGroups((current) => current.map((group) => group.id === id ? { ...group, ...patch } : group));

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
      preserveSource('groups', file);
    } catch (error) { setNotice(`Could not read the Groups workbook: ${error instanceof Error ? error.message : String(error)}`); }
  };

  const handleOccupancyFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const { parseOccupancyWorkbook } = await import('../lib/occupancy-excel');
      const imported = parseOccupancyWorkbook(isPdf(file) ? await (await import('../lib/property-report-pdf')).reportPdfToWorkbook(file) : await file.arrayBuffer());
      setOccupancy(imported);
      setNotice(`Loaded occupancy for ${imported.length} ${imported.length === 1 ? 'property' : 'properties'} from ${file.name}.`);
      setActiveTab('occupancy');
      preserveSource('occupancy', file);
    } catch (error) { setNotice(`Could not read the rent roll: ${error instanceof Error ? error.message : String(error)}`); }
  };

  const handleLoansFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const { parseLoansWorkbook } = await import('../lib/loans-excel');
      const imported = parseLoansWorkbook(isPdf(file) ? await (await import('../lib/property-report-pdf')).reportPdfToWorkbook(file) : await file.arrayBuffer());
      setLoans(imported);
      setNotice(`Loaded ${imported.length} ${imported.length === 1 ? 'loan' : 'loans'} from ${file.name}.`);
      setActiveTab('loans');
      preserveSource('loans', file);
    } catch (error) { setNotice(`Could not read the loan schedule: ${error instanceof Error ? error.message : String(error)}`); }
  };

  const handleCapitalExpensesFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (!file) return;
    try {
      const { parseCapitalExpensesWorkbook } = await import('../lib/capital-expenses-excel'); const imported = parseCapitalExpensesWorkbook(isPdf(file) ? await (await import('../lib/property-report-pdf')).reportPdfToWorkbook(file) : await file.arrayBuffer());
      setCapitalExpenses(imported); preserveSource('capital-expenses', file); setNotice(`Loaded ${imported.length} Capital Expenses items from ${file.name}.`); setActiveTab('capitalExpenses');
    } catch (error) { setNotice(`Could not read the Capital Expenses report: ${error instanceof Error ? error.message : String(error)}`); }
  };
  const handleMarketValueFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (!file) return;
    try {
      const { parseMarketValueWorkbook } = await import('../lib/market-value-excel'); const imported = parseMarketValueWorkbook(isPdf(file) ? await (await import('../lib/property-report-pdf')).reportPdfToWorkbook(file) : await file.arrayBuffer());
      setMarketValues(imported); preserveSource('market-value', file); setNotice(`Loaded market values for ${imported.length} ${imported.length === 1 ? 'property' : 'properties'} from ${file.name}.`); setActiveTab('marketValue');
    } catch (error) { setNotice(`Could not read the Market Value report: ${error instanceof Error ? error.message : String(error)}`); }
  };
  const handleIncomeExpensesFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (!file) return;
    try {
      const { parseIncomeExpensesWorkbook } = await import('../lib/income-expenses-excel');
      const imported = parseIncomeExpensesWorkbook(isPdf(file) ? await (await import('../lib/property-report-pdf')).reportPdfToWorkbook(file) : await file.arrayBuffer());
      setIncomeExpenses(imported); preserveSource('income-expenses', file); setNotice(`Loaded Income & Expenses for ${imported.length} ${imported.length === 1 ? 'property' : 'properties'} from ${file.name}.`); setActiveTab('incomeExpenses');
    } catch (error) { setNotice(`Could not read the AppFolio Income & Expenses report: ${error instanceof Error ? error.message : String(error)}`); }
  };

  const importReturns = async (files: File[]) => {
    if (!files.length || isImporting) return;
    setIsImporting(true); setImportProgress(null); setImportError(null); setActiveTab('data'); setNotice(`Reading ${files.length} tax ${files.length === 1 ? 'return' : 'returns'} locally…`);
    try {
      const { extractTaxReturnSchedules } = await import('../lib/tax-return-pdf');
      const result = await extractTaxReturnSchedules(files, setImportProgress);
      files.forEach((file) => preserveSource('tax-returns', file));
      const importedAt = Date.now();
      const extracted = result.schedules.map((schedule) => ({ id: makeId('property'), property: schedule.property, entity: schedule.entity, source: schedule.source, importedAt: schedule.sourceModifiedAt || importedAt, schedules: schedule.schedules.map((component) => ({ ...component, id: makeId('component') })) }));
      // Keep one schedule per property across all imports. The more recent tax
      // return wins even when the filing entity spelling has changed.
      setProperties((current) => {
        const newest = new Map<string, PropertySchedule>();
        for (const schedule of [...current, ...extracted]) {
          const key = propertyKey(schedule.property);
          const existing = newest.get(key);
          if (!existing || (schedule.importedAt ?? 0) >= (existing.importedAt ?? 0)) newest.set(key, schedule);
        }
        return [...newest.values()];
      });
      setDocuments((current) => [...current.filter((name) => !result.sourceFiles.includes(name)), ...result.sourceFiles]);
      setWarnings((current) => [...current.filter((warning) => !result.sourceFiles.some((name) => warning.startsWith(name))), ...result.warnings]);
      setNotice(extracted.length ? `Extracted ${extracted.length} property ${extracted.length === 1 ? 'schedule' : 'schedules'}. Group membership is matched from the Groups workbook.` : 'No property depreciation schedules could be extracted from the selected PDFs.');
    } catch (error) { const message = `Could not read the selected return: ${error instanceof Error ? error.message : String(error)}`; setNotice(message); setImportError(message); }
    finally { setIsImporting(false); setImportProgress(null); }
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    void importReturns(files);
  };

  const isPdf = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const dragHasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files');
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => { if (!dragHasFiles(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; if (!dragActive) setDragActive(true); };
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => { if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget as Node)) return; setDragActive(false); };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!dragHasFiles(event)) return;
    event.preventDefault(); setDragActive(false);
    const pdfs = Array.from(event.dataTransfer.files).filter(isPdf);
    if (!pdfs.length) { setNotice('Drop Form 1065 PDF files to import tax returns.'); return; }
    void importReturns(pdfs);
  };

  const exportToPartition = (announce = true) => {
    const groupFor = (name: string) => groups.find((group) => group.members.some((member) => propertyMatches(member.property, name)));
    // The Groups workbook supplies the canonical property label. Every later
    // source is matched by address, so labels such as "AVE" and
    // "AVENUE MIAMI PAGE" cannot create an additional Partition card.
    const importedNames = [
      ...groups.flatMap((group) => group.members.map((member) => member.property)),
      ...(groupWorkbook?.individualProperties.map((item) => item.property) ?? []),
      ...properties.map((item) => item.property),
      ...occupancy.map((item) => item.property),
      ...loans.map((item) => item.property),
      ...capitalExpenses.map((item) => item.property),
      ...marketValues.map((item) => item.property),
      ...incomeExpenses.map((item) => item.property),
    ];
    const names = importedNames.filter(Boolean).reduce<string[]>((unique, name) => {
      if (!unique.some((current) => propertyMatches(current, name))) unique.push(name);
      return unique;
    }, []);
    if (!names.length) { if (announce) setNotice('Upload at least one Data report before sending values to the Partition Tool.'); return; }
    dispatch({ type: 'settings/depreciationYear', value: taxYear });
    for (const name of names) {
      const latestTax = latestTaxSchedule(properties, name); const taxTotal = latestTax ? totals([latestTax]) : { basis: 0, depreciation: 0 };
      const member = groups.flatMap((group) => group.members).find((item) => propertyMatches(item.property, name)) ?? groupWorkbook?.individualProperties.find((item) => propertyMatches(item.property, name));
      const occupancyRecord = occupancy.find((item) => propertyMatches(item.property, name)); const loanItems = loans.filter((item) => propertyMatches(item.property, name));
      const loanBalance = loanItems.reduce((sum, item) => sum + item.outstandingBalance, 0);
      const loansWithRates = loanItems.filter((item) => typeof item.interestRate === 'number');
      const weightedLoanRateBalance = loansWithRates.reduce((sum, item) => sum + item.outstandingBalance, 0);
      const weightedLoanRate = weightedLoanRateBalance ? loansWithRates.reduce((sum, item) => sum + item.outstandingBalance * (item.interestRate ?? 0), 0) / weightedLoanRateBalance : null;
      const residualTerms = loanItems.map((item) => item.residualTermYears).filter((term): term is number => typeof term === 'number');
      const capex = capitalExpenses.filter((item) => propertyMatches(item.property, name)).reduce((sum, item) => sum + item.approximateCost, 0); const market = marketValues.find((item) => propertyMatches(item.property, name)); const incomeExpense = incomeExpenses.find((item) => propertyMatches(item.property, name)); const group = groupFor(name);
      const patch = { dataManaged: 'data' as const, groupName: group?.name ?? '', remainingBasis: latestTax ? taxTotal.basis : null, depreciation: latestTax ? taxTotal.depreciation : null, zoning: member?.zoning ?? '', cert40yr: member?.cert40yr ?? '', occupancyPct: occupancyRecord?.units ? (occupancyRecord.occupiedUnits / occupancyRecord.units) * 100 : null, loanBal: loanItems.length ? loanBalance : null, loanRate: weightedLoanRate, loanTerm: residualTerms.length ? Math.min(...residualTerms) : null, monthlyPmt: loanItems.length ? loanItems.reduce((sum, item) => sum + item.monthlyDebtService, 0) : null, capex: capex || null, marketVal: market?.marketValue ?? null, noi: incomeExpense?.noi ?? null };
      const matches = state.properties.filter((property) => propertyMatches(property.name, name));
      const match = matches.find((property) => propertyKey(property.name) === propertyKey(name)) ?? matches[0];
      if (match) {
        dispatch({ type: 'property/update', id: match.id, patch });
        // Clean up historical duplicates created before address-variant matching.
        matches.filter((property) => property.id !== match.id).forEach((property) => dispatch({ type: 'property/delete', id: property.id }));
      }
      else dispatch({ type: 'property/add', input: { name, ...patch } });
    }
    if (announce) setNotice(`Sent ${names.length} individual properties and group metadata to the Partition Tool for ${taxYear}.`);
  };

  // The Groups workbook is the source of the Partition hierarchy. Rebuild its
  // cards whenever Data is restored or changed, so a browser refresh never
  // leaves Groups visible in Data but missing from Partition.
  useEffect(() => {
    if (!restored || (!groups.length && !groupWorkbook)) return;
    exportToPartition(false);
  }, [restored, taxYear, groups, groupWorkbook, properties, occupancy, loans, capitalExpenses, marketValues, incomeExpenses]);

  const clearGroups = () => {
    if ((groups.length || properties.length || groupWorkbook) && !window.confirm('Clear all imported Groups and tax-return data? This cannot be undone.')) return;
    dispatch({ type: 'properties/clearDataManaged' });
    setGroups([]); setProperties([]); setGroupWorkbook(null); setDocuments([]); setWarnings([]); setExpandedGroups(new Set()); setCollapsedProperties(new Set()); setSourceReports((current) => current.filter((item) => item.kind !== 'groups' && item.kind !== 'tax-returns')); void Promise.all([deleteSourceReports('groups'), deleteSourceReports('tax-returns')]);
    setNotice('Groups data cleared. Upload a Groups workbook to begin.');
  };

  const clearTaxReturns = () => {
    if (properties.length && !window.confirm('Clear all imported tax-return data? Groups are kept. This cannot be undone.')) return;
    setProperties([]); setDocuments([]); setWarnings([]); setExpandedGroups(new Set()); setCollapsedProperties(new Set()); setSourceReports((current) => current.filter((item) => item.kind !== 'tax-returns')); void deleteSourceReports('tax-returns');
    setNotice('Tax-return data cleared. Upload the Form 1065 packages to begin again.');
  };
  const expandAll = () => { setExpandedGroups(new Set(groups.map((group) => group.id))); setCollapsedProperties(new Set()); };
  const collapseAll = () => { setExpandedGroups(new Set()); setCollapsedProperties(new Set(properties.map((property) => property.id))); };

  const exportDepreciationWorkbook = async () => {
    const { downloadDepreciationWorkbook } = await import('../lib/groups-excel');
    const assignments = groupAssignments(groups, properties);
    downloadDepreciationWorkbook(taxYear, properties.map((property) => ({ group: groups.find((group) => group.id === assignments.get(property.id))?.name ?? '', property: property.property, entity: property.entity, source: property.source, schedules: property.schedules })));
    setDataOutputOpen(false);
  };

  const exportGroupsWorkbook = async () => {
    const { downloadGroupsWorkbook } = await import('../lib/groups-excel');
    downloadGroupsWorkbook(groups, groupWorkbook?.individualProperties ?? []);
    setGroupsOutputOpen(false);
  };

  const clearOccupancy = () => {
    if (occupancy.length && !window.confirm('Clear all imported occupancy data? This cannot be undone.')) return;
    setOccupancy([]); setOccupancyExpanded(new Set()); setOccupancyCollapsed(new Set()); setSourceReports((current) => current.filter((item) => item.kind !== 'occupancy')); void deleteSourceReports('occupancy'); setNotice('Occupancy data cleared. Upload a rent roll to begin again.');
  };
  const clearLoans = () => {
    if (loans.length && !window.confirm('Clear all imported loan data? This cannot be undone.')) return;
    setLoans([]); setLoansExpanded(new Set()); setSourceReports((current) => current.filter((item) => item.kind !== 'loans')); void deleteSourceReports('loans'); setNotice('Loan data cleared. Upload a loan schedule to begin again.');
  };
  const exportOccupancyWorkbook = async () => {
    const { downloadOccupancyWorkbook } = await import('../lib/occupancy-excel');
    downloadOccupancyWorkbook(occupancy); setOccupancyOutputOpen(false);
  };
  const exportLoansWorkbook = async () => {
    const { downloadLoansWorkbook } = await import('../lib/loans-excel');
    downloadLoansWorkbook(loans); setLoansOutputOpen(false);
  };
  const clearCapitalExpenses = () => { if (capitalExpenses.length && !window.confirm('Clear all imported Capital Expenses data? This cannot be undone.')) return; setCapitalExpenses([]); setCapitalExpensesExpanded(new Set()); setSourceReports((current) => current.filter((item) => item.kind !== 'capital-expenses')); void deleteSourceReports('capital-expenses'); setNotice('Capital Expenses data cleared.'); };
  const clearMarketValues = () => { if (marketValues.length && !window.confirm('Clear all imported Market Value data? This cannot be undone.')) return; setMarketValues([]); setMarketValueExpanded(new Set()); setSourceReports((current) => current.filter((item) => item.kind !== 'market-value')); void deleteSourceReports('market-value'); setNotice('Market Value data cleared.'); };
  const clearIncomeExpenses = () => { if (incomeExpenses.length && !window.confirm('Clear all imported Income & Expenses data? This cannot be undone.')) return; setIncomeExpenses([]); setIncomeExpensesExpanded(new Set()); setSourceReports((current) => current.filter((item) => item.kind !== 'income-expenses')); void deleteSourceReports('income-expenses'); setNotice('Income & Expenses data cleared.'); };
  const exportCapitalExpensesWorkbook = async () => { const { downloadCapitalExpensesWorkbook } = await import('../lib/capital-expenses-excel'); downloadCapitalExpensesWorkbook(capitalExpenses); setCapitalExpensesOutputOpen(false); };
  const exportMarketValueWorkbook = async () => { const { downloadMarketValueWorkbook } = await import('../lib/market-value-excel'); downloadMarketValueWorkbook(marketValues); setMarketValueOutputOpen(false); };
  const exportIncomeExpensesWorkbook = async () => { const { downloadIncomeExpensesWorkbook } = await import('../lib/income-expenses-excel'); downloadIncomeExpensesWorkbook(incomeExpenses); setIncomeExpensesOutputOpen(false); };

  const assignments = groupAssignments(groups, properties);
  const toggleExpanded = (id: string) => setExpandedGroups((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const togglePropertyCollapsed = (id: string) => setCollapsedProperties((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleOccupancyExpanded = (id: string) => setOccupancyExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleOccupancyCollapsed = (property: string) => setOccupancyCollapsed((current) => { const next = new Set(current); const key = propertyKey(property); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const expandAllOccupancy = () => { setOccupancyExpanded(new Set(groups.map((group) => group.id))); setOccupancyCollapsed(new Set()); };
  const collapseAllOccupancy = () => { setOccupancyExpanded(new Set()); setOccupancyCollapsed(new Set(occupancy.map((record) => propertyKey(record.property)))); };
  const toggleLoansExpanded = (id: string) => setLoansExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleCapitalExpensesExpanded = (id: string) => setCapitalExpensesExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleMarketValueExpanded = (id: string) => setMarketValueExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleIncomeExpensesExpanded = (id: string) => setIncomeExpensesExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });

  return <div className="min-h-screen bg-bg text-text relative" onDragOver={handleDragOver} onDragEnter={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
    {dragActive && <div className="fixed inset-0 z-40 pointer-events-none bg-a/10 flex items-center justify-center p-8" aria-hidden="true"><div className="border-[3px] border-dashed border-a rounded-md bg-surface px-10 py-8 text-center shadow-xl"><div className="font-serif text-[1.4rem] font-bold">Drop tax return PDFs to import</div><div className="mt-1 font-mono text-[.66rem] uppercase tracking-[.07em] text-muted">Form 1065 packages · read locally in your browser</div></div></div>}
    <header className="flex flex-wrap items-center justify-between gap-3 bg-hdr-bg border-b-[3px] border-a px-7 py-[13px]"><div><h1 className="font-serif text-[1.15rem] font-bold text-hdr-text">Real Estate Partition Tool</h1><div className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-hdr-accent mt-1">Groups · Tax Basis Schedule · Per-Property Depreciation</div></div><div className="flex overflow-hidden rounded bg-hdr-input-bg border border-hdr-input-brd" role="group" aria-label="Theme">{(['light', 'dark'] as const).map((theme) => <button key={theme} type="button" onClick={() => dispatch({ type: 'theme/set', theme })} className={`font-mono text-[0.62rem] tracking-[0.08em] uppercase px-[11px] py-[5px] cursor-pointer ${state.theme === theme ? 'bg-a text-white' : 'text-hdr-muted'}`}>{theme === 'light' ? '☼ Light' : '☾ Dark'}</button>)}</div></header>
    <div className="flex flex-wrap items-center gap-3 bg-surface border-b border-border px-7 py-2.5"><input ref={returnFileRef} className="hidden" type="file" accept="application/pdf,.pdf" multiple onChange={(event) => void handleFiles(event)} />{activeTab === 'groups' && <><button type="button" className="tool-btn tool-btn-primary" onClick={() => groupsFileRef.current?.click()}>↑ Upload Groups Excel</button><button type="button" className="tool-btn" onClick={() => void import('../lib/groups-excel').then(({ downloadGroupsTemplate }) => downloadGroupsTemplate())}>⇩ Download Template</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!groups.length && !groupWorkbook?.individualProperties.length} onClick={() => setGroupsOutputOpen(true)}>▣ Print / Export</button><button type="button" className="tool-btn tool-btn-danger" onClick={clearGroups}>▣ Clear All</button><span className="font-mono uppercase text-[.7rem] tracking-[.06em] text-muted">Sort</span>{([['name', 'Name'], ['zoning', 'Zoning'], ['cert40yr', 'Next 40-Yr Cert']] as const).map(([key, label]) => { const active = groupsSort.key === key; return <button key={key} type="button" className={`sort-btn ${active ? 'sort-btn-active' : ''}`} onClick={() => setGroupsSort((current) => current.key === key ? { ...current, asc: !current.asc } : { key, asc: true })}><span>{label}</span><span className="text-[.75rem]">{active && !groupsSort.asc ? '↓' : '↑'}</span></button>; })}</>}{activeTab === 'data' && <><button type="button" className="tool-btn tool-btn-primary disabled:opacity-50" disabled={isImporting} onClick={() => returnFileRef.current?.click()}>{isImporting ? 'Reading tax returns…' : '↑ Upload tax return PDFs'}</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!properties.length} onClick={() => setDataOutputOpen(true)}>▣ Print / Export</button><button type="button" className="tool-btn tool-btn-danger disabled:opacity-40" disabled={!properties.length} onClick={clearTaxReturns}>▣ Clear All</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!properties.length} onClick={expandAll}>▾ Expand</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!properties.length} onClick={collapseAll}>▴ Collapse</button><span className="font-mono uppercase text-[.7rem] tracking-[.06em] text-muted">Sort</span><button type="button" className="sort-btn sort-btn-active" onClick={() => setDataSortAsc((current) => !current)}><span>Name</span><span className="text-[.75rem]">{dataSortAsc ? '↑' : '↓'}</span></button></>}</div>
    {(activeTab === 'occupancy' || activeTab === 'loans' || activeTab === 'capitalExpenses' || activeTab === 'marketValue' || activeTab === 'incomeExpenses') && <div className="flex flex-wrap items-center gap-3 bg-surface border-b border-border px-7 py-2.5">
      {activeTab === 'occupancy' && <><button type="button" className="tool-btn tool-btn-primary" onClick={() => occupancyFileRef.current?.click()}>↑ Upload Rent Roll</button><button type="button" className="tool-btn" onClick={() => void import('../lib/occupancy-excel').then(({ downloadOccupancyTemplate }) => downloadOccupancyTemplate())}>⇩ Manual Template</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!occupancy.length} onClick={() => setOccupancyOutputOpen(true)}>▣ Print / Export</button><button type="button" className="tool-btn tool-btn-danger disabled:opacity-40" disabled={!occupancy.length} onClick={clearOccupancy}>▣ Clear All</button><span className="font-mono uppercase text-[.7rem] tracking-[.06em] text-muted">Sort</span><button type="button" className="sort-btn sort-btn-active" onClick={() => setOccupancySortAsc((current) => !current)}>Name {occupancySortAsc ? '↑' : '↓'}</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!occupancy.length} onClick={expandAllOccupancy}>▾ Expand all</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!occupancy.length} onClick={collapseAllOccupancy}>▴ Collapse all</button></>}
      {activeTab === 'loans' && <><button type="button" className="tool-btn tool-btn-primary" onClick={() => loansFileRef.current?.click()}>↑ Upload Loan Report</button><button type="button" className="tool-btn" onClick={() => void import('../lib/loans-excel').then(({ downloadLoansTemplate }) => downloadLoansTemplate())}>⇩ Manual Template</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!loans.length} onClick={() => setLoansOutputOpen(true)}>▣ Print / Export</button><button type="button" className="tool-btn tool-btn-danger disabled:opacity-40" disabled={!loans.length} onClick={clearLoans}>▣ Clear All</button><span className="font-mono uppercase text-[.7rem] tracking-[.06em] text-muted">Sort</span><button type="button" className="sort-btn sort-btn-active" onClick={() => setLoansSortAsc((current) => !current)}>Name {loansSortAsc ? '↑' : '↓'}</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!loans.length} onClick={() => setLoansExpanded(new Set(groups.map((group) => group.id)))}>▾ Expand all</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!loans.length} onClick={() => setLoansExpanded(new Set())}>▴ Collapse all</button></>}
      {activeTab === 'capitalExpenses' && <><button type="button" className="tool-btn tool-btn-primary" onClick={() => capitalExpensesFileRef.current?.click()}>↑ Upload CapEx Report</button><button type="button" className="tool-btn" onClick={() => void import('../lib/capital-expenses-excel').then(({ downloadCapitalExpensesTemplate }) => downloadCapitalExpensesTemplate())}>⇩ Manual Template</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!capitalExpenses.length} onClick={() => setCapitalExpensesOutputOpen(true)}>▣ Print / Export</button><button type="button" className="tool-btn tool-btn-danger disabled:opacity-40" disabled={!capitalExpenses.length} onClick={clearCapitalExpenses}>▣ Clear All</button><span className="font-mono uppercase text-[.7rem] tracking-[.06em] text-muted">Sort</span><button type="button" className="sort-btn sort-btn-active" onClick={() => setCapitalExpensesSortAsc((current) => !current)}>Name {capitalExpensesSortAsc ? '↑' : '↓'}</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!capitalExpenses.length} onClick={() => setCapitalExpensesExpanded(new Set(groups.map((group) => group.id)))}>▾ Expand all</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!capitalExpenses.length} onClick={() => setCapitalExpensesExpanded(new Set())}>▴ Collapse all</button></>}
      {activeTab === 'marketValue' && <><button type="button" className="tool-btn tool-btn-primary" onClick={() => marketValueFileRef.current?.click()}>↑ Upload Market Value Report</button><button type="button" className="tool-btn" onClick={() => void import('../lib/market-value-excel').then(({ downloadMarketValueTemplate }) => downloadMarketValueTemplate())}>⇩ Manual Template</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!marketValues.length} onClick={() => setMarketValueOutputOpen(true)}>▣ Print / Export</button><button type="button" className="tool-btn tool-btn-danger disabled:opacity-40" disabled={!marketValues.length} onClick={clearMarketValues}>▣ Clear All</button><span className="font-mono uppercase text-[.7rem] tracking-[.06em] text-muted">Sort</span><button type="button" className="sort-btn sort-btn-active" onClick={() => setMarketValueSortAsc((current) => !current)}>Name {marketValueSortAsc ? '↑' : '↓'}</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!marketValues.length} onClick={() => setMarketValueExpanded(new Set(groups.map((group) => group.id)))}>▾ Expand all</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!marketValues.length} onClick={() => setMarketValueExpanded(new Set())}>▴ Collapse all</button></>}
      {activeTab === 'incomeExpenses' && <><button type="button" className="tool-btn tool-btn-primary" onClick={() => incomeExpensesFileRef.current?.click()}>↑ Upload AppFolio Report</button><button type="button" className="tool-btn" onClick={() => void import('../lib/income-expenses-excel').then(({ downloadIncomeExpensesTemplate }) => downloadIncomeExpensesTemplate())}>⇩ Manual Template</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!incomeExpenses.length} onClick={() => setIncomeExpensesOutputOpen(true)}>▣ Print / Export</button><button type="button" className="tool-btn tool-btn-danger disabled:opacity-40" disabled={!incomeExpenses.length} onClick={clearIncomeExpenses}>▣ Clear All</button><span className="font-mono uppercase text-[.7rem] tracking-[.06em] text-muted">Sort</span>{([['income', 'Income'], ['expenses', 'Expenses'], ['noi', 'NOI']] as const).map(([key, label]) => { const active = incomeExpensesSort.key === key; return <button key={key} type="button" className={`sort-btn ${active ? 'sort-btn-active' : ''}`} onClick={() => setIncomeExpensesSort((current) => current.key === key ? { ...current, asc: !current.asc } : { key, asc: false })}>{label} {active ? (incomeExpensesSort.asc ? '↑' : '↓') : '↕'}</button>; })}<button type="button" className="tool-btn disabled:opacity-40" disabled={!incomeExpenses.length} onClick={() => setIncomeExpensesExpanded(new Set(groups.map((group) => group.id)))}>▾ Expand all</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!incomeExpenses.length} onClick={() => setIncomeExpensesExpanded(new Set())}>▴ Collapse all</button></>}
    </div>}
    <input ref={groupsFileRef} className="hidden" type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(event) => void handleGroupsFile(event)} />
    <input ref={occupancyFileRef} className="hidden" type="file" accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(event) => void handleOccupancyFile(event)} />
    <input ref={loansFileRef} className="hidden" type="file" accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(event) => void handleLoansFile(event)} />
    <input ref={capitalExpensesFileRef} className="hidden" type="file" accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(event) => void handleCapitalExpensesFile(event)} />
    <input ref={marketValueFileRef} className="hidden" type="file" accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(event) => void handleMarketValueFile(event)} />
    <input ref={incomeExpensesFileRef} className="hidden" type="file" accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(event) => void handleIncomeExpensesFile(event)} />
    <main className="max-w-none mx-0 px-6 py-5">
      <nav className="flex flex-wrap gap-4 border-b border-border mb-5" aria-label="Data workflow"><TabButton active={activeTab === 'groups'} onClick={() => setActiveTab('groups')} number="1" label="Groups" /><TabButton active={activeTab === 'data'} onClick={() => setActiveTab('data')} number="2" label="Remaining Tax Basis" /><TabButton active={activeTab === 'occupancy'} onClick={() => setActiveTab('occupancy')} number="3" label="Occupancy" /><TabButton active={activeTab === 'loans'} onClick={() => setActiveTab('loans')} number="4" label="Loans" /><TabButton active={activeTab === 'capitalExpenses'} onClick={() => setActiveTab('capitalExpenses')} number="5" label="Capital Expenses" /><TabButton active={activeTab === 'incomeExpenses'} onClick={() => setActiveTab('incomeExpenses')} number="6" label="Income & Expenses" /><TabButton active={activeTab === 'marketValue'} onClick={() => setActiveTab('marketValue')} number="7" label="Market Value" /></nav>
      <div className="mb-4 border border-border bg-surface2 px-4 py-2.5 text-center font-mono text-[.68rem] text-muted" role="status">{notice}</div>
      <SourceReports reports={sourceReports} activeTab={activeTab} />
      {activeTab === 'groups' && <GroupsTabView groups={groups} groupWorkbook={groupWorkbook} sort={groupsSort} onUpdate={updateGroup} />}
      {activeTab === 'data' && <DataTabView taxYear={taxYear} setTaxYear={setTaxYear} properties={properties} groups={groups} assignments={assignments} sortAsc={dataSortAsc} importing={isImporting} progress={importProgress} importError={importError} onUpload={() => returnFileRef.current?.click()} expandedGroups={expandedGroups} collapsedProperties={collapsedProperties} warnings={warnings} documents={documents} onToggleExpanded={toggleExpanded} onTogglePropertyCollapsed={togglePropertyCollapsed} onUpdateProperty={updateProperty} onUpdateComponent={updateComponent} onGoGroups={() => setActiveTab('groups')} />}
      {activeTab === 'occupancy' && <OccupancyTabView records={occupancy} groups={groups} expandedGroups={occupancyExpanded} collapsedProperties={occupancyCollapsed} sortAsc={occupancySortAsc} onToggleGroup={toggleOccupancyExpanded} onToggleProperty={toggleOccupancyCollapsed} onUpload={() => occupancyFileRef.current?.click()} />}
      {activeTab === 'loans' && <LoansTabView records={loans} groups={groups} expandedGroups={loansExpanded} sortAsc={loansSortAsc} onToggleGroup={toggleLoansExpanded} onUpload={() => loansFileRef.current?.click()} />}
      {activeTab === 'capitalExpenses' && <CapitalExpensesTabView records={capitalExpenses} groups={groups} expandedGroups={capitalExpensesExpanded} sortAsc={capitalExpensesSortAsc} onToggleGroup={toggleCapitalExpensesExpanded} onUpload={() => capitalExpensesFileRef.current?.click()} />}
      {activeTab === 'marketValue' && <MarketValueTabView records={marketValues} groups={groups} expandedGroups={marketValueExpanded} sortAsc={marketValueSortAsc} onToggleGroup={toggleMarketValueExpanded} onUpload={() => marketValueFileRef.current?.click()} />}
      {activeTab === 'incomeExpenses' && <IncomeExpensesTabView records={incomeExpenses} groups={groups} expandedGroups={incomeExpensesExpanded} sort={incomeExpensesSort} onToggleGroup={toggleIncomeExpensesExpanded} onUpload={() => incomeExpensesFileRef.current?.click()} />}
      <GroupsOutputDialog open={groupsOutputOpen} hasData={Boolean(groups.length || groupWorkbook?.individualProperties.length)} onClose={() => setGroupsOutputOpen(false)} onExport={() => void exportGroupsWorkbook()} />
      <GroupsOutputDialog open={dataOutputOpen} hasData={properties.length > 0} caption="Remaining depreciation output" title="Print or export Remaining Depreciation" description="Export every property schedule—basis left, method, and current-year deduction—to Excel, or open your browser print dialog to save this page as a PDF." onClose={() => setDataOutputOpen(false)} onExport={() => void exportDepreciationWorkbook()} />
      <GroupsOutputDialog open={occupancyOutputOpen} hasData={occupancy.length > 0} caption="Occupancy output" title="Print or export Occupancy" description="Export the property occupancy values to Excel, or open your browser print dialog to save this page as a PDF." onClose={() => setOccupancyOutputOpen(false)} onExport={() => void exportOccupancyWorkbook()} />
      <GroupsOutputDialog open={loansOutputOpen} hasData={loans.length > 0} caption="Loans output" title="Print or export Loans" description="Export the loan schedule to Excel, or open your browser print dialog to save this page as a PDF." onClose={() => setLoansOutputOpen(false)} onExport={() => void exportLoansWorkbook()} />
      <GroupsOutputDialog open={capitalExpensesOutputOpen} hasData={capitalExpenses.length > 0} caption="Capital Expenses output" title="Print or export Capital Expenses" description="Export the property-level Capital Expenses report to Excel, or open your browser print dialog to save this page as a PDF." onClose={() => setCapitalExpensesOutputOpen(false)} onExport={() => void exportCapitalExpensesWorkbook()} />
      <GroupsOutputDialog open={marketValueOutputOpen} hasData={marketValues.length > 0} caption="Market Value output" title="Print or export Market Value" description="Export the property-level Market Value report to Excel, or open your browser print dialog to save this page as a PDF." onClose={() => setMarketValueOutputOpen(false)} onExport={() => void exportMarketValueWorkbook()} />
      <GroupsOutputDialog open={incomeExpensesOutputOpen} hasData={incomeExpenses.length > 0} caption="Income & Expenses output" title="Print or export Income & Expenses" description="Export the property-level Income, Expenses, and NOI report to Excel, or open your browser print dialog to save this page as a PDF." onClose={() => setIncomeExpensesOutputOpen(false)} onExport={() => void exportIncomeExpensesWorkbook()} />
    </main>
  </div>;
}

function TabButton({ active, onClick, number, label }: { active: boolean; onClick: () => void; number: string; label: string }) { return <button type="button" onClick={onClick} className={`px-4 py-2.5 cursor-pointer border-b-[3px] -mb-px ${active ? 'border-a text-a' : 'border-transparent text-muted hover:text-text'}`}><span className="mr-2 font-mono text-[.58rem] uppercase tracking-[.08em]">{number}</span><span className="font-serif text-[.94rem] font-bold">{label}</span></button>; }

function SourceReports({ reports, activeTab }: { reports: StoredSource[]; activeTab: Tab }) {
  const kind = ({ groups: 'groups', data: 'tax-returns', occupancy: 'occupancy', loans: 'loans', capitalExpenses: 'capital-expenses', marketValue: 'market-value', incomeExpenses: 'income-expenses' } as const)[activeTab];
  const relevant = reports.filter((report) => report.kind === kind);
  if (!relevant.length) return null;
  return <div className="mb-4 note max-w-5xl"><span className="font-bold">Source report retained in this browser:</span>{relevant.map((report) => <span key={report.id} className="ml-2 inline-block font-mono text-[.64rem] border border-border rounded px-1.5 py-0.5 bg-surface">{report.name}</span>)}<span className="ml-2 text-muted">It remains available on this device and browser until Clear All.</span></div>;
}

function GroupsTabView({ groups, groupWorkbook, sort, onUpdate }: { groups: DealGroup[]; groupWorkbook: { name: string; individualProperties: GroupMember[] } | null; sort: { key: GroupsSortKey; asc: boolean }; onUpdate: (id: string, patch: Partial<DealGroup>) => void }) {
  const memberValue = (member: GroupMember) => member[sort.key === 'name' ? 'property' : sort.key].toLocaleLowerCase();
  const compare = (left: string, right: string) => left.localeCompare(right, undefined, { numeric: sort.key === 'cert40yr' }) * (sort.asc ? 1 : -1);
  const sortedGroups = [...groups].sort((left, right) => compare(sort.key === 'name' ? left.name.toLocaleLowerCase() : left.members.map(memberValue).filter(Boolean).sort()[0] ?? '', sort.key === 'name' ? right.name.toLocaleLowerCase() : right.members.map(memberValue).filter(Boolean).sort()[0] ?? ''));
  const sortedIndividuals = groupWorkbook ? [...groupWorkbook.individualProperties].sort((left, right) => compare(memberValue(left), memberValue(right))) : [];
  return <section>
    <h2 className="font-serif text-[1.55rem] font-bold mb-5">Groups, Zoning, and Next 40-Yr Certification</h2>
    {!groupWorkbook && <div className="card mb-5 px-6 py-12 text-center"><h3 className="font-serif text-[1.45rem] font-bold">Upload the Groups workbook</h3><p className="max-w-2xl mx-auto mt-3 text-[.9rem] leading-snug">Use the Upload Groups Excel button in the toolbar. Properties with no group remain individual selection units.</p></div>}
    <div className="flex flex-col gap-5">{sortedGroups.map((group) => <ImportedGroupCard key={group.id} group={group} onUpdate={onUpdate} />)}</div>
    {sortedIndividuals.length > 0 && <IndividualPropertiesCard properties={sortedIndividuals} />}
  </section>;
}

function WorkbookPropertyDetails({ member }: { member: GroupMember }) {
  return <div className="font-mono text-[.61rem] text-muted mt-0.5"><span>{[member.entity, member.city, member.state, member.units && `${member.units} units`].filter(Boolean).join(' · ')}</span>{(member.zoning || member.cert40yr) && <span className="block mt-0.5">{[member.zoning && `Zoning: ${member.zoning}`, member.cert40yr && `Next 40-year: ${member.cert40yr}`].filter(Boolean).join(' · ')}</span>}</div>;
}

function ImportedGroupCard({ group, onUpdate }: { group: DealGroup; onUpdate: (id: string, patch: Partial<DealGroup>) => void }) {
  return <article className="card overflow-hidden"><header className="px-4 py-3 bg-surface2 border-b border-border"><input aria-label="Group name" value={group.name} onChange={(event) => onUpdate(group.id, { name: event.target.value })} className="bg-transparent border-b border-border focus:border-ink outline-none font-serif text-[1.08rem] font-bold w-60" /><div className="caption text-[.58rem] mt-1">Combined lot / economic package · {group.members.length} properties</div></header><div className="p-4"><div className="font-mono text-[.61rem] uppercase tracking-[.07em] text-muted mb-2">Member properties</div><div className="flex flex-col gap-2">{group.members.map((member) => <div key={member.property} className="text-[.78rem]"><div className="font-semibold">{member.property}</div><WorkbookPropertyDetails member={member} /></div>)}</div></div></article>;
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

function GroupsOutputDialog({ open, hasData, caption = 'Groups output', title = 'Print or export Groups', description = 'Export the loaded Groups workbook to Excel, or open your browser print dialog to save this page as a PDF.', onClose, onExport }: { open: boolean; hasData: boolean; caption?: string; title?: string; description?: string; onClose: () => void; onExport: () => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-5" role="presentation"><section className="card w-full max-w-md p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="groups-output-title"><div className="flex items-start justify-between gap-4"><div><div className="caption text-[.61rem]">{caption}</div><h2 id="groups-output-title" className="font-serif text-[1.35rem] font-bold mt-1">{title}</h2></div><button type="button" className="font-mono text-muted hover:text-text cursor-pointer" onClick={onClose}>Close</button></div><p className="mt-3 text-[.8rem] text-muted">{description}</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" className="tool-btn tool-btn-primary disabled:opacity-40" disabled={!hasData} onClick={onExport}>Export Excel</button><button type="button" className="tool-btn disabled:opacity-40" disabled={!hasData} onClick={() => { window.print(); onClose(); }}>Print / Save PDF</button></div></section></div>;
}

function OccupancyTabView({ records, groups, expandedGroups, collapsedProperties, sortAsc, onToggleGroup, onToggleProperty, onUpload }: { records: OccupancyRecord[]; groups: DealGroup[]; expandedGroups: Set<string>; collapsedProperties: Set<string>; sortAsc: boolean; onToggleGroup: (id: string) => void; onToggleProperty: (property: string) => void; onUpload: () => void }) {
  const assignments = recordGroupAssignments(groups, records);
  const compare = (left: string, right: string) => (sortAsc ? 1 : -1) * left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  const sortedGroups = [...groups].sort((a, b) => compare(a.name, b.name));
  const ungrouped = records.filter((_record, index) => !assignments.has(index)).sort((a, b) => compare(a.property, b.property));
  return <section><div className="mb-5"><div className="caption text-[.66rem] mb-1">Step 3 · Rent-roll data</div><h2 className="font-serif text-[1.55rem] font-bold">Occupancy</h2><p className="mt-1 text-[.78rem] text-muted max-w-3xl">Import a rent roll to match occupancy and scheduled rent to each property. Group summaries use the Groups workbook; expand a group to see the individual properties.</p></div>{records.length === 0 ? <EmptyDataCard title="No rent roll imported" description="Upload a rent roll above. The template accepts one row per property or one row per unit." onUpload={onUpload} button="↑ Upload Rent Roll" /> : <div className="flex flex-col gap-5">{sortedGroups.map((group) => { const entries = records.filter((_record, index) => assignments.get(index) === group.id); return entries.length ? <OccupancyGroupCard key={group.id} group={group} records={entries} expanded={expandedGroups.has(group.id)} onToggle={() => onToggleGroup(group.id)} /> : null; })}{ungrouped.map((record) => <OccupancyPropertyCard key={record.property} record={record} collapsed={collapsedProperties.has(propertyKey(record.property))} onToggle={() => onToggleProperty(record.property)} />)}</div>}<GroupingNote /></section>;
}

function OccupancyGroupCard({ group, records, expanded, onToggle }: { group: DealGroup; records: OccupancyRecord[]; expanded: boolean; onToggle: () => void }) {
  const units = records.reduce((sum, record) => sum + record.units, 0); const occupied = records.reduce((sum, record) => sum + record.occupiedUnits, 0); const rent = records.reduce((sum, record) => sum + record.scheduledRent, 0);
  return <article className="card overflow-hidden border-l-[4px] border-l-a"><button type="button" className="w-full px-4 py-3 bg-surface2 border-b border-border flex flex-wrap justify-between gap-3 items-center text-left cursor-pointer hover:bg-bg" onClick={onToggle}><GroupHeading name={group.name} detail={`Group total · ${records.length} imported properties`} /><div className="flex gap-6 text-right"><Metric label="Occupancy" value={units ? `${Math.round((occupied / units) * 100)}%` : '—'} /><Metric label="Occupied / units" value={`${occupied} / ${units}`} /><Metric label="Scheduled rent" value={money(rent)} /><span className="font-mono text-[.62rem] text-muted self-center">{expanded ? '▴ Collapse' : '▾ Expand'}</span></div></button>{expanded && <div className="p-4 bg-bg flex flex-col gap-4">{records.map((record) => <OccupancyPropertyCard key={record.property} record={record} nested />)}</div>}</article>;
}

function OccupancyPropertyCard({ record, nested = false, collapsed = false, onToggle }: { record: OccupancyRecord; nested?: boolean; collapsed?: boolean; onToggle?: () => void }) {
  const percent = record.units ? Math.round((record.occupiedUnits / record.units) * 100) : 0;
  return <article className={`card overflow-hidden ${nested ? 'shadow-none' : ''}`}><header className="bg-surface2 border-b border-border"><button type="button" className={`w-full px-4 py-3 flex flex-wrap justify-between gap-3 items-center text-left ${onToggle ? 'cursor-pointer hover:bg-bg' : ''}`} onClick={onToggle}><div><div className="font-serif text-[1.08rem] font-bold">{record.property}</div><div className="caption text-[.56rem] mt-1">Rent-roll property</div></div><div className="flex gap-6 text-right items-center"><Metric label="Occupancy" value={`${percent}%`} /><Metric label="Occupied / units" value={`${record.occupiedUnits} / ${record.units}`} /><Metric label="Scheduled rent" value={money(record.scheduledRent)} />{onToggle && <span className="font-mono text-[.62rem] text-muted self-center">{collapsed ? '▾ Expand' : '▴ Collapse'}</span>}</div></button></header>{!collapsed && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 py-3 text-[.75rem]"><Detail label="Units" value={String(record.units)} /><Detail label="Occupied units" value={String(record.occupiedUnits)} /><Detail label="As of" value={record.asOf || '—'} /></div>}</article>;
}

type LoanProperty = { property: string; loans: LoanRecord[]; outstandingBalance: number; monthlyDebtService: number };
function loanProperties(records: LoanRecord[]) {
  const values = new Map<string, LoanProperty>();
  for (const record of records) { const value = values.get(record.property.toLowerCase()) ?? { property: record.property, loans: [], outstandingBalance: 0, monthlyDebtService: 0 }; value.loans.push(record); value.outstandingBalance += record.outstandingBalance; value.monthlyDebtService += record.monthlyDebtService; values.set(record.property.toLowerCase(), value); }
  return [...values.values()];
}

function LoansTabView({ records, groups, expandedGroups, sortAsc, onToggleGroup, onUpload }: { records: LoanRecord[]; groups: DealGroup[]; expandedGroups: Set<string>; sortAsc: boolean; onToggleGroup: (id: string) => void; onUpload: () => void }) {
  const properties = loanProperties(records); const assignments = recordGroupAssignments(groups, properties);
  const compare = (left: string, right: string) => (sortAsc ? 1 : -1) * left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  const sortedGroups = [...groups].sort((a, b) => compare(a.name, b.name)); const ungrouped = properties.filter((_property, index) => !assignments.has(index)).sort((a, b) => compare(a.property, b.property));
  return <section><div className="mb-5"><div className="caption text-[.66rem] mb-1">Step 4 · Loan data</div><h2 className="font-serif text-[1.55rem] font-bold">Loans</h2><p className="mt-1 text-[.78rem] text-muted max-w-3xl">Import the loan schedule to match outstanding debt and debt service to each property. Group totals are calculated from the same Groups workbook used throughout the Data workspace.</p></div>{records.length === 0 ? <EmptyDataCard title="No loan schedule imported" description="Upload a loan schedule above. Use the template for one loan per property row." onUpload={onUpload} button="↑ Upload Loan Schedule" /> : <div className="flex flex-col gap-5">{sortedGroups.map((group) => { const entries = properties.filter((_property, index) => assignments.get(index) === group.id); return entries.length ? <LoansGroupCard key={group.id} group={group} properties={entries} expanded={expandedGroups.has(group.id)} onToggle={() => onToggleGroup(group.id)} /> : null; })}{ungrouped.map((property) => <LoanPropertyCard key={property.property} property={property} />)}</div>}<GroupingNote /></section>;
}

function LoansGroupCard({ group, properties, expanded, onToggle }: { group: DealGroup; properties: LoanProperty[]; expanded: boolean; onToggle: () => void }) {
  const balance = properties.reduce((sum, property) => sum + property.outstandingBalance, 0); const service = properties.reduce((sum, property) => sum + property.monthlyDebtService, 0);
  return <article className="card overflow-hidden border-l-[4px] border-l-a"><button type="button" className="w-full px-4 py-3 bg-surface2 border-b border-border flex flex-wrap justify-between gap-3 items-center text-left cursor-pointer hover:bg-bg" onClick={onToggle}><GroupHeading name={group.name} detail={`Group total · ${properties.length} properties`} /><div className="flex gap-6 text-right"><Metric label="Outstanding balance" value={money(balance)} /><Metric label="Monthly debt service" value={money(service)} /><span className="font-mono text-[.62rem] text-muted self-center">{expanded ? '▴ Collapse' : '▾ Expand'}</span></div></button>{expanded && <div className="p-4 bg-bg flex flex-col gap-4">{properties.map((property) => <LoanPropertyCard key={property.property} property={property} nested />)}</div>}</article>;
}

function LoanPropertyCard({ property, nested = false }: { property: LoanProperty; nested?: boolean }) {
  return <article className={`card overflow-hidden ${nested ? 'shadow-none' : ''}`}><header className="px-4 py-3 bg-surface2 border-b border-border flex flex-wrap justify-between gap-3"><div><div className="font-serif text-[1.08rem] font-bold">{property.property}</div><div className="caption text-[.56rem] mt-1">{property.loans.length} {property.loans.length === 1 ? 'loan' : 'loans'}</div></div><div className="flex gap-6 text-right"><Metric label="Outstanding balance" value={money(property.outstandingBalance)} /><Metric label="Monthly debt service" value={money(property.monthlyDebtService)} /></div></header><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-[.73rem]"><thead className="font-mono uppercase tracking-[.07em] text-[.58rem] text-muted border-b border-border"><tr><th className="text-left px-4 py-2.5">Lender</th><th className="text-left px-3 py-2.5">Loan type</th><th className="text-right px-3 py-2.5">Interest rate</th><th className="text-right px-3 py-2.5">Outstanding balance</th><th className="text-right px-3 py-2.5">Monthly P&I</th><th className="text-right px-3 py-2.5">Next rate date</th><th className="text-right px-4 py-2.5">Maturity</th></tr></thead><tbody>{property.loans.map((loan, index) => <tr key={`${loan.lender}-${index}`} className="border-b last:border-b-0 border-border"><td className="px-4 py-2.5 font-semibold">{loan.lender || '—'}</td><td className="px-3 py-2.5">{loan.loanType || '—'}</td><td className="px-3 py-2.5 text-right font-mono">{typeof loan.interestRate === 'number' ? `${loan.interestRate.toFixed(2)}%` : '—'}</td><td className="px-3 py-2.5 text-right font-mono font-bold text-a">{money(loan.outstandingBalance)}</td><td className="px-3 py-2.5 text-right font-mono">{money(loan.monthlyDebtService)}</td><td className="px-3 py-2.5 text-right">{loan.nextInterestRateDate || '—'}</td><td className="px-4 py-2.5 text-right">{loan.maturityDate || '—'}</td></tr>)}</tbody></table></div></article>;
}

type CapexProperty = { property: string; records: CapitalExpenseRecord[]; approximateCost: number };
function capexProperties(records: CapitalExpenseRecord[]) { const values = new Map<string, CapexProperty>(); for (const record of records) { const item = values.get(propertyKey(record.property)) ?? { property: record.property, records: [], approximateCost: 0 }; item.records.push(record); item.approximateCost += record.approximateCost; values.set(propertyKey(record.property), item); } return [...values.values()]; }
function CapitalExpensesTabView({ records, groups, expandedGroups, sortAsc, onToggleGroup, onUpload }: { records: CapitalExpenseRecord[]; groups: DealGroup[]; expandedGroups: Set<string>; sortAsc: boolean; onToggleGroup: (id: string) => void; onUpload: () => void }) {
  const properties = capexProperties(records);
  const compare = (left: string, right: string) => (sortAsc ? 1 : -1) * left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  const grouped = [...groups].sort((a, b) => compare(a.name, b.name)).map((group) => ({ group, properties: properties.filter((property) => group.members.some((member) => propertyMatches(member.property, property.property))) }));
  const ungrouped = properties.filter((property) => !groups.some((group) => group.members.some((member) => propertyMatches(member.property, property.property)))).sort((a, b) => compare(a.property, b.property));
  return <section><div className="mb-5"><div className="caption text-[.66rem] mb-1">Step 5 · Property-management report</div><h2 className="font-serif text-[1.55rem] font-bold">Capital Expenses</h2><p className="mt-1 text-[.78rem] text-muted max-w-3xl">Upload the native CapEx, work-order, budget, or property-financial report. The Groups workbook remains the hierarchy, including properties with no CapEx item in this report.</p></div>{records.length === 0 ? <EmptyDataCard title="No Capital Expenses report imported" description="Upload the source property-management report. A manual template is available only if a report export is unavailable." onUpload={onUpload} button="↑ Upload CapEx Report" /> : <div className="flex flex-col gap-5">{grouped.map(({ group, properties: entries }) => <CapitalExpensesGroupCard key={group.id} group={group} properties={entries} expanded={expandedGroups.has(group.id)} onToggle={() => onToggleGroup(group.id)} />)}{ungrouped.map((property) => <CapitalExpensesPropertyCard key={property.property} property={property} />)}</div>}<GroupingNote /></section>;
}
function CapitalExpensesGroupCard({ group, properties, expanded, onToggle }: { group: DealGroup; properties: CapexProperty[]; expanded: boolean; onToggle: () => void }) {
  const total = properties.reduce((sum, property) => sum + property.approximateCost, 0);
  const unmatchedMembers = group.members.filter((member) => !properties.some((property) => propertyMatches(member.property, property.property)));
  return <article className="card overflow-hidden border-l-[4px] border-l-a"><button type="button" onClick={onToggle} className="w-full px-4 py-3 bg-surface2 border-b border-border flex flex-wrap justify-between gap-3 items-center text-left cursor-pointer hover:bg-bg"><GroupHeading name={group.name} detail={`Group total · ${group.members.length} properties`} /><div className="flex gap-6 text-right"><Metric label="Approximate cost" value={money(total)} /><span className="font-mono text-[.62rem] text-muted self-center">{expanded ? '▴ Collapse' : '▾ Expand'}</span></div></button>{expanded && <div className="p-4 bg-bg flex flex-col gap-4">{properties.map((property) => <CapitalExpensesPropertyCard key={property.property} property={property} displayName={group.members.find((member) => propertyMatches(member.property, property.property))?.property} nested />)}{unmatchedMembers.map((member) => <MissingCapitalExpensesPropertyCard key={member.property} member={member} />)}</div>}</article>;
}
function CapitalExpensesPropertyCard({ property, displayName = property.property, nested = false }: { property: CapexProperty; displayName?: string; nested?: boolean }) { return <article className={`card overflow-hidden ${nested ? 'shadow-none' : ''}`}><header className="px-4 py-3 bg-surface2 border-b border-border flex flex-wrap justify-between gap-3"><div><div className="font-serif text-[1.08rem] font-bold">{displayName}</div><div className="caption text-[.56rem] mt-1">{property.records.length} Capital Expenses item{property.records.length === 1 ? '' : 's'}{displayName !== property.property ? ` · AppFolio: ${property.property}` : ''}</div></div><Metric label="Approximate cost" value={money(property.approximateCost)} /></header><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-[.73rem]"><thead className="font-mono uppercase tracking-[.07em] text-[.58rem] text-muted border-b border-border"><tr><th className="text-left px-4 py-2.5">Need / Description</th><th className="text-left px-3 py-2.5">Category</th><th className="text-left px-3 py-2.5">Status</th><th className="text-right px-3 py-2.5">Approx. cost</th><th className="text-right px-4 py-2.5">As of / source</th></tr></thead><tbody>{property.records.map((record, index) => <tr key={`${record.need}-${index}`} className="border-b last:border-b-0 border-border"><td className="px-4 py-2.5 font-semibold">{record.need || '—'}</td><td className="px-3 py-2.5">{record.category || '—'}</td><td className="px-3 py-2.5">{record.status || '—'}</td><td className="px-3 py-2.5 text-right font-mono font-bold text-a">{money(record.approximateCost)}</td><td className="px-4 py-2.5 text-right text-muted">{[record.asOf, record.source].filter(Boolean).join(' · ') || '—'}</td></tr>)}</tbody></table></div></article>; }
function MissingCapitalExpensesPropertyCard({ member }: { member: GroupMember }) { return <article className="card border border-dashed border-border bg-surface px-4 py-3"><div className="font-serif text-[1.08rem] font-bold">{member.property}</div><WorkbookPropertyDetails member={member} /><div className="mt-2 font-mono text-[.61rem] text-muted">No Capital Expenses item was found for this grouped property in the uploaded report.</div></article>; }

function MarketValueTabView({ records, groups, expandedGroups, sortAsc, onToggleGroup, onUpload }: { records: MarketValueRecord[]; groups: DealGroup[]; expandedGroups: Set<string>; sortAsc: boolean; onToggleGroup: (id: string) => void; onUpload: () => void }) { const assignments = recordGroupAssignments(groups, records); const compare = (left: string, right: string) => (sortAsc ? 1 : -1) * left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }); const ungrouped = records.filter((_r, index) => !assignments.has(index)).sort((a, b) => compare(a.property, b.property)); return <section><div className="mb-5"><div className="caption text-[.66rem] mb-1">Step 7 · Valuation report</div><h2 className="font-serif text-[1.55rem] font-bold">Market Value</h2><p className="mt-1 text-[.78rem] text-muted max-w-3xl">Upload the valuation, appraisal, listing, or property-financial report. Group totals equal the market values of the properties in that group.</p></div>{records.length === 0 ? <EmptyDataCard title="No Market Value report imported" description="Upload the source valuation report. A fallback template is available only if a report export is unavailable." onUpload={onUpload} button="↑ Upload Market Value Report" /> : <div className="flex flex-col gap-5">{[...groups].sort((a, b) => compare(a.name, b.name)).map((group) => { const entries = records.filter((_r, index) => assignments.get(index) === group.id); return entries.length ? <MarketValueGroupCard key={group.id} group={group} records={entries} expanded={expandedGroups.has(group.id)} onToggle={() => onToggleGroup(group.id)} /> : null; })}{ungrouped.map((record) => <MarketValuePropertyCard key={record.property} record={record} />)}</div>}<GroupingNote /></section>; }
function MarketValueGroupCard({ group, records, expanded, onToggle }: { group: DealGroup; records: MarketValueRecord[]; expanded: boolean; onToggle: () => void }) { const total = records.reduce((sum, record) => sum + record.marketValue, 0); return <article className="card overflow-hidden border-l-[4px] border-l-a"><button type="button" onClick={onToggle} className="w-full px-4 py-3 bg-surface2 border-b border-border flex flex-wrap justify-between gap-3 items-center text-left cursor-pointer hover:bg-bg"><GroupHeading name={group.name} detail={`Group total · ${records.length} properties`} /><div className="flex gap-6 text-right"><Metric label="Market value" value={money(total)} /><span className="font-mono text-[.62rem] text-muted self-center">{expanded ? '▴ Collapse' : '▾ Expand'}</span></div></button>{expanded && <div className="p-4 bg-bg flex flex-col gap-4">{records.map((record) => <MarketValuePropertyCard key={record.property} record={record} nested />)}</div>}</article>; }
function MarketValuePropertyCard({ record, nested = false }: { record: MarketValueRecord; nested?: boolean }) { return <article className={`card overflow-hidden ${nested ? 'shadow-none' : ''}`}><header className="px-4 py-3 bg-surface2 border-b border-border flex flex-wrap justify-between gap-3"><div><div className="font-serif text-[1.08rem] font-bold">{record.property}</div><div className="caption text-[.56rem] mt-1">{[record.valueType, record.asOf].filter(Boolean).join(' · ') || 'Market Value report'}</div></div><Metric label="Market value" value={money(record.marketValue)} /></header><div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 py-3 text-[.75rem]"><Detail label="Value type" value={record.valueType || '—'} /><Detail label="As of" value={record.asOf || '—'} /><Detail label="Source" value={record.source || '—'} /></div></article>; }

type IncomeExpenseTotals = Pick<IncomeExpenseRecord, 'income' | 'expenses' | 'noi'>;
const incomeExpenseTotals = (records: readonly IncomeExpenseRecord[]): IncomeExpenseTotals => records.reduce((total, record) => ({ income: total.income + record.income, expenses: total.expenses + record.expenses, noi: total.noi + record.noi }), { income: 0, expenses: 0, noi: 0 });

function IncomeExpensesTabView({ records, groups, expandedGroups, sort, onToggleGroup, onUpload }: { records: IncomeExpenseRecord[]; groups: DealGroup[]; expandedGroups: Set<string>; sort: { key: 'income' | 'expenses' | 'noi'; asc: boolean }; onToggleGroup: (id: string) => void; onUpload: () => void }) {
  const assignments = recordGroupAssignments(groups, records);
  const compare = (left: number, right: number) => (left - right) * (sort.asc ? 1 : -1);
  const grouped = groups.map((group) => ({ group, records: records.filter((_record, index) => assignments.get(index) === group.id) })).filter((item) => item.records.length).sort((left, right) => compare(incomeExpenseTotals(left.records)[sort.key], incomeExpenseTotals(right.records)[sort.key]));
  const ungrouped = records.filter((_record, index) => !assignments.has(index)).sort((left, right) => compare(left[sort.key], right[sort.key]));
  return <section><div className="mb-5"><div className="caption text-[.66rem] mb-1">Step 6 · AppFolio property summary</div><h2 className="font-serif text-[1.55rem] font-bold">Income &amp; Expenses</h2><p className="mt-1 text-[.78rem] text-muted max-w-3xl">Upload an AppFolio property-summary Income Statement or P&amp;L. The tool extracts total income, total expenses, and NOI; the same Groups workbook determines every roll-up.</p></div>{records.length === 0 ? <EmptyDataCard title="No Income & Expenses report imported" description="Upload the AppFolio property-summary report, or use the manual template if an export is unavailable." onUpload={onUpload} button="↑ Upload AppFolio Report" /> : <div className="flex flex-col gap-5">{grouped.map(({ group, records: groupRecords }) => <IncomeExpensesGroupCard key={group.id} group={group} records={groupRecords} expanded={expandedGroups.has(group.id)} onToggle={() => onToggleGroup(group.id)} />)}{ungrouped.map((record) => <IncomeExpensesPropertyCard key={record.property} record={record} />)}</div>}<GroupingNote /></section>;
}

function IncomeExpensesGroupCard({ group, records, expanded, onToggle }: { group: DealGroup; records: IncomeExpenseRecord[]; expanded: boolean; onToggle: () => void }) {
  const total = incomeExpenseTotals(records);
  return <article className="card overflow-hidden border-l-[4px] border-l-a"><button type="button" onClick={onToggle} className="w-full px-4 py-3 bg-surface2 border-b border-border flex flex-wrap justify-between gap-3 items-center text-left cursor-pointer hover:bg-bg"><GroupHeading name={group.name} detail={`Group total · ${records.length} imported properties`} /><IncomeExpenseMetrics total={total} /><span className="font-mono text-[.62rem] text-muted self-center">{expanded ? '▴ Collapse' : '▾ Expand'}</span></button>{expanded && <div className="p-4 bg-bg flex flex-col gap-4">{records.map((record) => <IncomeExpensesPropertyCard key={record.property} record={record} nested />)}</div>}</article>;
}

function IncomeExpensesPropertyCard({ record, nested = false }: { record: IncomeExpenseRecord; nested?: boolean }) {
  return <article className={`card overflow-hidden ${nested ? 'shadow-none' : ''}`}><header className="px-4 py-3 bg-surface2 border-b border-border flex flex-wrap justify-between gap-3"><div><div className="font-serif text-[1.08rem] font-bold">{record.property}</div><div className="caption text-[.56rem] mt-1">{[record.asOf, record.source].filter(Boolean).join(' · ') || 'AppFolio report'}</div></div><IncomeExpenseMetrics total={record} /></header></article>;
}

function IncomeExpenseMetrics({ total }: { total: IncomeExpenseTotals }) { return <div className="flex gap-6 text-right"><Metric label="Income" value={money(total.income)} /><Metric label="Expenses" value={money(total.expenses)} /><Metric label="NOI" value={money(total.noi)} /></div>; }

function GroupHeading({ name, detail }: { name: string; detail: string }) { return <div><div className="font-serif text-[1.12rem] font-bold">{name}</div><div className="caption text-[.58rem] mt-1">{detail}</div></div>; }

function Metric({ label, value }: { label: string; value: string }) { return <div><div className="caption text-[.56rem]">{label}</div><div className="font-mono font-bold text-a mt-1">{value}</div></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><div className="caption text-[.56rem]">{label}</div><div className="mt-1 font-mono">{value}</div></div>; }
function EmptyDataCard({ title, description, button, onUpload }: { title: string; description: string; button: string; onUpload: () => void }) { return <div className="card text-center py-16 px-6 border-2 border-dashed border-border"><div className="font-serif text-[1.25rem] font-bold">{title}</div><p className="text-muted max-w-md mx-auto mt-2 text-[.78rem]">{description}</p><button type="button" className="tool-btn tool-btn-primary mt-5" onClick={onUpload}>{button}</button></div>; }
function GroupingNote() { return <div className="mt-5 note max-w-5xl">The Groups workbook controls the roll-ups. Grouped properties remain separately available when you expand their group; properties without a Group remain individual.</div>; }

function GroupsTab({ groups, properties, onAdd, onUpdate, onRemove, onToggleMember, onUpload }: { groups: DealGroup[]; properties: PropertySchedule[]; onAdd: () => void; onUpdate: (id: string, patch: Partial<DealGroup>) => void; onRemove: (id: string) => void; onToggleMember: (groupId: string, property: PropertySchedule) => void; onUpload: () => void }) {
  return <section><div className="flex flex-wrap justify-between items-end gap-4 mb-5"><div><div className="caption text-[.66rem] mb-1">Step 1 · Selection-unit setup</div><h2 className="font-serif text-[1.55rem] font-bold">Groups</h2><p className="mt-1 text-[.78rem] text-muted max-w-3xl">Define combined lots and economic packages here. This mapping controls the totals sent to the Partition Tool and the collapsed view in Remaining Depreciation; it never merges the underlying tax schedules.</p></div><button type="button" className="tool-btn tool-btn-primary" onClick={onAdd}>+ Add group</button></div>{properties.length === 0 && <div className="note mb-4">Create group names now if useful. After uploading tax returns, return here to assign the extracted properties to each group.<button type="button" className="ml-2 underline text-a cursor-pointer" onClick={onUpload}>Upload tax returns</button></div>}<div className="grid grid-cols-1 xl:grid-cols-2 gap-5">{groups.map((group) => <GroupCard key={group.id} group={group} properties={properties} onUpdate={onUpdate} onRemove={onRemove} onToggleMember={onToggleMember} />)}{groups.length === 0 && <div className="card p-8 text-center text-muted"><div className="font-serif text-[1.15rem] font-bold text-text">No groups defined</div><p className="max-w-md mx-auto mt-2 text-[.78rem]">Add only properties that should be selected as one combined lot or economic package. Ungrouped properties remain individual selection units.</p><button type="button" onClick={onAdd} className="tool-btn tool-btn-primary mt-5">+ Add first group</button></div>}</div></section>;
}

function GroupCard({ group, properties, onUpdate, onRemove, onToggleMember }: { group: DealGroup; properties: PropertySchedule[]; onUpdate: (id: string, patch: Partial<DealGroup>) => void; onRemove: (id: string) => void; onToggleMember: (groupId: string, property: PropertySchedule) => void }) { return <article className="card overflow-hidden"><header className="px-4 py-3 bg-surface2 border-b border-border flex justify-between gap-3"><div><div className="caption text-[.58rem]">Combined lot / economic package</div><input aria-label="Group name" value={group.name} onChange={(event) => onUpdate(group.id, { name: event.target.value })} className="mt-1 bg-transparent border-b border-border focus:border-ink outline-none font-serif text-[1.08rem] font-bold w-60" /></div><button type="button" onClick={() => onRemove(group.id)} className="font-mono text-[.6rem] uppercase text-muted hover:text-red cursor-pointer">Remove</button></header><div className="p-4"><div className="font-mono text-[.61rem] uppercase tracking-[.07em] text-muted mb-2">Member properties</div>{properties.length === 0 ? <p className="text-[.75rem] text-muted">Property choices will appear after tax-return import.</p> : <div className="flex flex-col gap-2">{properties.map((property) => <label key={property.id} className="flex gap-2.5 items-start cursor-pointer"><input type="checkbox" checked={hasMember(group, property)} onChange={() => onToggleMember(group.id, property)} className="mt-0.5 accent-[var(--a)]" /><span><span className="font-semibold text-[.78rem]">{property.property}</span><span className="block font-mono text-[.61rem] text-muted mt-0.5">{property.entity || 'Entity not detected'}</span></span></label>)}</div>}</div></article>; }

function DataTabView({ taxYear, setTaxYear, properties, groups, assignments, sortAsc, importing, progress, importError, onUpload, expandedGroups, collapsedProperties, warnings, documents, onToggleExpanded, onTogglePropertyCollapsed, onUpdateProperty, onUpdateComponent, onGoGroups }: { taxYear: number; setTaxYear: (year: number) => void; properties: PropertySchedule[]; groups: DealGroup[]; assignments: Map<string, string>; sortAsc: boolean; importing: boolean; progress: ExtractionProgress | null; importError: string | null; onUpload: () => void; expandedGroups: Set<string>; collapsedProperties: Set<string>; warnings: string[]; documents: string[]; onToggleExpanded: (id: string) => void; onTogglePropertyCollapsed: (id: string) => void; onUpdateProperty: (id: string, patch: Partial<Omit<PropertySchedule, 'id' | 'schedules'>>) => void; onUpdateComponent: (propertyId: string, componentId: string, patch: Partial<ScheduleItem>) => void; onGoGroups: () => void }) {
  const groupedIds = new Set(assignments.keys());
  const byName = (a: string, b: string) => (sortAsc ? 1 : -1) * a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  const sortedGroups = [...groups].sort((a, b) => byName(a.name, b.name));
  const sortedUngrouped = properties.filter((property) => !groupedIds.has(property.id)).sort((a, b) => byName(a.property, b.property));
  return <section>
    <div className="flex flex-wrap justify-between items-end gap-4 mb-5"><div><div className="caption text-[.66rem] mb-1">Step 2 · Tax-return data extraction</div><h2 className="font-serif text-[1.55rem] font-bold">Remaining Tax Basis and Depreciation</h2><p className="mt-1 text-[.78rem] text-muted max-w-3xl">Grouped properties collapse to one selection-unit total. Expand a group to review the underlying property schedules, remaining basis, and current-year depreciation.</p></div><label className="flex items-center gap-1.5 border-[1.5px] border-border rounded-[3px] bg-surface px-2.5 py-1.5"><span className="font-mono text-[.59rem] uppercase tracking-[.07em] text-muted">Tax year</span><input value={taxYear} onChange={(event) => setTaxYear(Number(event.target.value) || taxYear)} className="w-11 bg-transparent text-right outline-none font-mono text-[.74rem] font-bold" inputMode="numeric" /></label></div>
    {documents.length > 0 && <div className="mb-4 flex flex-wrap gap-2 items-center"><span className="caption text-[.61rem]">Imported returns</span>{documents.map((document) => <span key={document} className="font-mono text-[.65rem] border border-border rounded px-2 py-1 bg-surface">{document}</span>)}</div>}
    {warnings.length > 0 && <div className="mb-4 note border-l-red">{warnings.map((warning) => <div key={warning}>{warning}</div>)}</div>}
    {importing && <ImportProgress progress={progress} />}{importError && !importing && <div className="mb-4 note border-l-red" role="alert"><div className="font-bold">Import failed</div><div className="mt-1">{importError}</div><div className="mt-1 text-muted">Refresh the page and try again. If it keeps failing, the PDF may be scanned images rather than text.</div></div>}
    {properties.length === 0 ? (!importing && <div className="card text-center py-16 px-6 border-2 border-dashed border-border"><div className="font-serif text-[1.25rem] font-bold">No tax returns imported</div><p className="text-muted max-w-md mx-auto mt-2 text-[.78rem]">Drag and drop the Form 1065 PDF packages anywhere on this page, or use the upload button. The importer creates the property schedules automatically.</p><button type="button" className="tool-btn tool-btn-primary mt-5" onClick={onUpload}>↑ Upload tax return PDFs</button></div>) : <div className="flex flex-col gap-5">{sortedGroups.map((group) => { const members = properties.filter((property) => assignments.get(property.id) === group.id); return <GroupedSchedule key={group.id} group={group} properties={members} workbookMembers={group.members} taxYear={taxYear} expanded={expandedGroups.has(group.id)} collapsedProperties={collapsedProperties} onToggle={() => onToggleExpanded(group.id)} onTogglePropertyCollapsed={onTogglePropertyCollapsed} onUpdateProperty={onUpdateProperty} onUpdateComponent={onUpdateComponent} />; })}{sortedUngrouped.map((property) => <PropertyScheduleCard key={property.id} property={property} taxYear={taxYear} collapsed={collapsedProperties.has(property.id)} onToggleCollapsed={() => onTogglePropertyCollapsed(property.id)} onUpdateProperty={onUpdateProperty} onUpdateComponent={onUpdateComponent} />)}</div>}
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

/** Visible while PDFs are being read so a long import never looks frozen. */
function ImportProgress({ progress }: { progress: ExtractionProgress | null }) {
  const fraction = progress ? Math.min(1, ((progress.fileIndex - 1) + progress.page / Math.max(1, progress.pageCount)) / Math.max(1, progress.fileCount)) : 0;
  return <div className="card mb-5 px-6 py-5 border-l-[4px] border-l-a" role="status" aria-live="polite"><div className="flex items-center gap-3"><span className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-[3px] border-a border-t-transparent" aria-hidden="true" /><div className="min-w-0"><div className="font-serif text-[1.15rem] font-bold">Reading tax returns…</div><div className="mt-0.5 font-mono text-[.66rem] text-muted truncate">{progress ? `File ${progress.fileIndex} of ${progress.fileCount} · ${progress.file} · page ${progress.page} of ${progress.pageCount}` : 'Opening the PDF files…'}</div></div><div className="ml-auto font-mono text-[.9rem] font-bold text-a">{Math.round(fraction * 100)}%</div></div><div className="mt-3 h-2 w-full rounded bg-surface2 overflow-hidden"><div className="h-full bg-a transition-[width] duration-200" style={{ width: `${Math.max(3, fraction * 100)}%` }} /></div><div className="mt-2 font-mono text-[.6rem] uppercase tracking-[.07em] text-muted">Runs locally in your browser — nothing is uploaded</div></div>;
}

function GroupedSchedule({ group, properties, workbookMembers = group.members, taxYear, expanded, collapsedProperties = new Set<string>(), onToggle, onTogglePropertyCollapsed, onUpdateProperty, onUpdateComponent }: { group: DealGroup; properties: PropertySchedule[]; workbookMembers?: GroupMember[]; taxYear: number; expanded: boolean; collapsedProperties?: Set<string>; onToggle: () => void; onTogglePropertyCollapsed?: (id: string) => void; onUpdateProperty: (id: string, patch: Partial<Omit<PropertySchedule, 'id' | 'schedules'>>) => void; onUpdateComponent: (propertyId: string, componentId: string, patch: Partial<ScheduleItem>) => void }) {
  const total = totals(properties);
  const unmatchedMembers = workbookMembers.filter((member) => !properties.some((property) => propertyMatches(member.property, property.property)));
  return <article className="card overflow-hidden border-l-[4px] border-l-a"><button type="button" onClick={onToggle} className="w-full px-4 py-3 bg-surface2 border-b border-border flex flex-wrap justify-between gap-3 items-center text-left cursor-pointer hover:bg-bg"><GroupHeading name={group.name} detail={`Group total · ${workbookMembers.length} properties`} /><div className="flex gap-7 text-right"><div><div className="caption text-[.56rem]">Basis left</div><div className="font-mono font-bold text-a mt-1">{money(total.basis)}</div></div><div><div className="caption text-[.56rem]">Depreciation {taxYear}</div><div className="font-mono font-bold text-yellow mt-1">{money(total.depreciation)}</div></div><div className="font-mono text-muted self-center">{expanded ? '▴ Collapse' : '▾ Expand'}</div></div></button>{expanded && <div className="p-4 bg-bg flex flex-col gap-4">{properties.map((property) => <PropertyScheduleCard key={property.id} property={property} taxYear={taxYear} collapsed={collapsedProperties.has(property.id)} onToggleCollapsed={onTogglePropertyCollapsed ? () => onTogglePropertyCollapsed(property.id) : undefined} onUpdateProperty={onUpdateProperty} onUpdateComponent={onUpdateComponent} nested />)}{unmatchedMembers.map((member) => <article key={member.property} className="border border-border rounded-[3px] bg-surface px-4 py-3"><div className="font-serif text-[1rem] font-bold">{member.property}</div><WorkbookPropertyDetails member={member} /><div className="mt-2 font-mono text-[.61rem] text-muted">No matching tax-return schedule has been imported for this property yet.</div></article>)}</div>}</article>;
}

function PropertyScheduleCard({ property, taxYear, collapsed = false, onToggleCollapsed, onUpdateProperty, onUpdateComponent, nested = false }: { property: PropertySchedule; taxYear: number; collapsed?: boolean; onToggleCollapsed?: () => void; onUpdateProperty: (id: string, patch: Partial<Omit<PropertySchedule, 'id' | 'schedules'>>) => void; onUpdateComponent: (propertyId: string, componentId: string, patch: Partial<ScheduleItem>) => void; nested?: boolean }) {
  const hasAccelerated = property.schedules.some((item) => item.method === 'MACRS / accelerated');
  const total = totals([property]);
  return <article className={`card overflow-hidden ${nested ? 'shadow-none' : ''}`}><header className="px-4 py-3 bg-surface2 border-b border-border flex flex-wrap justify-between gap-3 items-start"><div className="grid gap-1.5"><input aria-label="Property name" value={property.property} onChange={(event) => onUpdateProperty(property.id, { property: event.target.value })} className="bg-transparent border-b border-border focus:border-ink outline-none font-serif text-[1.08rem] font-bold w-60" /><div className="font-mono text-[.61rem] uppercase tracking-[.07em] text-muted">{property.entity} · {property.source}</div></div><div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-right"><span className={`font-mono text-[.59rem] uppercase tracking-[.06em] rounded px-1.5 py-1 ${hasAccelerated ? 'bg-a-light text-a' : 'bg-surface border border-border text-muted'}`}>{hasAccelerated ? 'MACRS included' : 'Straight-line only'}</span><div><div className="caption text-[.56rem]">Basis left</div><div className="font-mono font-bold text-a">{money(total.basis)}</div></div><div><div className="caption text-[.56rem]">Depreciation {taxYear}</div><div className="font-mono font-bold text-yellow">{money(total.depreciation)}</div></div>{onToggleCollapsed && <button type="button" onClick={onToggleCollapsed} className="font-mono text-[.62rem] text-muted hover:text-text cursor-pointer">{collapsed ? '▾ Expand' : '▴ Collapse'}</button>}</div></header>{!collapsed && <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-[.73rem]"><thead className="font-mono uppercase tracking-[.07em] text-[.58rem] text-muted border-b border-border"><tr><th className="text-left px-4 py-2.5">Depreciable section</th><th className="text-left px-3 py-2.5">Method</th><th className="text-right px-3 py-2.5">Basis left</th><th className="text-right px-3 py-2.5">Recovery / est. left</th><th className="text-right px-4 py-2.5">{taxYear} deduction</th></tr></thead><tbody>{property.schedules.map((item) => <tr key={item.id} className="border-b last:border-b-0 border-border"><td className="px-4 py-2.5 font-semibold">{item.label}</td><td className="px-3 py-2.5"><span className={`font-mono text-[.58rem] uppercase tracking-[.04em] ${item.method === 'MACRS / accelerated' ? 'text-a font-bold' : 'text-muted'}`}>{item.method}</span></td><td className="px-3 py-2.5"><CurrencyField label="Basis left" value={item.basis} onChange={(value) => onUpdateComponent(property.id, item.id, { basis: value })} /></td><td className="px-3 py-2.5 text-right font-mono text-muted">{item.recoveryPeriod}{item.yearsLeft ? ` / ${item.yearsLeft} yrs` : ''}</td><td className="px-4 py-2.5"><NumberField label={`${taxYear} deduction`} value={item.annual} onChange={(value) => onUpdateComponent(property.id, item.id, { annual: value })} tone="text-yellow" /></td></tr>)}</tbody><tfoot className="bg-surface2 border-t-[1.5px] border-border"><tr><td colSpan={2} className="px-4 py-3 font-mono text-[.57rem] uppercase tracking-[.07em] text-muted">Property totals → Partition Tool</td><td className="px-3 py-3 text-right font-mono text-[1rem] font-bold text-a">{money(total.basis)}</td><td /><td className="px-4 py-3 text-right font-mono text-[1rem] font-bold text-yellow">{money(total.depreciation)}</td></tr></tfoot></table></div>}</article>;
}

function CurrencyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <div className="flex items-center justify-end gap-0.5 border-b border-border focus-within:border-ink"><span className="font-mono font-bold">$</span><input aria-label={label} value={value ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : ''} onChange={(event) => onChange(numeric(event.target.value))} inputMode="decimal" placeholder="0" className="min-w-0 flex-1 bg-transparent outline-none text-right font-mono font-bold" /></div>; }

function NumberField({ label, value, onChange, tone = '' }: { label: string; value: number; onChange: (value: number) => void; tone?: string }) { return <input aria-label={label} value={value || ''} onChange={(event) => onChange(numeric(event.target.value))} inputMode="decimal" placeholder="0" className={`w-full bg-transparent border-b border-border focus:border-ink outline-none text-right font-mono font-bold ${tone}`} />; }
