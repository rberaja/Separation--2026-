import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { nv } from '../lib/finance';
import { buildReport, type Report } from '../lib/report';
import { computeSettlement, type Settlement } from '../lib/settlement';
import { sortProperties } from '../lib/sort';
import type { Partner, Property } from '../lib/types';
import { initialState, reducer, type Action, type AppState } from './reducer';

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

const PARTITION_STORAGE_KEY = 'separation.partition.v1';

export function hydratePartitionState(snapshot: unknown): AppState {
  try {
    const saved = snapshot as Partial<AppState> | null;
    if (!saved || !Array.isArray(saved.properties)) return initialState;

    const ids = saved.properties.map((property) => Number(property?.id)).filter(Number.isFinite);
    const validSortKeys = new Set(['name', 'val', 'eq', 'ncf', 'bid', 'partner']);
    const persistedSort = saved.sort && validSortKeys.has(saved.sort.key) && typeof saved.sort.asc === 'boolean'
      ? saved.sort
      : initialState.sort;

    return {
      ...initialState,
      properties: saved.properties,
      nextId: Math.max(Number(saved.nextId) || 1, ...ids.map((id) => id + 1)),
      partnerNames: {
        a: typeof saved.partnerNames?.a === 'string' ? saved.partnerNames.a : initialState.partnerNames.a,
        b: typeof saved.partnerNames?.b === 'string' ? saved.partnerNames.b : initialState.partnerNames.b,
      },
      pctA: typeof saved.pctA === 'number' && saved.pctA >= 1 && saved.pctA <= 99 ? saved.pctA : initialState.pctA,
      discountRate: typeof saved.discountRate === 'number' || saved.discountRate === null ? saved.discountRate : initialState.discountRate,
      cashEquiv: typeof saved.cashEquiv === 'number' || saved.cashEquiv === null ? saved.cashEquiv : initialState.cashEquiv,
      depreciationYear: Number.isInteger(saved.depreciationYear) && (saved.depreciationYear ?? 0) > 1900 ? saved.depreciationYear! : initialState.depreciationYear,
      collapsedSelectionUnits: Array.isArray(saved.collapsedSelectionUnits) ? saved.collapsedSelectionUnits.filter((key): key is string => typeof key === 'string') : [],
      sort: persistedSort,
      theme: saved.theme === 'dark' || saved.theme === 'light' ? saved.theme : initialState.theme,
      // Upload notices describe a former browser session and should not be restored.
      upload: initialState.upload,
    };
  } catch {
    return initialState;
  }
}

function persistedInitialState(): AppState {
  if (typeof window === 'undefined') return initialState;
  try {
    return hydratePartitionState(JSON.parse(window.localStorage.getItem(PARTITION_STORAGE_KEY) ?? 'null'));
  } catch {
    return initialState;
  }
}

function savePartitionState(state: AppState) {
  try {
    const { upload: _upload, ...snapshot } = state;
    window.localStorage.setItem(PARTITION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* Storage can be unavailable in private browsing or when site storage is full. */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, persistedInitialState);
  useEffect(() => {
    savePartitionState(state);
  }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

/** Ownership shares as fractions (0.4 / 0.6). */
export function useOwnership(): Record<Partner, number> {
  const { state } = useApp();
  const a = state.pctA / 100;
  return useMemo(() => ({ a, b: 1 - a }), [a]);
}

/** Market discount rate as a fraction (0.065). */
export function useDiscountRate(): number {
  const { state } = useApp();
  return nv(state.discountRate) / 100;
}

export function useSettlement(): Settlement {
  const { state } = useApp();
  const dr = useDiscountRate();
  const { a: pctA } = useOwnership();
  const cash = nv(state.cashEquiv);
  return useMemo(
    () => computeSettlement(state.properties, dr, pctA, cash),
    [state.properties, dr, pctA, cash],
  );
}

export function useSortedProperties(): Property[] {
  const { state } = useApp();
  const dr = useDiscountRate();
  return useMemo(
    () => sortProperties(state.properties, state.sort, dr),
    [state.properties, state.sort, dr],
  );
}

/** Partner display names, falling back to the defaults when blank. */
export function usePartnerNames(): Record<Partner, string> {
  const { state } = useApp();
  return useMemo(
    () => ({
      a: state.partnerNames.a || 'Partner A',
      b: state.partnerNames.b || 'Partner B',
    }),
    [state.partnerNames],
  );
}

/** The full report model (property schedule, totals, gaps, verdict) for the Excel and print exports. */
export function useReport(): Report {
  const { state } = useApp();
  const settlement = useSettlement();
  const partnerNames = usePartnerNames();
  const { a: pctA } = useOwnership();
  return useMemo(
    () =>
      buildReport({
        properties: state.properties,
        settlement,
        partnerNames,
        pctA,
        discountRate: state.discountRate,
        cashEquiv: nv(state.cashEquiv),
        depreciationYear: state.depreciationYear,
      }),
    [state.properties, settlement, partnerNames, pctA, state.discountRate, state.cashEquiv, state.depreciationYear],
  );
}
