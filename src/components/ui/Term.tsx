import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FIELD_REFERENCE_VERSION, GLOSSARY, REF, type RefKey } from '../../lib/glossary';

const TIP_WIDTH = 340;
const GAP = 6;
const MARGIN = 8;
const HOVER_DELAY_MS = 120;

interface Props {
  /** Glossary handle, e.g. "marketVal". */
  term: RefKey;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a label with a Field Reference tooltip. Opens on hover / focus / tap,
 * closes on leave / blur / Escape / scroll. The bubble is portalled to <body>
 * and positioned `fixed`, so cards with `overflow-hidden` never clip it.
 */
export function Term({ term, children, className = '' }: Props) {
  const entry = GLOSSARY.get(REF[term]);
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), HOVER_DELAY_MS);
  }, []);
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
  }, []);

  // Place below the label; flip above when there is no room; keep inside the viewport.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tipRef.current) return;
    const a = anchorRef.current.getBoundingClientRect();
    const h = tipRef.current.offsetHeight;
    const below = a.bottom + GAP + h <= window.innerHeight - MARGIN;
    const top = below ? a.bottom + GAP : Math.max(MARGIN, a.top - GAP - h);
    const left = Math.min(Math.max(MARGIN, a.left), window.innerWidth - TIP_WIDTH - MARGIN);
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [open, hide]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!entry) return <>{children}</>;

  return (
    <>
      <span
        ref={anchorRef}
        className={`term ${className}`}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (open ? hide() : setOpen(true))}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            className="tip"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: TIP_WIDTH, visibility: pos ? 'visible' : 'hidden' }}
          >
            <div className="tip-head">
              <span className="tip-term">{entry.term}</span>
              <span className="tip-source">{entry.source}</span>
            </div>
            <p className="tip-body">{entry.notes}</p>
            <div className="tip-foot">
              <span>{entry.ref}</span>
              <span>Field Reference V{FIELD_REFERENCE_VERSION} · row {entry.row}</span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
