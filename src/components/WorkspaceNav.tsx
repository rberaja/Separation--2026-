import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_WORKSPACE, WORKSPACES, hashFor, workspaceFromHash, type WorkspaceId } from '../lib/workspaces';

/** Active workspace, kept in sync with the URL hash (back/forward and refresh work). */
export function useWorkspace(): [WorkspaceId, (id: WorkspaceId) => void] {
  const [active, setActive] = useState<WorkspaceId>(DEFAULT_WORKSPACE);

  useEffect(() => {
    const sync = () => setActive(workspaceFromHash(window.location.hash));
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const select = useCallback((id: WorkspaceId) => {
    const hash = hashFor(id);
    // Replace rather than push for the landing page so "#" never lingers in the address bar.
    if (hash) window.location.hash = hash;
    else history.replaceState(null, '', window.location.pathname + window.location.search);
    setActive(id);
  }, []);

  return [active, select];
}

/** Dark tab strip above every workspace. Hidden in print. */
export function WorkspaceNav({ active, onSelect }: { active: WorkspaceId; onSelect: (id: WorkspaceId) => void }) {
  return (
    <nav className="flex items-stretch gap-1 bg-hdr-bg px-7 pt-2 print:hidden" aria-label="Workspaces">
      {WORKSPACES.map((w) => {
        const current = w.id === active;
        return (
          <button
            key={w.id}
            type="button"
            aria-current={current ? 'page' : undefined}
            onClick={() => onSelect(w.id)}
            className={`group flex items-center gap-2 rounded-t-[4px] px-3.5 py-[7px] font-mono text-[0.68rem] uppercase tracking-[0.1em] font-bold cursor-pointer transition-colors duration-150 border-b-2 ${
              current
                ? 'bg-hdr-input-bg text-hdr-text border-hdr-accent'
                : 'text-hdr-muted border-transparent hover:text-hdr-text hover:bg-hdr-input-bg/60'
            }`}
          >
            {w.label}
            {w.planned && (
              <span className="rounded-[2px] border border-hdr-input-brd px-1 py-px text-[0.52rem] tracking-[0.12em] text-hdr-muted group-hover:text-hdr-accent">
                planned
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
