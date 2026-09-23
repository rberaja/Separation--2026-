import { useEffect, useState, type CSSProperties } from 'react';
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
const WELCOME_DISMISSED_STORAGE_KEY = 'partition-tool:welcome-dismissed';

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
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    try { setWelcomeOpen(window.localStorage.getItem(WELCOME_DISMISSED_STORAGE_KEY) !== 'true'); } catch { setWelcomeOpen(true); }
  }, []);

  const dismissWelcomePermanently = () => {
    try { window.localStorage.setItem(WELCOME_DISMISSED_STORAGE_KEY, 'true'); } catch { /* the welcome dialog will return next visit if storage is unavailable */ }
    setWelcomeOpen(false);
  };

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
      {/* Keep Data mounted while Partition is active so its browser-persisted Groups
          hierarchy can immediately restore the corresponding Partition cards. */}
      <div hidden={active !== 'depreciation'}><TaxBasisMockup /></div>
      {planned && <PlannedWorkspace workspace={planned} />}
      <WelcomeDialog open={welcomeOpen} onContinue={() => setWelcomeOpen(false)} onTurnOff={dismissWelcomePermanently} />
    </>
  );
}

function WelcomeDialog({ open, onContinue, onTurnOff }: { open: boolean; onContinue: () => void; onTurnOff: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/55 p-5">
      <section className="bg-surface border-[1.5px] border-border2 rounded-md px-7 py-6 max-w-[620px] w-full shadow-[0_8px_32px_rgba(0,0,0,0.22)]" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <div className="caption text-[.61rem] text-a">First-time setup</div>
        <h2 id="welcome-title" className="font-serif text-[1.45rem] font-bold mt-1">Welcome to the Proportional Partition Tool</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-[.83rem] text-text2 marker:font-mono marker:font-bold marker:text-a">
          <li>Start on the <strong className="text-text">Partition</strong> tab.</li>
          <li>The Partition tab is populated by the <strong className="text-text">Data</strong> tabs.</li>
          <li>In Data, upload the <strong className="text-text">Property Groups</strong> report first. Every other report is matched to those groups. Then visit each remaining Data tab and upload its corresponding table.</li>
          <li>Your work stays populated while you use the same browser on the same computer.</li>
        </ol>
        <div className="mt-6 flex flex-wrap justify-end gap-2.5">
          <button type="button" className="modal-btn" onClick={onTurnOff}>Don&apos;t show this again</button>
          <button type="button" className="modal-btn modal-btn-accent" onClick={onContinue}>Get started</button>
        </div>
      </section>
    </div>
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
