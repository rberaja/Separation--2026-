import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { downloadTemplate, loadExcel } from '../lib/excel-lazy';
import { SORT_OPTIONS } from '../lib/sort';
import { useApp } from '../store/AppContext';
import type { UploadKind } from '../store/reducer';
import { ColumnGuideModal } from './ColumnGuideModal';
import { ExportModal } from './ExportModal';
import { DownloadIcon, InfoIcon, PrintIcon, TrashIcon, UploadIcon } from './ui/Icons';

const STATUS_CLASS: Record<UploadKind, string> = {
  idle: 'text-muted',
  busy: 'text-muted',
  ok: 'text-green font-semibold',
  err: 'text-red font-semibold',
};

export function Toolbar() {
  const { state, dispatch } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const closeGuide = useCallback(() => setGuideOpen(false), []);
  const [exportOpen, setExportOpen] = useState(false);
  const closeExport = useCallback(() => setExportOpen(false), []);
  const hasData = state.properties.length > 0;

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    dispatch({ type: 'upload/status', status: { kind: 'busy', message: `Reading ${file.name}…` } });
    try {
      const { parseWorkbook } = await loadExcel();
      const result = parseWorkbook(await file.arrayBuffer());
      dispatch({ type: 'import/apply', result, fileName: file.name });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dispatch({ type: 'upload/status', status: { kind: 'err', message: `Error: ${message}` } });
      console.error(err);
    } finally {
      input.value = '';
    }
  };

  const clearAll = () => {
    if (state.properties.length > 0 && !window.confirm('Clear all properties? This cannot be undone.')) return;
    dispatch({ type: 'properties/clear' });
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5 bg-surface border-b border-border px-7 py-2">
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />

      <button type="button" className="tool-btn tool-btn-primary" onClick={() => fileRef.current?.click()}>
        <UploadIcon /> Upload Excel
      </button>
      <button type="button" className="tool-btn" onClick={() => setGuideOpen(true)}>
        <InfoIcon /> Column Guide
      </button>
      <button type="button" className="tool-btn" onClick={() => void downloadTemplate()}>
        <DownloadIcon /> Download Template
      </button>
      <button
        type="button"
        className="tool-btn disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border2 disabled:hover:text-text2"
        disabled={!hasData}
        title={hasData ? 'Print the sign-off report or export to Excel' : 'Add or upload properties first'}
        onClick={() => setExportOpen(true)}
      >
        <PrintIcon /> Print / Export
      </button>
      <button type="button" className="tool-btn tool-btn-danger" onClick={clearAll}>
        <TrashIcon /> Clear All
      </button>

      <Divider />

      <span className="font-mono uppercase text-[0.77rem] tracking-[0.05em] text-muted2 dark:text-text font-bold whitespace-nowrap">Sort</span>
      {SORT_OPTIONS.map(({ key, label }) => {
        const active = state.sort.key === key;
        return (
          <button
            key={key}
            type="button"
            className={`sort-btn ${active ? 'sort-btn-active' : ''}`}
            onClick={() => dispatch({ type: 'sort/set', key })}
          >
            <span>{label}</span>
            <span className="text-[0.75rem]">{active && !state.sort.asc ? '↓' : '↑'}</span>
          </button>
        );
      })}

      <Divider />

      <span className={`ml-auto font-mono text-[0.75rem] font-bold ${STATUS_CLASS[state.upload.kind]}`} role="status">
        {state.upload.message}
      </span>

      <ColumnGuideModal open={guideOpen} onClose={closeGuide} />
      <ExportModal open={exportOpen} onClose={closeExport} />
    </div>
  );
}

const Divider = () => <div className="w-px h-[18px] bg-border shrink-0" />;
