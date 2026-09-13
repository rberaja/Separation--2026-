import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
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
