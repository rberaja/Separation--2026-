import { useEffect, useState } from 'react';
import { DASH, fmtMoney, fmtPct, fmtText } from '../lib/format';
import { GAP_LABELS } from '../lib/labels';
import {
  PROPERTY_CALC_COLUMNS,
  isoDate,
  reportFileStem,
  type CellKind,
  type CellValue,
  type Report,
  type ReportGapRow,
} from '../lib/report';
import { isBalanced } from '../lib/settlement';
import type { Partner } from '../lib/types';
import { useReport } from '../store/AppContext';

/**
 * Print-only sign-off report. Hidden on screen; `@media print` in global.css hides the
 * app and shows this instead. Styled with the `.rpt-*` classes (fixed light palette)
 * so the dark theme never leaks onto paper.
 */
export function PrintReport() {
  const report = useReport();
  const [generatedAt, setGeneratedAt] = useState(() => new Date());

  // Stamp the report and name the PDF at the moment of printing, then restore the tab title.
  useEffect(() => {
    const original = document.title;
    const before = () => {
      const now = new Date();
      setGeneratedAt(now);
      document.title = reportFileStem(now);
    };
    const after = () => {
      document.title = original;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  return (
    <div id="print-report" className="rpt" aria-hidden="true">
      <Title report={report} generatedAt={generatedAt} />
      <Settings report={report} />

      <h2 className="rpt-h2">A. Property Schedule — Inputs</h2>
      <PropertyTable report={report} columns={report.inputColumns} />

      <h2 className="rpt-h2">A. Property Schedule — Calculated Values</h2>
      <PropertyTable report={report} columns={[...report.inputColumns.slice(0, 2), ...PROPERTY_CALC_COLUMNS]} />

      <div className="rpt-cols">
        <section className="rpt-avoid">
          <h2 className="rpt-h2">B. Partner Totals</h2>
          <TotalsTable report={report} />
        </section>
        <section className="rpt-avoid">
          <h2 className="rpt-h2">D. Gap Analysis &amp; Settlement</h2>
          <GapTable report={report} />
          <div className="rpt-final">
            <div className="rpt-final-label">{GAP_LABELS.final}</div>
            <div className="rpt-final-value">{report.finalSettlement || DASH}</div>
            {!report.complete && (
              <div className="rpt-final-flag">
                Provisional — {report.unassigned.count} {report.unassigned.count === 1 ? 'property' : 'properties'} unassigned
              </div>
            )}
          </div>
        </section>
      </div>

      <Signatures report={report} />

      <section className="rpt-notes rpt-avoid">
        <h2 className="rpt-h2">Notes</h2>
        <ol>
          {report.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Title({ report: r, generatedAt }: { report: Report; generatedAt: Date }) {
  return (
    <header className="rpt-title">
      <div>
        <h1>Real Estate Partition — Settlement Report</h1>
        <div className="rpt-sub">
          {r.partnerNames.a} ({r.pct.a}%) · {r.partnerNames.b} ({r.pct.b}%) · White Paper v{r.whitePaperVersion} §14.1
        </div>
      </div>
      <div className="rpt-stamp">
        <div>Generated {isoDate(generatedAt)} {generatedAt.toTimeString().slice(0, 5)}</div>
        <div>RE Partition Tool v{r.appVersion}</div>
      </div>
    </header>
  );
}

function Settings({ report: r }: { report: Report }) {
  const items: [string, string][] = [
    [`${r.partnerNames.a} ownership`, `${r.pct.a}%`],
    [`${r.partnerNames.b} ownership`, `${r.pct.b}%`],
    ['Market discount rate', r.discountRate === null ? DASH : fmtPct(r.discountRate, 2)],
    ['Cash & equivalents', fmtMoney(r.cashEquiv)],
    ['Depreciation year', String(r.depreciationYear)],
    ['Properties', `${r.properties.length} (A ${r.counts.a} · B ${r.counts.b} · unassigned ${r.counts.none})`],
  ];
  return (
    <dl className="rpt-settings">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function fmtCell(v: CellValue, kind: CellKind): string {
  if (v === null || v === '') return DASH;
  if (kind === 'text' || typeof v !== 'number') return fmtText(String(v));
  if (kind === 'money') return fmtMoney(v);
  if (kind === 'pct') return fmtPct(v, 1);
  return String(v);
}

function PropertyTable({ report: r, columns }: { report: Report; columns: readonly { key: string; label: string; kind: CellKind }[] }) {
  return (
    <table className="rpt-table rpt-schedule">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} className={c.kind === 'text' ? 'rpt-left' : ''}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {r.properties.length === 0 && (
          <tr><td colSpan={columns.length} className="rpt-left rpt-muted">No properties.</td></tr>
        )}
        {r.properties.map((p) => (
          <tr key={p.id}>
            {columns.map((c) => {
              if (c.key === 'assign') {
                return (
                  <td key={c.key} className={`rpt-left rpt-partner-${p.assign}`}>
                    {p.assign === 'none' ? 'unassigned' : r.partnerNames[p.assign as Partner]}
                  </td>
                );
              }
              return (
                <td key={c.key} className={c.kind === 'text' ? 'rpt-left' : ''}>{fmtCell(p.cells[c.key] ?? null, c.kind)}</td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TotalsTable({ report: r }: { report: Report }) {
  return (
    <table className="rpt-table">
      <thead>
        <tr>
          <th className="rpt-left">Metric</th>
          <th className="rpt-partner-a">{r.partnerNames.a}</th>
          <th className="rpt-partner-b">{r.partnerNames.b}</th>
          <th>Portfolio</th>
        </tr>
      </thead>
      <tbody>
        {r.totals.map((t) => (
          <tr key={t.key}>
            <td className="rpt-left">{t.label}</td>
            <td>{fmtCell(t.a, t.kind)}</td>
            <td>{fmtCell(t.b, t.kind)}</td>
            <td>{fmtCell(t.portfolio, t.kind)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function signed(v: number | null, unsigned?: boolean): { text: string; cls: string } {
  if (v === null) return { text: DASH, cls: 'rpt-muted' };
  if (unsigned) return { text: fmtMoney(v), cls: '' };
  if (isBalanced(v)) return { text: fmtMoney(0), cls: '' };
  return { text: `${v > 0 ? '+' : '−'}${fmtMoney(Math.abs(v))}`, cls: v > 0 ? 'rpt-pos' : 'rpt-neg' };
}

function GapRows({ rows }: { rows: ReportGapRow[] }) {
  return (
    <>
      {rows.map((g) => {
        const a = signed(g.a, g.unsigned);
        const b = signed(g.b, g.unsigned);
        return (
          <tr key={g.key} className={g.grand ? 'rpt-grand' : ''}>
            <td className="rpt-left">
              {g.label}
              {g.note && <span className="rpt-note"> ({g.note})</span>}
            </td>
            <td className={a.cls}>{a.text}</td>
            <td className="rpt-muted">{g.u === null ? DASH : fmtMoney(g.u)}</td>
            <td className={b.cls}>{b.text}</td>
          </tr>
        );
      })}
    </>
  );
}

function GapTable({ report: r }: { report: Report }) {
  return (
    <table className="rpt-table">
      <thead>
        <tr>
          <th className="rpt-left">Target − actual (positive = owed)</th>
          <th className="rpt-partner-a">{r.partnerNames.a}</th>
          <th>Unassigned</th>
          <th className="rpt-partner-b">{r.partnerNames.b}</th>
        </tr>
      </thead>
      <tbody>
        <tr className="rpt-group"><td colSpan={4}>{GAP_LABELS.referenceTitle}</td></tr>
        <GapRows rows={r.gaps.reference} />
        <tr className="rpt-group"><td colSpan={4}>{GAP_LABELS.settlementTitle}</td></tr>
        <GapRows rows={r.gaps.settlement} />
      </tbody>
    </table>
  );
}

function Signatures({ report: r }: { report: Report }) {
  return (
    <section className="rpt-sign rpt-avoid">
      <p>
        The undersigned have reviewed the property schedule, partner totals and gap analysis above and agree to the
        final settlement stated, subject to the addition of the {GAP_LABELS.basisTrueUp} calculated separately.
      </p>
      <div className="rpt-sign-grid">
        {(['a', 'b'] as const).map((p) => (
          <div key={p} className={`rpt-sign-box rpt-partner-${p}`}>
            <div className="rpt-sign-name">{r.partnerNames[p]} — {r.pct[p]}%</div>
            <div className="rpt-sign-line"><span>Signature</span></div>
            <div className="rpt-sign-line"><span>Date</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}
