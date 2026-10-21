import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { APP_VERSION } from '../lib/constants';
import type { Theme } from '../lib/types';
import { useApp } from '../store/AppContext';

const THEMES: { id: Theme; label: string; icon: string }[] = [
  { id: 'light', label: 'Light', icon: '☼' },
  { id: 'dark', label: 'Dark', icon: '☾' },
];

export function Header({ workspaceNav }: { workspaceNav: ReactNode }) {
  const { state, dispatch } = useApp();
  const headerRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const element = headerRef.current;
    if (!element) return;

    const setHeight = () => document.documentElement.style.setProperty('--shared-header-height', `${element.offsetHeight}px`);
    setHeight();
    const observer = new ResizeObserver(setHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <header ref={headerRef} className="border-b-[3px] border-a bg-hdr-bg">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-7 py-[13px]">
        <h1 className="font-serif text-[1.35rem] font-bold leading-none tracking-tight text-hdr-text">
          Real Estate Partition Tool
        </h1>

        <div className="flex items-center gap-1 rounded-sm border border-hdr-input-brd bg-hdr-input-bg p-0.5">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => dispatch({ type: 'theme/set', theme: theme.id })}
              className={`rounded-sm px-2.5 py-1 font-mono text-[0.58rem] font-bold uppercase tracking-[0.1em] transition-colors ${
                state.theme === theme.id
                  ? 'bg-a text-white'
                  : 'text-hdr-muted hover:text-hdr-text'
              }`}
              title={`Use ${theme.label.toLowerCase()} theme`}
            >
              {theme.icon} {theme.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-4 px-7">
        {workspaceNav}
        <span className="ml-auto pb-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-hdr-accent whitespace-nowrap">
          v{APP_VERSION} · Client-Side
        </span>
      </div>
    </header>
  );
}
