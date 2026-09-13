import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';

const STORAGE_KEY = 'partition-tool:aside-width';
export const ASIDE_DEFAULT_WIDTH = 348;
const ASIDE_MIN_WIDTH = 260;
/** Never let the pane swallow more than this share of the viewport. */
const ASIDE_MAX_SHARE = 0.6;

function clamp(width: number): number {
  const max = typeof window === 'undefined' ? Infinity : window.innerWidth * ASIDE_MAX_SHARE;
  return Math.round(Math.min(Math.max(width, ASIDE_MIN_WIDTH), max));
}

/** Width of the right-hand pane, persisted across visits. */
export function useAsideWidth(): [number, (w: number) => void, () => void] {
  const [width, setWidth] = useState(ASIDE_DEFAULT_WIDTH);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(saved) && saved > 0) setWidth(clamp(saved));
    } catch {
      /* storage unavailable — keep the default */
    }
  }, []);

  const update = useCallback((w: number) => {
    const next = clamp(w);
    setWidth(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  const reset = useCallback(() => update(ASIDE_DEFAULT_WIDTH), [update]);

  return [width, update, reset];
}

/**
 * Vertical drag handle sitting between the main column and the right-hand pane.
 * Dragging left widens the pane; double-click restores the default width.
 */
export function SplitHandle({
  width,
  onResize,
  onReset,
}: {
  width: number;
  onResize: (w: number) => void;
  onReset: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    setDragging(true);

    const onMove = (ev: PointerEvent) => onResize(startWidth + (startX - ev.clientX));
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize side pane"
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      className={`hidden lg:block relative w-[7px] cursor-col-resize shrink-0 select-none
                  before:absolute before:inset-y-0 before:left-[3px] before:w-px before:transition-colors before:duration-150
                  ${dragging ? 'before:bg-a' : 'before:bg-border hover:before:bg-border2'}`}
    />
  );
}
