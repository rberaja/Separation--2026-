import { useEffect, useState } from 'react';
import { downloadReport } from '../lib/excel-lazy';
import { useReport } from '../store/AppContext';
import { DocumentIcon, SpreadsheetIcon } from './ui/Icons';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** "Print / Export" chooser: Excel workbook or the print (PDF) report. */
export function ExportModal({ open, onClose }: Props) {
  const report = useReport();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const exportExcel = async () => {
    setBusy(true);
    try {
      await downloadReport(report);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const printPdf = () => {
    onClose();
    // Let the modal unmount before the print dialog snapshots the page.
    setTimeout(() => window.print(), 50);
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/55"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        className="bg-surface border-[1.5px] border-border2 rounded-md px-7 py-[26px] max-w-[560px] w-[90%] shadow-[0_8px_32px_rgba(0,0,0,0.22)]"
      >
        <h3 id="export-title" className="font-serif text-[0.98rem] font-medium mb-[5px] text-text">
          Print / Export Settlement Report
        </h3>
        <p className="font-mono text-[0.65rem] text-muted mb-4">
          Both outputs contain every property, the partner totals, the gap analysis and the final settlement as
          currently shown.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Choice
            icon={<SpreadsheetIcon />}
            title="Excel workbook"
            subtitle=".xlsx — for verification"
            body="Properties in import format plus calculated columns, a Summary sheet, and settings. Re-upload it later to reproduce this exact scenario."
            action={busy ? 'Preparing…' : 'Download Excel'}
            disabled={busy}
            onClick={() => void exportExcel()}
          />
          <Choice
            icon={<DocumentIcon />}
            title="PDF report"
            subtitle="print — for sign-off"
            body="Landscape report with the property schedule, partner totals, gap analysis, final settlement and signature lines. In the print dialog choose “Save as PDF”."
            action="Print / Save as PDF"
            disabled={busy}
            onClick={printPdf}
          />
        </div>

        <div className="flex gap-2.5 mt-[18px] justify-end">
          <button type="button" className="modal-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Choice({
  icon, title, subtitle, body, action, disabled, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  body: string;
  action: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col border-[1.5px] border-border rounded-[4px] bg-surface2 p-4">
      <div className="flex items-center gap-2.5 text-a mb-1">
        {icon}
        <div>
          <div className="font-serif text-[0.95rem] font-medium text-text leading-tight">{title}</div>
          <div className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted2">{subtitle}</div>
        </div>
      </div>
      <p className="font-serif text-[0.78rem] leading-snug text-text2 mt-2 mb-3 flex-1">{body}</p>
      <button type="button" className="modal-btn modal-btn-accent self-start" disabled={disabled} onClick={onClick}>
        {action}
      </button>
    </div>
  );
}
