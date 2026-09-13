import { useEffect, type CSSProperties } from 'react';
import type { Theme } from '../lib/types';
import { AppProvider, useApp } from '../store/AppContext';
import { Header } from './Header';
import { MarketRateBar } from './MarketRateBar';
import { PartnerStrip } from './PartnerStrip';
import { PartnerTotalsCard } from './PartnerTotalsCard';
import { PrintReport } from './PrintReport';
import { PropertyList } from './PropertyList';
import { ProportionalityMeters } from './ProportionalityMeters';
import { SettlementLedger } from './SettlementLedger';
import { Toolbar } from './Toolbar';
import { SectionHeading } from './ui/SectionHeading';
import { SplitHandle, useAsideWidth } from './ui/SplitHandle';
import { PlannedWorkspace } from './PlannedWorkspace';
import { TaxBasisMockup } from './TaxBasisMockup';
import { WorkspaceNav, useWorkspace } from './WorkspaceNav';
import { WORKSPACES } from '../lib/workspaces';

export const THEME_STORAGE_KEY = 'partition-tool:theme';

/** Root React island. Wraps the layout in the app store. */
export default function App() {
  return (
    <AppProvider>
      <ThemeSync />
      <Pages />
    </AppProvider>
  );
}

/**
 * Tab strip plus the active workspace. The Partition tool is the landing page;
 * the companion tools share its store so data carries across tabs.
 */
function Pages() {
  const [active, select] = useWorkspace();
  const planned = WORKSPACES.find((w) => w.id === active && w.planned);

  return (
    <>
      <WorkspaceNav active={active} onSelect={select} />
      {active === 'partition' && (
        <>
          {/* Everything on screen lives in #app-screen so the print stylesheet can swap it for the report. */}
          <div id="app-screen">
            <Header />
            <Toolbar />
            <MarketRateBar />
            <Workspace />
          </div>
          <PrintReport />
        </>
      )}
      {active === 'depreciation' && <TaxBasisMockup onOpenPartition={() => select('partition')} />}
      {planned && <PlannedWorkspace workspace={planned} />}
    </>
  );
}

/** Main column + resizable right-hand pane. Below the lg breakpoint they simply stack. */
function Workspace() {
  const [asideWidth, setAsideWidth, resetAsideWidth] = useAsideWidth();

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_var(--aside-w)] min-h-[calc(100vh-110px)]"
      style={{ '--aside-w': `${asideWidth}px` } as CSSProperties}
    >
      <main className="px-6 py-5 overflow-x-auto min-w-0">
        <PartnerStrip />
        <PropertyList />
      </main>
      <SplitHandle width={asideWidth} onResize={setAsideWidth} onReset={resetAsideWidth} />
      <aside className="px-4 py-5 flex flex-col gap-5 [&>*]:shrink-0 bg-bg lg:sticky lg:top-0 lg:h-[calc(100vh-110px)] lg:overflow-y-auto min-w-0">
        <div className="flex flex-col gap-[13px]">
          <SectionHeading>B. Partner Totals and Proportionality Check</SectionHeading>
          <PartnerTotalsCard partner="a" />
          <PartnerTotalsCard partner="b" />
        </div>
        <div>
          <SectionHeading>C. Proportionality vs. Target</SectionHeading>
          <ProportionalityMeters />
        </div>
        <div>
          <SectionHeading>D. Gap Analysis</SectionHeading>
          <SettlementLedger />
        </div>
      </aside>
    </div>
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
