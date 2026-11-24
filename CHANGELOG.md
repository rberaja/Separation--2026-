# Changelog

All notable user-facing changes to the RE Partition Tool are recorded here.

This file follows the spirit of [Keep a Changelog](https://keepachangelog.com/):
add changes under **Unreleased** while work is in progress, then move them into
a versioned section when the app version is bumped. Git history remains the
source of detail for work recorded before this file was added.

## [Unreleased]

## [8.02] - 2026-11-23

### Added

- Dedicated project change log.
- Excel exports now include a `Grouped Schedule` worksheet with each group
  total followed by its member properties, plus standalone-property rows.

### Changed

- Excel exports in each Data tab now carry a `Group` column and place every
  group’s property rows before standalone properties.
- PDF output from the Partition report now shows each group total followed by
  the properties that make up that total. Data-tab PDF output now prints the
  active Data workspace instead of the unrelated Partition sign-off report.

## [8.01] - 2026-11-23

### Added

- Five-tier NPV-equity allocation option, with Highest, Upper, Middle, Lower,
  and Lowest NPV Equity bands.
- Persistent tier-structure selection and saved tier assignments.
- Partnership-separation legal and tax issue papers plus CPA/legal-counsel
  handoff checklists.

### Changed

- Automatic tier suggestions now distribute selection units as evenly as
  possible across the active number of tiers.
- Data Groups sorting now treats grouped and individual properties as one
  ordered list rather than displaying separate sorted blocks.
- Zoning sorting follows the portfolio hierarchy: T3, T4, T5, T6, MF1, MF2,
  then MX3. A group is ranked by its highest member zoning.

### Fixed

- Partition toolbar sort controls now order grouped selection units by their
  rolled-up values, instead of resetting group cards to alphabetical order.
- Current-year depreciation is deducted from remaining tax basis.
- Partition and Data workspace readability improvements.

## [8.0]

### Notes

- Baseline version before this changelog was introduced. Consult Git history
  for earlier changes.
