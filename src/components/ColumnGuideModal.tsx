import { useEffect } from 'react';
import { COLUMNS } from '../lib/columns';
import { downloadTemplate } from '../lib/excel-lazy';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ColumnGuideModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/55"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="column-guide-title"
        className="bg-surface border-[1.5px] border-border2 rounded-md px-7 py-[26px] max-w-[620px] w-[90%] max-h-[80vh] overflow-y-auto shadow-[0_8px_32px_rgba(0,0,0,0.22)]"
      >
        <h3 id="column-guide-title" className="font-serif text-[0.98rem] font-medium mb-[5px] text-text">
          Excel Template — Column Reference
        </h3>
        <p className="font-mono text-[0.65rem] text-muted mb-4">
          One row per property. Headers are case-insensitive; common variants accepted.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Column', 'Description', 'Notes'].map((h) => (
                  <th key={h} className="caption text-[0.57rem] px-2.5 py-1.5 text-left border-b-[1.5px] border-border2 bg-surface2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.key} className="[&:last-child>td]:border-b-0">
                  <td className="px-2.5 py-1.5 border-b border-border font-mono text-[0.72rem] align-top text-a font-bold w-40">{c.key}</td>
                  <td className="px-2.5 py-1.5 border-b border-border font-mono text-[0.72rem] align-top text-text2">{c.description}</td>
                  <td className="px-2.5 py-1.5 border-b border-border font-mono text-[0.72rem] align-top text-text2">{c.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2.5 mt-[18px] justify-end">
          <button type="button" className="modal-btn" onClick={onClose}>Close</button>
          <button type="button" className="modal-btn modal-btn-accent" onClick={() => void downloadTemplate()}>Download Template</button>
        </div>
      </div>
    </div>
  );
}
