import { describe, expect, it } from 'vitest';
import { FIELD_REFERENCE_VERSION, GLOSSARY, REF } from '../src/lib/glossary';

describe('glossary (parsed from Separation Project Docs/03_RE_Partition_Field_Reference.md)', () => {
  it('reads the document version', () => {
    expect(FIELD_REFERENCE_VERSION).toMatch(/^\d+\.\d+$/);
  });

  it('resolves every UI handle to a row with a term and a definition', () => {
    for (const [handle, row] of Object.entries(REF)) {
      const e = GLOSSARY.get(row);
      expect(e, `${handle} → row ${row}`).toBeDefined();
      expect(e!.term.length, `${handle} term`).toBeGreaterThan(0);
      expect(e!.notes.length, `${handle} notes`).toBeGreaterThan(20);
    }
  });

  it('strips markdown from cells', () => {
    const e = GLOSSARY.get(REF.marketVal)!;
    expect(e).toMatchObject({ term: 'Market Value', ref: 'market_value', source: 'Uploaded' });
    expect(e.notes).not.toMatch(/[*`]/);
    for (const e of GLOSSARY.values()) expect(e.notes, `row ${e.row}`).not.toMatch(/\*\*|`/);
  });

  it('skips the BLANK spacer row', () => {
    expect(GLOSSARY.has(32)).toBe(false);
  });

  it('keeps the three tax-basis terms distinct', () => {
    expect(GLOSSARY.get(REF.remainingBasis)!.term).toBe('Remaining Tax Basis');
    expect(GLOSSARY.get(REF.basisShortfall)!.term).toBe('Basis Shortfall');
    expect(GLOSSARY.get(REF.basisTrueUp)!.term).toBe('Basis True-Up');
    expect(GLOSSARY.get(REF.basisTrueUp)!.notes).toMatch(/not split again/);
  });
});
