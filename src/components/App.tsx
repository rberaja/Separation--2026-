import { useEffect } from 'react';
import type { Theme } from '../lib/types';
import { AppProvider, useApp } from '../store/AppContext';
import { Header } from './Header';
import { MarketRateBar } from './MarketRateBar';
import { PartnerStrip } from './PartnerStrip';
import { PartnerTotalsCard } from './PartnerTotalsCard';
import { PropertyList } from './PropertyList';
import { ProportionalityMeters } from './ProportionalityMeters';
import { SettlementLedger } from './SettlementLedger';
import { Toolbar } from './Toolbar';

export const THEME_STORAGE_KEY = 'partition-tool:theme';

/** Root React island. Wraps the layout in the app store. */
export default function App() {
  return (
    <AppProvider>
      <ThemeSync />
      <Header />
      <Toolbar />
      <MarketRateBar />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_348px] min-h-[calc(100vh-110px)]">
        <main className="px-6 py-5 lg:border-r border-border overflow-x-auto">
          <PartnerStrip />
          <PropertyList />
        </main>
        <aside className="p-4 flex flex-col gap-[13px] [&>*]:shrink-0 bg-bg lg:sticky lg:top-0 lg:h-[calc(100vh-110px)] lg:overflow-y-auto">
          <PartnerTotalsCard partner="a" />
          <PartnerTotalsCard partner="b" />
          <ProportionalityMeters />
          <SettlementLedger />
        </aside>
      </div>
    </AppProvider>
  );
}

/** Mirrors the theme in state onto <html data-theme> and persists it across visits. */
function ThemeSync() {
  const { state, dispatch } = useApp();

  // Pick up a previously saved theme once on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') dispatch({ type: 'theme/set', theme: saved satisfies Theme });
    } catch {
      /* storage unavailable — keep the default */
    }
  }, [dispatch]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, state.theme);
    } catch {
      /* ignore */
    }
  }, [state.theme]);

  return null;
}
