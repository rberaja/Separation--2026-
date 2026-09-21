# Real Estate Partition Tool — Feature Requirements

## Required workflow

First, enter the **Data**. The Partition Tool is populated only after the following two Data steps are completed and reviewed:

1. **Groups, Zoning, and Next 40-Yr Certification**
2. **Remaining Tax Basis and Depreciation**
3. **Occupancy**
4. **Loans**
<span style="color:#FFFFFF">5. **Capital Expenses**</span>
<span style="color:#FFFFFF">6. **Market Value**</span>

```text
DATA
  1. Groups, Zoning, and Next 40-Yr Certification
  2. Remaining Tax Basis and Depreciation
  3. Occupancy
  4. Loans
  5. Capital Expenses
  6. Market Value
        ↓
PARTITION TOOL
```

### Data retention and handoff

- All imported Groups, tax-return, occupancy, and loan data remains in the tool locally after upload, through tab changes and browser refreshes, until the user selects the applicable **Clear All** action.
- The source reports and extracted records do not need to be uploaded again to the Partition Tool.
- After the user reviews each Data tab, **Send to Partition Tool** passes the matched group totals and individual-property values directly into the Partition Tool using the Groups workbook hierarchy.
- A handoff is a copy of the reviewed values. The imported source data remains available in its Data tab unless the user clears it.
<span style="color:#FFFFFF">- **Browser-local persistence:** all imported source-report data, extracted property tables, property matches, group mappings, and user review corrections remain available after the user closes and reopens the tool in the same browser on the same device. Persist this data locally in the browser (using IndexedDB for report data and structured tables) until the user selects Clear All.</span>
<span style="color:#FFFFFF">- **User / device / browser scope:** saved data belongs only to that browser profile on that device. It is not automatically shared with another browser, device, or user, and it is removed if the user selects Clear All or clears this site's browser storage. Private-browsing sessions are not expected to retain it after the session ends.</span>
<span style="color:#FFFFFF">- **Persistent Groups-to-Partition display:** whenever a Groups workbook remains retained in Data, automatically restore and display its group hierarchy and member-property cards in Partition, including after a browser refresh. Keep those Data-created cards visible until the user selects **Clear All** in Data → Groups; that action removes them from Partition.</span>

## 1. Groups, Zoning, and Next 40-Yr Certification

This is the first Data step. It establishes the property groupings and property-level reference information that govern the workflow.

### Purpose

- Upload the canonical property Groups workbook before importing tax returns.
- Properties with the same **Group** name become one combined lot or economic package.
- Properties with a blank Group remain individual selection units.
- Each property row can hold owner/entity, location, units, zoning, and next 40-year certification information.
- Display each group as one full-width group card containing only its member properties.
- Keep individual properties in their own single list.

### Required actions

- **Upload Groups Excel** — loads the property grouping source file.
- **Download Template** — provides Group, Property, owner/entity, city, state, ZIP, units, zoning, and next 40-year certification fields.
- **Print / Export** — exports or prints the Groups information.
- **Clear All** — clears the Groups data and associated tax-return data after confirmation.
- **Sort** — sorts group cards and individual properties separately by name.

## 2. Remaining Tax Basis and Depreciation

This is the second Data step. The user uploads partnership tax-return PDFs after the Groups information is loaded. The tool extracts per-property depreciation schedules and matches them to the Groups workbook.

### Tax-return schedule requirements

- Accept partnership Form 1065 tax-return PDFs.
- Extract each property's depreciable sections, depreciation method, remaining tax basis, recovery period, estimated remaining life, and tax-year depreciation deduction.
- Display **Basis Left** as currency.
- Support both MACRS/accelerated components and straight-line components. A property does not need a cost-segregation study to calculate residual tax basis.
- Calculate estimated remaining life from the combined remaining basis and annual deduction, constrained by the recovery period when known. Do not display implausible estimates.
<span style="color:#FFFFFF">- **Latest return wins:** when a property appears in more than one imported tax return, retain only the most recent return's remaining-basis and tax-year depreciation schedule. Historical schedules must not be added to, or displayed as a duplicate of, the current property record.</span>

### Hierarchy and totals

- A group is collapsed to one total for Basis Left and tax-year depreciation.
- Expanding a group shows the individual property tax schedules within that group.
- Each individual property can collapse to its Basis Left and tax-year depreciation totals, then expand to show detailed depreciation sections.
- If a tax-return property cannot be matched to a Groups workbook property, keep it visible as an individual schedule and identify it for review.

### Required actions

- **Upload Tax Return PDFs** — imports tax-return schedules after Groups are loaded.
- **Print / Export** — exports group and property tax schedules to Excel or supports browser printing / Save as PDF.
- **Clear All** — clears imported tax-return schedules while preserving the Groups workbook.
- **Sort** — sorts groups by group name and individual schedules by property name without mixing the two categories.
- **Expand All / Collapse All** — controls group-level and property-level detail panels.

## 3. Occupancy

This Data tab imports the original rent-roll and occupancy reports exported from the property-management software. The reports include all properties, and the tool must identify and match the occupancy information to each property in the Groups workbook. A purpose-built template is **not** the primary input method.

### Occupancy requirements

- **Original-report upload:** accept the property-management software's native rent-roll, occupancy, or unit-status reports without requiring the user to re-key or rearrange them into a template. Support the software's standard Excel, CSV, and text-based PDF exports.
- **Report recognition:** identify the report type and its header row, even when introductory titles, portfolio headers, subtotals, or report dates appear before the data table.
- **Extraction:** derive the property-level totals from either a property-summary report or individual unit rows. Extract total units, occupied units, vacant units when provided, occupancy percentage, scheduled rent, and the report's as-of date when available.
- **Source traceability:** retain the source file, report title, page/sheet, and matched source property name for every extracted property value so the user can review how the result was obtained.
- **Property matching:** match rent-roll property names or addresses to the canonical property records established in the Groups tab. Clearly flag any rent-roll property that cannot be matched.
- **Review exceptions:** flag ambiguous property matches, missing required fields, duplicate property summaries, and totals that do not reconcile to the imported report. The user can correct a match without changing the original report.
- **Property values:** display the occupancy values identified for each individual property, including the source information used to support the result.
- **Group hierarchy:** use the Groups workbook as the controlling hierarchy. A collapsed group displays its occupancy total or summary; expanding the group displays the individual occupancy values for every member property.
- **Individual properties:** properties with no Group remain separately visible with their own occupancy information.
- **Consistent layout:** use the same presentation pattern as Remaining Tax Basis and Depreciation: grouped totals when collapsed and individual property detail when expanded.
- **Partition handoff:** make the reviewed occupancy values available to the Partition Tool.
- **Send to Partition Tool:** after review, send the matched occupancy values directly to the Partition Tool. Do not require a second file upload or duplicate entry there.
- **Optional fallback:** a simple import template may be available only for exceptional reports that cannot be read directly. It is not part of the normal workflow.
<span style="color:#D64545">- **Individual-card expand/collapse:** give every ungrouped, single-property occupancy card the same compact summary and Expand / Collapse control as group cards. Keep its occupancy, occupied-unit, and scheduled-rent summary visible while its detail row is collapsed. Include these cards in Occupancy’s Expand All and Collapse All controls so the page remains visually consistent.</span>

### Occupancy mockup

```text
DATA  /  OCCUPANCY

[ Upload Property-Management Reports ]  [ Print / Export ]  [ Clear All ]  Sort [ Name v ]
                                                     [ Expand All ] [ Collapse All ]

Occupancy                                                        As of: 12/31/2025
Values extracted from property-management reports are matched to the Groups workbook hierarchy.

> The Antiquera                                        GROUP TOTAL - 5 PROPERTIES
  Occupied Units: 39 / 41        Occupancy: 95.1%       Scheduled Rent: $48,600
                                                                   [ Expand ]

v The 600-930                                         GROUP TOTAL - 2 PROPERTIES
  Occupied Units: 34 / 37        Occupancy: 91.9%       Scheduled Rent: $42,200
                                                                  [ Collapse ]

  600 SW 9 Ave
  Units: 24     Occupied: 23     Occupancy: 95.8%       Scheduled Rent: $28,800

  930 SW 6th Street
  Units: 13     Occupied: 11     Occupancy: 84.6%       Scheduled Rent: $13,400

INDIVIDUAL PROPERTIES
  220 Antilla Avenue      Units: 18     Occupied: 17    Occupancy: 94.4%
```

## 4. Loans

This Data tab imports the original property-management software reports that contain debt, liability, mortgage, or property financial information. It extracts the loan information needed by the Partition Tool and assigns every loan to the appropriate property or group. A purpose-built loan template is **not** the primary input method.

### Loan requirements

- **Original-report upload:** accept the property-management software's native loan, debt, liability, property financial, and owner-statement reports without requiring the user to re-key or rearrange them into a template. Support the software's standard Excel, CSV, and text-based PDF exports.
- **Report recognition:** recognize report headings and column variations, including reports containing portfolio subtotals or multiple properties, and locate the actual loan detail table before extraction.
- **Extraction:** capture each loan's secured property, lender, loan type, current/outstanding balance, monthly debt service, maturity date, and other loan terms available in the source report.
- **Source traceability:** retain the source file, report title, page/sheet, matched source property name, and source loan label for each extracted loan record.
- **Property matching:** identify the secured property or properties for each loan and match them to the canonical property records in the Groups workbook. Clearly flag a loan that cannot be matched.
- **Review exceptions:** flag ambiguous property matches, a loan allocated to multiple properties without an allocation method, missing balance or maturity information, and duplicate loan records. A user correction must preserve the original extracted source information.
- **Partition inputs:** capture the loan values needed for the Partition Tool, including the current balance and any other required loan terms supplied by the source documents. When a property-management report does not contain a required loan term, show it as missing for review instead of estimating it.
- **Group hierarchy:** use the Groups workbook as the controlling hierarchy. A collapsed group displays the combined loan value or summary; expanding the group displays the individual properties and their related loan values.
- **Individual properties:** properties with no Group remain separately visible with their own related loan information.
- **Consistent layout:** use the same presentation pattern as the other Data tabs: grouped totals when collapsed and individual property detail when expanded.
- **Partition handoff:** make the reviewed loan values available to the Partition Tool without requiring duplicate manual entry.
- **Send to Partition Tool:** after review, send the matched loan values directly to the Partition Tool. Do not require a second file upload or duplicate entry there.
- **Optional fallback:** a simple import template may be available only for exceptional reports that cannot be read directly. It is not part of the normal workflow.

### Loans mockup

```text
DATA  /  LOANS

[ Upload Property-Management Reports ]  [ Print / Export ]  [ Clear All ]  Sort [ Name v ]
                                                        [ Expand All ] [ Collapse All ]

Loans
Loan records extracted from property-management reports are matched to the Groups workbook hierarchy.

> The Antiquera                                       GROUP TOTAL - 5 PROPERTIES
  Outstanding Balance: $3,245,000     Monthly Debt Service: $21,450
  Maturity: 06/01/2031                                             [ Expand ]

v The 600-930                                        GROUP TOTAL - 2 PROPERTIES
  Outstanding Balance: $1,180,000     Monthly Debt Service: $8,260
  Maturity: 09/01/2030                                            [ Collapse ]

  600 SW 9 Ave
  Loan: First Mortgage     Outstanding Balance: $820,000          Maturity: 09/01/2030

  930 SW 6th Street
  Loan: First Mortgage     Outstanding Balance: $360,000          Maturity: 09/01/2030

INDIVIDUAL PROPERTIES
  220 Antilla Avenue      Loan: First Mortgage     Outstanding Balance: $940,000
```

<div style="color:#FFFFFF">

## 5. Capital Expenses

This Data tab imports original capital-expenditure, work-order, budget, and property-financial reports exported from the property-management software. It extracts the actual capital expense need for each property and its approximate cost. A purpose-built template is not the primary input method.

### Capital Expenses requirements

- **Original-report upload:** accept native capital-expenditure, work-order, maintenance, budget, and property-financial reports in the property-management software's standard Excel, CSV, and text-based PDF exports.
- **Report recognition and extraction:** recognize the report heading and detail table, despite portfolio headers, introductory pages, subtotals, or report dates. Extract the property, CapEx need/description, category when available, actual or proposed status, approximate cost, report date, and source reference.
- **One line per need:** create a separate property-level line for every actual CapEx need identified in the report. Preserve multiple needs for the same property rather than combining their descriptions.
- **Approximate cost:** use the report's estimated, budgeted, approved, or actual cost as provided. Clearly label the cost basis; do not invent an estimate where the report has none.
- **Property matching and traceability:** match the report property name or address to the Groups workbook. Retain the source file, report title, page/sheet, source property name, and source line for every extracted need. Flag unmatched or ambiguous items for review.
- **Group hierarchy:** the Groups workbook controls the display. A collapsed group shows the total approximate CapEx cost for its matched member properties; expanding the group shows every property and each individual CapEx need.
- **Individual properties:** properties without a Group remain in a separate single-property list with their CapEx lines and totals.
- **Review exceptions:** flag duplicate lines, missing approximate costs, and items that cannot be matched without changing the original source record.
- **Required actions:** **Upload Property-Management Reports**, **Print / Export**, **Clear All**, **Sort by Name**, **Expand All**, **Collapse All**, and **Send to Partition Tool** after review.
- **Data retention and handoff:** imported reports and extracted CapEx data remain locally in the tool until Clear All. Send reviewed values directly to the Partition Tool; do not require a second upload.

### Capital Expenses mockup

```text
DATA  /  CAPITAL EXPENSES

[ Upload Property-Management Reports ]  [ Print / Export ]  [ Clear All ]  Sort [ Name v ]
                                                       [ Expand All ] [ Collapse All ]

Capital Expenses
Actual needs and approximate costs extracted from property-management reports.

> The Antiquera                                         GROUP TOTAL - 5 PROPERTIES
  CapEx Needs: 4                    Total Approximate Cost: $186,000       [ Expand ]

v The 600-930                                          GROUP TOTAL - 2 PROPERTIES
  CapEx Needs: 2                    Total Approximate Cost: $68,000        [ Collapse ]

  600 SW 9 Ave
  Roof replacement              Actual need             Approx. Cost: $52,000
  Fire-panel upgrade            Actual need             Approx. Cost: $16,000

INDIVIDUAL PROPERTIES
  220 Antilla Avenue
  Elevator modernization        Actual need             Approx. Cost: $74,000
```

## 6. Market Value

This Data tab imports original valuation, property-financial, appraisal, listing, or market-value reports exported from the property-management software. It extracts the reported market value for each property. A purpose-built template is not the primary input method.

### Market Value requirements

- **Original-report upload:** accept native property-management software valuation, appraisal, portfolio, listing, and property-financial reports in standard Excel, CSV, and text-based PDF exports.
- **Report recognition and extraction:** recognize the report title and detail table, even with portfolio headers, subtotals, or report dates. Extract property, reported market value, value date/as-of date, value type or method when supplied, and source reference.
- **Property matching and traceability:** match each source property name or address to the Groups workbook. Retain the source file, report title, page/sheet, source property name, and source value for review. Flag unmatched, ambiguous, duplicate, or missing values.
- **Group hierarchy:** the Groups workbook controls the display. A collapsed group shows the sum of the reported market values for its matched member properties; expanding the group shows each individual property value.
- **Individual properties:** properties without a Group remain in a separate single-property list with their individual market values.
- **Review exceptions:** never estimate or allocate market value automatically when the report does not provide a reliable property value. Show the property as needing review instead.
- **Required actions:** **Upload Property-Management Reports**, **Print / Export**, **Clear All**, **Sort by Name**, **Expand All**, **Collapse All**, and **Send to Partition Tool** after review.
- **Data retention and handoff:** imported reports and extracted market values remain locally in the tool until Clear All. Send reviewed values directly to the Partition Tool; do not require a second upload.

### Market Value mockup

```text
DATA  /  MARKET VALUE

[ Upload Property-Management Reports ]  [ Print / Export ]  [ Clear All ]  Sort [ Name v ]
                                                       [ Expand All ] [ Collapse All ]

Market Value                                                   As of: 12/31/2025
Reported values extracted from property-management reports.

> The Antiquera                                         GROUP TOTAL - 5 PROPERTIES
  Reported Market Value: $8,920,000                                    [ Expand ]

v The 600-930                                          GROUP TOTAL - 2 PROPERTIES
  Reported Market Value: $4,180,000                                   [ Collapse ]

  600 SW 9 Ave        Reported Market Value: $2,740,000
  930 SW 6th Street   Reported Market Value: $1,440,000

INDIVIDUAL PROPERTIES
  220 Antilla Avenue  Reported Market Value: $3,360,000
```

</div>

## Populate the Partition Tool

After the Data steps are reviewed, the user sends the calculated values to the Partition Tool. The handoff uses the same Groups workbook hierarchy for tax basis and depreciation, occupancy, and loans.

- **Grouped properties:** send one selection-unit record for each group using the sum of the matched member properties' remaining tax basis and tax-year depreciation.
- **Group detail in the Partition Tool:** display the group total and allow the user to see the individual member-property values that make up that total. Grouped properties remain visibly connected to their group; their underlying values are not replaced or hidden by the roll-up.
<span style="color:#FFFFFF">- **Group zoning display:** when member properties have different zoning classifications, display every distinct zoning class in the group's designated Zoning box. Keep each class visible, separated clearly; never select or overwrite it with only one member's value.</span>
<span style="color:#FFFFFF">- **Group next 40-year certification display:** when member properties have different next 40-year certification dates, display every distinct date in the group's designated Next 40-Year Certification box. Keep each date visible, separated clearly; never collapse them into a single date.</span>
- **Individual properties:** send each ungrouped property as its own selection-unit record with its individual remaining basis and tax-year depreciation.
- **Tax year:** carry the selected tax year with the depreciation values sent to the Partition Tool.
- **Occupancy and loans:** carry the reviewed occupancy and loan values from their respective Data tabs to the Partition Tool.
<span style="color:#FFFFFF">- **Capital expenses and market value:** carry the reviewed property-level CapEx needs, approximate costs, and market values from their respective Data tabs to the Partition Tool using the same Groups hierarchy.</span>
- **No second upload:** the user uploads source reports once into the relevant Data tab. The reviewed results are sent directly to the Partition Tool, rather than being uploaded again.
- **No manual duplication:** the Data workflow is the source for tax-basis and depreciation values; the Partition Tool consumes those calculated totals rather than requiring the user to re-enter them.
<span style="color:#FFFFFF">- **Canonical property matching and duplicate prevention:** the Groups workbook is the canonical property list for the Partition Tool. Match tax-return address variants (for example, abbreviated versus expanded street names or supplemental locality text) to the same Groups property. On handoff, update that existing property card, preserve its group assignment, and remove any historical duplicate card rather than creating a second property.</span>
<span style="color:#FFFFFF">- **Proportionality totals and depreciation year:** in the Partition proportionality check, the center (Unassigned) amount for every metric starts as the full unassigned portfolio total and decreases as either partner receives properties. Include Remaining Tax Basis and tax-year Depreciation in this check, and label the depreciation metric with the active Data tax year.</span>

## Success condition

The workflow is complete when every property is either included in a reviewed group total or remains an individual selection unit, and the resulting remaining tax basis and tax-year depreciation values are available in the Partition Tool.
