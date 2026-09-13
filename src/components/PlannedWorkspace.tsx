import { APP_VERSION } from '../lib/constants';
import type { Workspace } from '../lib/workspaces';
import { useApp } from '../store/AppContext';

/** Placeholder page for a companion tool that is not built yet. */
export function PlannedWorkspace({ workspace: w }: { workspace: Workspace }) {
  const { state } = useApp();
  const n = state.properties.length;

  return (
    <div className="min-h-[calc(100vh-110px)] bg-bg text-text">
      <header className="flex flex-wrap items-center justify-between gap-2.5 bg-hdr-bg border-b-[3px] border-a px-7 py-[13px]">
        <div>
          <h1 className="font-serif text-[1.15rem] font-bold text-hdr-text">{w.label} Tool</h1>
          <div className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-hdr-accent mt-1">
            Companion to the Partition Tool · v{APP_VERSION} · Planned
          </div>
        </div>
      </header>

      <main className="max-w-[820px] mx-auto px-6 py-12">
        <div className="card px-7 py-6">
          <div className="caption text-[0.62rem] mb-2">Planned</div>
          <h2 className="font-serif text-[1.4rem] font-bold mb-3">{w.label}</h2>
          <p className="font-serif text-[0.95rem] leading-relaxed text-text2 mb-5">{w.description}</p>
          <p className="font-mono text-[0.72rem] text-muted2">
            This page is a placeholder. It shares the Partition Tool&rsquo;s data —{' '}
            {n === 0 ? 'no properties are loaded yet' : `${n} ${n === 1 ? 'property is' : 'properties are'} loaded`} — so
            the tool can be built against the same portfolio when the time comes.
          </p>
        </div>
      </main>
    </div>
  );
}
