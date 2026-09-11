import { DEFAULTS, IDLE_UPLOAD_MESSAGE } from '../lib/constants';
import type { ImportResult } from '../lib/excel';
import { clamp } from '../lib/format';
import { nextSort } from '../lib/sort';
import {
  createProperty,
  type Partner,
  type Property,
  type PropertyInput,
  type SortKey,
  type SortState,
  type Theme,
} from '../lib/types';

export type UploadKind = 'idle' | 'busy' | 'ok' | 'err';
export interface UploadStatus {
  kind: UploadKind;
  message: string;
}

export interface AppState {
  properties: Property[];
  nextId: number;
  partnerNames: Record<Partner, string>;
  /** Partner A's ownership share in percent (1–99). B is always the complement. */
  pctA: number;
  /** Market discount rate in percent. Null when the input is blank. */
  discountRate: number | null;
  cashEquiv: number | null;
  sort: SortState;
  theme: Theme;
  upload: UploadStatus;
}

export const initialState: AppState = {
  properties: [],
  nextId: 1,
  partnerNames: { a: DEFAULTS.partnerNameA, b: DEFAULTS.partnerNameB },
  pctA: DEFAULTS.pctA,
  discountRate: DEFAULTS.discountRate,
  cashEquiv: DEFAULTS.cashEquiv,
  sort: { key: 'name', asc: true },
  theme: 'light',
  upload: { kind: 'idle', message: IDLE_UPLOAD_MESSAGE },
};

export type Action =
  | { type: 'property/add'; input?: PropertyInput }
  | { type: 'property/update'; id: number; patch: PropertyInput }
  | { type: 'property/assign'; id: number; partner: Partner }
  | { type: 'property/delete'; id: number }
  | { type: 'properties/clear' }
  | { type: 'import/apply'; result: ImportResult; fileName: string }
  | { type: 'upload/status'; status: UploadStatus }
  | { type: 'sort/set'; key: SortKey }
  | { type: 'partner/setName'; partner: Partner; name: string }
  | { type: 'partner/setPctA'; value: number | null }
  | { type: 'settings/discountRate'; value: number | null }
  | { type: 'settings/cashEquiv'; value: number | null }
  | { type: 'theme/set'; theme: Theme };

function addProperties(state: AppState, inputs: readonly PropertyInput[]): AppState {
  let nextId = state.nextId;
  const created = inputs.map((input) => createProperty(nextId++, input));
  return { ...state, properties: [...state.properties, ...created], nextId };
}

function patchProperty(state: AppState, id: number, patch: PropertyInput): AppState {
  return {
    ...state,
    properties: state.properties.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'property/add':
      return addProperties(state, [action.input ?? {}]);

    case 'property/update':
      return patchProperty(state, action.id, action.patch);

    case 'property/assign':
      return patchProperty(state, action.id, { assign: action.partner });

    case 'property/delete':
      return { ...state, properties: state.properties.filter((p) => p.id !== action.id) };

    case 'properties/clear':
      return { ...state, properties: [], nextId: 1, upload: initialState.upload };

    case 'import/apply': {
      const { properties, meta } = action.result;
      const n = properties.length;
      const base: AppState = {
        ...state,
        properties: [],
        nextId: 1,
        partnerNames: {
          a: meta.partnerAName ?? state.partnerNames.a,
          b: meta.partnerBName ?? state.partnerNames.b,
        },
        pctA: meta.partnerAPct !== undefined ? clamp(meta.partnerAPct, 1, 99) : state.pctA,
        discountRate: meta.discountRate ?? state.discountRate,
        upload: {
          kind: 'ok',
          message: `✓ Loaded ${n} ${n === 1 ? 'property' : 'properties'} from ${action.fileName}`,
        },
      };
      return addProperties(base, properties);
    }

    case 'upload/status':
      return { ...state, upload: action.status };

    case 'sort/set':
      return { ...state, sort: nextSort(state.sort, action.key) };

    case 'partner/setName':
      return { ...state, partnerNames: { ...state.partnerNames, [action.partner]: action.name } };

    case 'partner/setPctA':
      // Blank input keeps the previous value so the complement never becomes NaN.
      return action.value === null ? state : { ...state, pctA: clamp(action.value, 1, 99) };

    case 'settings/discountRate':
      return { ...state, discountRate: action.value };

    case 'settings/cashEquiv':
      return { ...state, cashEquiv: action.value };

    case 'theme/set':
      return { ...state, theme: action.theme };
  }
}
