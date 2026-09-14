/**
 * The tool's top-level pages ("workspaces"), reached through the tab strip.
 * The Partition tool is the landing page; the others are companion tools.
 * Each maps to a URL hash so a page can be bookmarked or refreshed.
 */
export type WorkspaceId = 'partition' | 'depreciation' | 'zoning' | 'partnership';

export interface Workspace {
  id: WorkspaceId;
  label: string;
  /** URL hash ('' for the landing page). */
  hash: string;
  /** One line shown on the placeholder page until the tool exists. */
  description: string;
  /** True for tools that are not built yet. */
  planned?: boolean;
}

export const WORKSPACES: readonly Workspace[] = [
  {
    id: 'partition',
    label: 'Partition',
    hash: '',
    description: 'Assign properties, compare partner totals and compute the settlement.',
  },
  {
    id: 'depreciation',
    label: 'Data',
    hash: '#remaining-depreciation',
    description:
      'Capture each property’s remaining depreciation schedule and convert the Basis Shortfall into the Basis True-Up.',
  },
  {
    id: 'zoning',
    label: 'Zoning',
    hash: '#zoning',
    description: 'Zoning designations, entitlements and the 40-year recertification calendar for each property.',
    planned: true,
  },
  {
    id: 'partnership',
    label: 'Partnership %',
    hash: '#partnership',
    description: 'Determine each partner’s ownership percentage in the partnership from the capital and ownership records.',
    planned: true,
  },
];

export const DEFAULT_WORKSPACE: WorkspaceId = 'partition';

export function workspaceFromHash(hash: string): WorkspaceId {
  return WORKSPACES.find((w) => w.hash !== '' && w.hash === hash)?.id ?? DEFAULT_WORKSPACE;
}

export function hashFor(id: WorkspaceId): string {
  return WORKSPACES.find((w) => w.id === id)?.hash ?? '';
}
