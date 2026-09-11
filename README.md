# RE Partition Tool

Client-side rebuild of the original single-file RE Partition Tool (v7.5, removed from
the working tree — see git history, commit `aee465f`) as an Astro + React + TypeScript
project. Same math, same layout, same Excel template — split into testable modules and
reusable components.

- `docs/` — field reference (every input, its source, and formula)
- `images/` — the v1.8 mockup that guides the next round of features

## Stack

| Layer      | Choice                                   |
| ---------- | ---------------------------------------- |
| Framework  | Astro 7 (static output, one React island) |
| UI         | React 19 + TypeScript (strict)            |
| Styling    | Tailwind 4; the original light/dark tokens live in `src/styles/global.css` |
| Excel      | SheetJS 0.20 (lazy-loaded chunk)          |
| Tests      | Vitest                                    |

## Scripts

```sh
npm install
npm run dev        # http://localhost:4321
npm run test       # vitest (finance parity, settlement, excel, sort)
npm run check      # astro check — TypeScript across .ts/.tsx/.astro
npm run build      # static site → dist/
npm run preview    # serve dist/
```

## Layout

```
src/
  lib/                 pure logic — no React, no DOM
    types.ts           Property, Partner, SortState, createProperty()
    finance.ts         amortPmt, calcDebtNPV, calcADS, computeMetrics …
    settlement.ts      per-partner totals, gaps, cash split
    sort.ts            SORT_OPTIONS, sortProperties, nextSort
    columns.ts         single source of truth for Excel columns/aliases/template rows
    excel.ts           parseWorkbook, buildTemplateWorkbook, downloadTemplate
    excel-lazy.ts      dynamic-import wrapper so SheetJS is only fetched on demand
    format.ts          fmtMoney, fmtPct, clamp
    constants.ts       APP_VERSION, defaults
  store/
    reducer.ts         AppState + Action union + reducer
    AppContext.tsx     AppProvider, useApp, useSettlement, useSortedProperties …
  components/
    App.tsx            root island + theme sync
    Header.tsx         title, discount rate, cash & equivalents, theme toggle
    Toolbar.tsx        upload / column guide / template / clear / sort / status
    ColumnGuideModal.tsx
    PartnerStrip.tsx   partner names + ownership % + split bar
    PropertyList.tsx   sorted cards or empty state
    PropertyCard.tsx   one property: inputs + computed strips
    PartnerTotalsCard.tsx
    ProportionalityMeters.tsx
    SettlementLedger.tsx
    ui/                NumberInput, Icons, tone helpers
  pages/index.astro    HTML shell; mounts <App client:load />
  styles/global.css    theme tokens (→ Tailwind @theme) + shared component classes
tests/
  finance.test.ts      24 parity cases generated from the v7.5 JS (fixtures/)
  settlement.test.ts
  excel.test.ts        round-trips the template through the parser
  sort.test.ts
```

## Conventions

- Numeric property fields are `number | null` (`null` = blank input). `nv()` in
  `finance.ts` coerces blank → 0 at calculation time, matching v7.5.
- Rates are **percentages** in state (`6.5`) and **fractions** inside `finance.ts`
  (`0.065`); each `calc*` function converts at its boundary.
- All derived numbers are computed from state on render (`useSettlement`,
  `computeMetrics`) — nothing derived is stored.
- Add a new Excel column by appending to `COLUMNS` in `columns.ts`; the Column
  Guide, import mapping and template all follow.

## Deploying

`npm run build` writes a fully static `dist/`. For hosting under a sub-path
(e.g. GitHub Pages project site) set `base` in `astro.config.mjs`.

## Differences from v7.5

- Sorting by Partner now keeps unassigned properties last in **both** directions
  (v7.5 placed them in the middle when descending).
- Template example for "123 Main St" uses a realistic monthly P&I (`1827.87`);
  v7.5 shipped `39833.90`, which produced a $478k annual debt service.
- Theme choice persists in `localStorage`.
- Unchanged, and worth a decision: unassigned properties still roll into
  Partner B's totals (see `bucketOf` in `settlement.ts`).
