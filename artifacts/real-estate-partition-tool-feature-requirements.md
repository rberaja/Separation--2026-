# Real Estate Partition Tool — Feature Requirements

## Required workflow

First, enter the **Data**. The Partition Tool is populated only after the following two Data steps are completed and reviewed:

1. **Groups, Zoning, and Next 40-Yr Certification**
2. **Remaining Tax Basis and Depreciation**
3. **Occupancy**
4. **Loans**

```text
DATA
  1. Groups, Zoning, and Next 40-Yr Certification
  2. Remaining Tax Basis and Depreciation
  3. Occupancy
  4. Loans
        ↓
PARTITION TOOL
```

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

This Data tab imports the rent roll. The rent roll includes all properties, and the tool must identify and match the occupancy information to each property in the Groups workbook.

### Occupancy requirements

- **Rent-roll upload:** accept the rent roll source file and extract the occupancy information needed for each property.
- **Property matching:** match rent-roll property names or addresses to the canonical property records established in the Groups tab. Clearly flag any rent-roll property that cannot be matched.
- **Property values:** display the occupancy values identified for each individual property, including the source information used to support the result.
- **Group hierarchy:** use the Groups workbook as the controlling hierarchy. A collapsed group displays its occupancy total or summary; expanding the group displays the individual occupancy values for every member property.
- **Individual properties:** properties with no Group remain separately visible with their own occupancy information.
- **Consistent layout:** use the same presentation pattern as Remaining Tax Basis and Depreciation: grouped totals when collapsed and individual property detail when expanded.
- **Partition handoff:** make the reviewed occupancy values available to the Partition Tool.

### Occupancy mockup

```text
DATA  /  OCCUPANCY

[ Upload Rent Roll ]  [ Print / Export ]  [ Clear All ]  Sort [ Name v ]
                                                     [ Expand All ] [ Collapse All ]

Occupancy                                                        As of: 12/31/2025
Rent roll values are matched to the Groups workbook hierarchy.

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

This Data tab imports the loan information needed by the Partition Tool and assigns every loan to the appropriate property or group.

### Loan requirements

- **Loan-document upload:** accept the loan source documents and extract the values required by the Partition Tool.
- **Property matching:** identify the secured property or properties for each loan and match them to the canonical property records in the Groups workbook. Clearly flag a loan that cannot be matched.
- **Partition inputs:** capture the loan values needed for the Partition Tool, including the current balance and any other required loan terms supplied by the source documents.
- **Group hierarchy:** use the Groups workbook as the controlling hierarchy. A collapsed group displays the combined loan value or summary; expanding the group displays the individual properties and their related loan values.
- **Individual properties:** properties with no Group remain separately visible with their own related loan information.
- **Consistent layout:** use the same presentation pattern as the other Data tabs: grouped totals when collapsed and individual property detail when expanded.
- **Partition handoff:** make the reviewed loan values available to the Partition Tool without requiring duplicate manual entry.

### Loans mockup

```text
DATA  /  LOANS

[ Upload Loan Documents ]  [ Print / Export ]  [ Clear All ]  Sort [ Name v ]
                                                        [ Expand All ] [ Collapse All ]

Loans
Loan records are matched to the Groups workbook hierarchy.

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

## Populate the Partition Tool

After the Data steps are reviewed, the user sends the calculated values to the Partition Tool. The handoff uses the same Groups workbook hierarchy for tax basis and depreciation, occupancy, and loans.

- **Grouped properties:** send one selection-unit record for each group using the sum of the matched member properties' remaining tax basis and tax-year depreciation.
- **Group detail in the Partition Tool:** display the group total and allow the user to see the individual member-property values that make up that total. Grouped properties remain visibly connected to their group; their underlying values are not replaced or hidden by the roll-up.
- **Individual properties:** send each ungrouped property as its own selection-unit record with its individual remaining basis and tax-year depreciation.
- **Tax year:** carry the selected tax year with the depreciation values sent to the Partition Tool.
- **Occupancy and loans:** carry the reviewed occupancy and loan values from their respective Data tabs to the Partition Tool.
- **No manual duplication:** the Data workflow is the source for tax-basis and depreciation values; the Partition Tool consumes those calculated totals rather than requiring the user to re-enter them.

## Success condition

The workflow is complete when every property is either included in a reviewed group total or remains an individual selection unit, and the resulting remaining tax basis and tax-year depreciation values are available in the Partition Tool.
