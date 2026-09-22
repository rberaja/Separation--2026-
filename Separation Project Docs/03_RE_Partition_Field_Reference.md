# RE Partition Tool — Field Reference V1.13

*Every field the tool uses, its source, and the formula applied — aligned with White Paper v6.10 (September 2026)*

**Source key:** ↑ Uploaded = value comes from the Excel import table. Calculated = derived by the tool from uploaded values. Tool input = entered by the user in the tool interface, not imported.

**Reference Name key:** **Bold** = an actual import column header accepted by the tool (see Column Guide). *Italic* = a display/derived name with no import column.

**Tax-basis vocabulary (standardized in V1.4 to match the White Paper):** *Remaining Tax Basis* (§10.1, §11.2) = the per-property input, the remaining depreciable basis in dollars. *Basis Shortfall* (§11.2–11.3) = Step 1, (portfolio basis × ownership %) − partner's basis, in basis dollars — shown as a reference row. *Basis True-Up* (§11.4, §14.1) = Step 2, the shortfall converted to cash (PV of lost depreciation) — calculated in the separate **Remaining Depreciation Tool** (to be built) and added to Total True-Up. *Depreciation year* = the tax year the depreciation figures refer to, supplied by the Remaining Depreciation Tool through the `_meta` sheet.

## GLOBAL INFORMATION

### A. Property Identification

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 2 | Name | **name** | ↑ Uploaded | Y | Property name or address. Used as the display label throughout the tool. |
| 3 | Assign | **assign** | ↑ Uploaded | | "A" or "B" — which partner receives this property. Controls partner panel totals and proportionality meters. |
| 4 | Market Discount Rate | **discount_rate** | Tool input | Y | Set once in the tool header. Applied to every property's loan to compute Debt NPV. Represents today's market rate for comparable debt. |
| 5 | Cash & Cash Equivalents | **cash_equivalents** | ↑ Uploaded (`_meta` sheet) / Tool input | Y | Portfolio-wide cash and cash equivalents entered once in the settings row, or read from the `_meta` sheet on import. Split by ownership % in the settlement (row 63). |
| 6 | Unassigned Properties | *unassigned* | Calculated | N | Read-only count of properties not yet assigned to Partner A or B, shown beside Cash & Equivalents (red while above zero). Unassigned properties belong to neither partner: they are left out of both partners' totals and of the portfolio total the proportional targets are taken from, so the gaps describe only the assigned portion. Their dollar totals appear as the grey middle segment of each Proportionality bar (rows 48–52). While the count is above zero the Final Settlement is marked *Provisional*; assign every property to complete the split. |

## PROPERTY CARD

### B. Property

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 8 | Market Value | **market_value** | ↑ Uploaded | Y | Agreed appraised market value of the property in dollars. The primary valuation input. |
| 9 | Bid Difference | *bid_difference* | Tool input | Y | Winning bid − agreed market value. Positive means the winner bid above market value to secure the property; negative means the winner bid below. Shown as a separate cash adjustment in the settlement ledger and split 60/40 through the shared pot. Does not change the property's NPV Equity figure. |
| 10 | Deferred CapEx | **deferred_capex** | ↑ Uploaded | Y | Deferred capital expenditures in dollars — known repairs or replacements not yet funded. |
| 11 | NOI / yr | **noi** | ↑ Uploaded | Y | Net Operating Income per year in dollars — rental income minus operating expenses, before any debt service. |
| 12 | Occupancy Actual % | **occupancy_actual_pct** | ↑ Uploaded | Y | Current actual occupancy as a percentage (e.g. 91.5 for 91.5%). Reflects today's occupied-unit reality. |

<div style="color:#FFFFFF">

**V1.6 AppFolio Project Directory CapEx import:** `Name` is the project description and `Total Budget` is Deferred CapEx. When a row has no date, the report metadata — **As of**, **Exported On**, or **Report Date** — supplies the item’s As Of date. The worksheet row remains available as source traceability.

</div>

<div style="color:#FFFFFF">

**V1.7 consolidated selection units:** partner assignment is made on a consolidated group header and applies to every member property; ungrouped properties remain individual selection units. Partner totals, the Unassigned indicator, and exports count each consolidated group as one property. **Expand All**, **Collapse All**, and Sort controls live in the top Partition action bar, while legacy upload, column-guide, and template controls remain hidden until needed. Cash & Equivalents is not recalculated by assignment and changes only when the user enters a replacement value.

</div>

<div style="color:#FFFFFF">

**V1.8 AppFolio Income & Expenses workspace:** the new Data tab accepts AppFolio property-summary Income Statement or P&amp;L reports (Excel, CSV, or text-based PDF) and extracts **Total Income**, **Total Expenses**, and **NOI** for each property. When both income and expenses are supplied, NOI is calculated as Income − Expenses; otherwise the reported NOI is retained. The existing Groups workbook controls the hierarchy: collapsed group bars show aggregate Income, Expenses, and NOI, and expanded groups show their member properties. The imported NOI automatically updates the Partition Tool's **noi** field, so no manual **Send to Partition Tool** action is needed. Every Data tab now shows its workflow/status notice in a centered banner and labels its optional spreadsheet download **Manual Template**.

</div>

<div style="color:#FFFFFF">

**V1.9 Data-workspace hierarchy and layout:** group/property names (or addresses) now lead every card header, with the group count, report context, and other descriptive information below. The Groups cards no longer expose a **Remove** action. Data-tab spacing is now uniform, including the Groups and Remaining Tax Basis tabs.

</div>

<div style="color:#FFFFFF">

**V1.10 AppFolio Income Statement – Property Comparison import:** the Income & Expenses tab now recognizes AppFolio reports with properties arranged in columns beneath **Account Name**. For each property column, it reads **Total Operating Income**, **Total Operating Expense**, and **NOI – Net Operating Income**. The report-wide **Total** column is excluded, the report's **Date Range** is retained as source context, and imported properties continue to roll up using the existing Groups hierarchy.

</div>

<div style="color:#FFFFFF">

**V1.11 AppFolio grouping and tax-return recovery:** Capital Expenses and Income &amp; Expenses now match common AppFolio address variants—reordered addresses, abbreviated property labels, and report ZIP suffixes—against the Groups workbook without grouping a different numbered address. Group-header Income, Expenses, and NOI totals align with the property-level values. A tax-return PDF with no depreciation schedules is not retained; **Clear All** remains available whenever a tax-return source, warning, or label is stored, even when zero schedules were extracted.

</div>

<div style="color:#FFFFFF">

**V1.12 Market Value valuation workspace:** **Upload Market Value** first asks whether the report is a **Broker's Opinion of Value** or **City Assessed Value**. Re-uploading either type warns before replacing that type only; every other valuation remains until removed or replaced. Each property retains dated, sourced valuation rows and one selected value is sent to the Partition Tool. **Appraisal**, **Income Model**, and **Construction / Land Value Model** are entered on that property's valuation line. The **Use** control is positioned beside each row's Market Value. The Income Model uses the property's imported NOI and a user-entered cap rate to calculate value. **Comps** are uploaded from the property's valuation line and are retained as a separate comparable-sales source.

</div>

<div style="color:#FF0000">

**V1.13 Market Value card editing layout — design mockup pending implementation:** Every property will use a single valuation card with Broker&apos;s Opinion of Value, Appraisal, Income Model, City Assessed Value, Construction / Land Value Model, and Comparable Sales rows. The selected valuation summary and **Use Selected Value in Partition** action are in the upper-right header. Each row&apos;s **Use** selector sits directly beside its Market Value. An **Edit** control appears at the left: Appraisal and Construction / Land Value Model reveal manual fields for provider, as-of date, reference/calculation, and Market Value; Income Model reveals a cap-rate entry in Reference / Calculation and derives its Market Value from imported NOI. This preview does not yet alter uploaded or saved data.

</div>

### C. Loan

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 14 | Loan Balance | **loan_balance** | ↑ Uploaded | Y | Outstanding principal balance of the mortgage in dollars. |
| 15 | Interest Rate | **loan_rate** | ↑ Uploaded | Y | Note interest rate as a percentage (e.g. 5.75 for 5.75%). |
| 16 | Amort. Period | **amort_period** | ↑ Uploaded | Y | Full amortization period in years — the schedule that drives the monthly payment size. Typically 30. |
| 17 | LTV | **ltv** | Calculated | N | loan_balance ÷ market_value, expressed as a percentage. Displayed on the property card for reference. |

### D. Principal and Interest

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 19 | IO Years | **io_years** | ↑ Uploaded | Y | Interest-only period in years from origination. Enter 0 if the loan has no IO period. |
| 20 | Residual Loan Term | **loan_term** | ↑ Uploaded | Y | Years until the rate resets or the balloon payment is due (end of the fixed-rate period). |
| 21 | Monthly P&I | **monthly_payment** | ↑ Uploaded | Y | Contractual monthly principal-and-interest payment from the bank statement. When provided, this overrides the computed payment and is used for Debt NPV and Annual Debt Service. |

### E. Current Values

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 23 | Adj. Net Value | **adj_net_value** | Calculated | N | market_value − deferred_capex. Represents the effective value of the property after adjusting for deferred spend. |
| 24 | Debt NPV | **debt_npv** | Calculated | N | Present value of all remaining loan cash flows discounted at the Market Discount Rate. For an IO loan in its IO period: PV of IO payments + PV of balloon at end of IO period, both discounted at the market rate. For an amortizing loan: PV of the remaining monthly P&I stream to balloon/reset, plus PV of the remaining balance at that date, discounted at the market rate. A below-market rate loan has Debt NPV < loan_balance — the borrower benefits from cheaper-than-market debt. |
| 25 | NPV Equity | **npv_equity** | Calculated | N | Adj. Market Value − Debt NPV. The true economic equity in the property after valuing the debt correctly at current market rates rather than simply subtracting the face balance. |
| 26 | Annual Debt Service | **annual_debt_service** | Calculated | N | If IO period is still active: loan_balance × loan_rate ÷ 100. Otherwise: monthly_payment × 12 (or computed payment × 12 if monthly_payment is blank). |
| 27 | Net Cash Flow / yr | **net_cash_flow** | Calculated | N | noi − Annual Debt Service. The cash the property produces after meeting its loan obligations. |

### F. Tax and Compliance

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 29 | Next 40-Yr Certification | *next_40yr_certification* | ↑ Uploaded | N | Year the property's next 40-year recertification is due. Supplied via Excel/import table. Displayed on the property card for compliance awareness. |
| 30 | Zoning | *zoning* | ↑ Uploaded | N | Zoning designation of the property (e.g. RM-24). Supplied via Excel/import table. Displayed on the card for reference. |
| 31 | Remaining Tax Basis | **remaining_tax_basis** | ↑ Uploaded | N | Remaining depreciable tax basis of the property in dollars — the value the IRS still allows the owner to write off (White Paper §11.2). Summed per partner (row 45) and used for the Basis Shortfall (row 59), which the Remaining Depreciation Tool converts into the Basis True-Up (row 61). Import also accepts the legacy headers `remaining_basis` (v7.5) and `residual_tax_basis` (v8.0). |
| 32 | BLANK | | ------------------ | | |
| 33 | Depreciation *{year}* | **depreciation** | ↑ Uploaded | N | Annual depreciation expense in dollars for the depreciation year. The year in the label is not typed here: it is read from the `_meta` sheet column **depreciation_year**, which the Remaining Depreciation Tool writes (default 2025 until that tool exists). Displayed on the card for reference. Import also accepts the legacy header `depreciation_2025`. |

## PARTNER TOTALS AND PROPORTIONALITY CHECK

*Partner Panel Totals (Aggregated Across Each Partner's Properties)*

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 35 | Market Value (total) | *market_value_total* | Calculated | N | Sum of market_value for all properties assigned to this partner. |
| 36 | Deferred CapEx (total) | *deferred_capex_total* | Calculated | N | Sum of deferred_capex for all properties assigned to this partner. |
| 37 | Adj. Market Value (total) | *adj_market_value_total* | Calculated | N | Sum of Adj. Market Value for all properties assigned to this partner. |
| 38 | Loan Balance (total) | *loan_balance_total* | Calculated | N | Sum of loan_balance for all properties assigned to this partner. |
| 39 | Debt NPV (total) | *debt_npv_total* | Calculated | N | Sum of Debt NPV for all properties assigned to this partner. |
| 40 | NPV Equity (total) | *npv_equity_total* | Calculated | N | Sum of NPV Equity for all properties assigned to this partner. This is the primary settlement metric. |
| 41 | NOI / yr (total) | *noi_total* | Calculated | N | Sum of noi for all properties assigned to this partner. |
| 42 | Ann. Debt Service (total) | *annual_debt_service_total* | Calculated | N | Sum of Annual Debt Service for all properties assigned to this partner. |
| 43 | Net CF / yr (total) | *net_cash_flow_total* | Calculated | N | Sum of Net Cash Flow / yr for all properties assigned to this partner. |
| 44 | Properties | *properties_count* | Calculated | N | Number of properties assigned to this partner. Properties not yet assigned to A or B are counted in neither column (see row 6, Unassigned). |
| 45 | Remaining Tax Basis (total) | *remaining_tax_basis_total* | Calculated | N | Sum of remaining_tax_basis for all properties assigned to this partner. Compared to each partner's proportional target to compute the Basis Shortfall (row 59). |
| 46 | Bid Difference (total) | *bid_difference_total* | Calculated | N | Sum of Bid Difference for all properties assigned to this partner. |

### Proportionality vs Target

*Section C of the tool. Each bar shows how the portfolio total for a metric is actually divided (orange = Partner A's actual share on the left, grey = unassigned in the middle, blue = Partner B's on the right), with the three amounts printed above it as A / Unassigned / B. The tick marks the target split (ownership %); once every property is assigned the grey segment disappears and the orange edge should meet the tick. These bars are a visual check only — the dollar gaps and the settlement are in the Gap Analysis section below.*

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 48 | Adj. Market Value (share) | *adj_market_value_share* | Calculated | N | Partner's Adj. Market Value (total) ÷ portfolio total Adj. Market Value. Negative partner totals are floored at zero before drawing the bar. |
| 49 | NPV Equity (share) | *npv_equity_share* | Calculated | N | Partner's NPV Equity (total) ÷ portfolio total NPV Equity. Negative partner totals are floored at zero. |
| 50 | Debt Service (share) | *debt_service_share* | Calculated | N | Partner's Ann. Debt Service (total) ÷ portfolio total Ann. Debt Service. |
| 51 | Net Cash Flow (share) | *net_cash_flow_share* | Calculated | N | Partner's Net CF / yr (total) ÷ portfolio total Net CF / yr. Negative partner totals are floored at zero. |
| 52 | Bid Difference (share) | *bid_difference_share* | Calculated | N | Partner's Bid Difference (total) ÷ portfolio total Bid Difference. Negative partner totals are floored at zero. |
| 53 | Target split (tick) | *target_split* | Tool input | Y | Partner A's ownership % (Partner B = 100% − A). Where the orange edge lands relative to the tick shows the gap at a glance. |

## GAP ANALYSIS & SETTLEMENT

*Section D of the tool. Follows White Paper v6.10 §14.1. **Sign convention for every gap: target − actual. A positive number means the partner is under-allocated and is owed cash; a negative number means the partner holds more than their share and pays.** Each gap is shown from Partner A's side in the Partner A column and as its negative in the Partner B column, so every row nets to zero. The grey **Unassigned** column between them is not a gap: it shows the amount of that metric still sitting on properties assigned to neither partner (row 6) — what remains to be placed — and is blank on rows that have no such figure (Basis True-Up, Cash & Equivalents, Total True-Up).*

*Rows 56–59 are shown for reference and are not part of the settlement; rows 60–63 are the settlement items that feed Total True-Up (row 64) (White Paper §9.1–9.2: debt can be re-set by refinancing after the split, and cash flow is measured as NOI before loan payments, so neither controls the settlement).*

### Reference only — not part of the settlement

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 56 | Adj. Market Value | *adj_market_value_gap* | Calculated | N | (Portfolio total Adj. Market Value × ownership %) − Partner's Adj. Market Value (total). Positive means the partner received less adjusted property value than their proportional target. Reference only: property value is already captured in NPV Equity (row 60). |
| 57 | Debt Service | *debt_service_gap* | Calculated | N | Partner's Ann. Debt Service (total) − (portfolio total Ann. Debt Service × ownership %). Debt service is a burden, so the subtraction is reversed to keep "positive = owed": positive means the partner carries more debt-service burden than their proportional target. Reference only: debt is valued in NPV Equity via Debt NPV and can be re-set by refinancing after the split (White Paper §9.1). |
| 58 | Net Cash Flow | *net_cash_flow_gap* | Calculated | N | (Portfolio total Net CF / yr × ownership %) − Partner's Net CF / yr (total). Positive means the partner receives less levered cash flow than their proportional target. Reference only: the split measures cash flow as NOI before loan payments, not levered cash flow (White Paper §9.2, §10.3). |
| 59 | Basis Shortfall | *basis_shortfall* | Calculated | N | (Portfolio total Remaining Tax Basis × ownership %) − Partner's Remaining Tax Basis (total), in basis dollars (White Paper §11.3). This is Step 1 of the Basis True-Up (row 61). Reference only until converted to cash in the Remaining Depreciation Tool. |

### Metrics used for settlement

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 60 | NPV Equity | *npv_equity_gap* | Calculated | N | (Portfolio total NPV Equity × ownership %) − Partner's NPV Equity (total). Positive means the partner received less NPV Equity than their proportional target and is owed cash; negative means the partner received more than target and pays cash. Shared by ownership % automatically because NPV Equity already reflects the market value of each loan (Debt NPV). |
| 61 | Basis True-Up | *basis_true_up* | Calculated (Remaining Depreciation Tool) | N | Step 1 — Basis Shortfall in basis dollars (row 59; White Paper §11.3). Step 2 — convert the shortfall to cash: the present value of the lost annual depreciation benefit, discounted year by year from the real depreciation schedule and not discounted a second time (White Paper §11.4). Positive means the partner received less remaining tax basis than their share and is owed compensation. Paid 100% partner to partner: the ownership % is already applied in the target (row 59), so the resulting True-Up is not split again — doing so would apply the ratio twice and underpay the shorted partner (White Paper §11.5). The Partition Tool shows Step 1 only; Step 2 is calculated in the separate Remaining Depreciation Tool and the result is added to Total True-Up. |
| 62 | Bid Difference | *bid_difference_gap* | Calculated | N | (Portfolio total Bid Difference × ownership %) − Partner's Bid Difference (total). Positive means the partner received less than their proportional share of the total Bid Difference adjustment and is owed cash; negative means the partner received more than their proportional share and pays cash. Settled through the shared account, split by ownership %. |
| 63 | Cash & Equivalents | *cash_equivalents_gap* | Calculated | N | (Portfolio total Cash & Equivalents × ownership %) − Cash allocated to the partner. Positive means the partner received less cash than their proportional share and is owed; negative means the partner received more and owes. The Partition Tool allocates cash by ownership %, so it displays each partner's share (row 5 × ownership %) and the gap is zero by construction. |
| 64 | Total True-Up | *total_true_up* | Calculated | N | NPV Equity gap (60) + Basis True-Up (61) + Bid Difference gap (62) + Cash & Equivalents gap (63). Positive means the partner is owed that amount; negative means the partner pays it. By construction the two partners' totals net to zero. |
| 65 | Final Settlement | *final_settlement* | Calculated | N | The partner whose Total True-Up is negative pays the other partner the absolute amount. Displayed as "Partner X pays Partner Y $N". When both totals are within $1 of zero the split is balanced and no payment is due. Marked *Provisional* while any property is unassigned (row 6). |

## PRINT / EXPORT

*The **Print / Export** toolbar button produces the sign-off outputs. Both contain every property, the partner totals (rows 35–46), the gap analysis (rows 56–65) and the final settlement exactly as shown on screen.*

| Output | Contents |
|---|---|
| Excel workbook (`RE_Partition_Report_<date>.xlsx`) | `Properties` sheet in import format (rows 2–33 headers) plus calculated columns `ltv`, `adj_net_value`, `debt_npv`, `npv_equity`, `annual_debt_service`, `net_cash_flow`; `Summary` sheet with settings, partner totals, gap analysis and final settlement; `_meta` sheet (`partner_a_name`, `partner_b_name`, `partner_a_pct`, `discount_rate`, `cash_equivalents`, `depreciation_year`). Re-uploading the workbook reproduces the exact scenario. |
| PDF report (browser print → Save as PDF) | Landscape letter: A. property schedule (inputs, then calculated values), B. partner totals, D. gap analysis with final settlement, signature and date lines for each partner, and notes on the sign convention and the Basis True-Up. |

---

### Change log

| Version | Change |
|---|---|
| V1.13 | <span style="color:#FF0000">Design mockup pending implementation: every property receives a unified Market Value card. Its header shows the selected value and the Use Selected Value in Partition action; each row&apos;s Use selector sits by Market Value. Left-side Edit controls expose all manual fields for Appraisal and Construction / Land Value Model, while Income Model exposes an inline cap-rate calculation based on NOI.</span> |
| V1.12 | <span style="color:#FFFFFF">Market Value now retains multiple dated valuation sources for each property. Upload Market Value prompts for Broker's Opinion of Value or City Assessed Value and warns before replacing an existing source type. Appraisal, Income Model (NOI ÷ cap rate), Construction / Land Value Model, and uploaded Comps are managed on the same property valuation line; the Use button sits beside each Market Value and selects that row for the Partition Tool.</span> |
| V1.11 | <span style="color:#FFFFFF">Improved AppFolio-to-Groups matching for reordered, abbreviated, and ZIP-suffixed property labels while protecting distinct street numbers from accidental grouping. Aligned Income &amp; Expenses group totals with property values. Tax returns without depreciation schedules are no longer retained, and Clear All now removes stored tax-return sources, warnings, and labels even when no schedules exist.</span> |
| V1.10 | <span style="color:#FFFFFF">Added AppFolio Income Statement – Property Comparison support. The Income &amp; Expenses importer now reads property columns beneath Account Name, extracts Total Operating Income, Total Operating Expense, and NOI – Net Operating Income, excludes the report-wide Total column, and retains the Date Range as source context.</span> |
| V1.9 | <span style="color:#FFFFFF">Standardized the Data-workspace hierarchy: the group/property name or address now leads every card header and supporting information follows below. Removed the visible Groups Remove control and normalized spacing across the Data tabs, including Groups and Remaining Tax Basis.</span> |
| V1.8 | <span style="color:#FFFFFF">Added the AppFolio Income &amp; Expenses Data tab: it extracts Total Income, Total Expenses, and NOI by property; retains the Groups hierarchy with aggregate collapsed headers; supports upload, Manual Template, Print / Export, Clear All, and Income / Expenses / NOI sorting; and automatically updates the Partition Tool NOI field. Data-workspace notices are now centered and Send to Partition Tool buttons were removed because synchronization is automatic.</span> |
| V1.7 | <span style="color:#FFFFFF">Partner assignment is controlled at the consolidated selection-unit level; group counts are one property; Expand All, Collapse All, and Sort controls are in the top action bar; Cash & Equivalents stays fixed until replaced.</span> |
| V1.6 | <span style="color:#FFFFFF">AppFolio Project Directory CapEx imports map Name to description and Total Budget to Deferred CapEx; the report date supplies As Of when the row has no date.</span> |
| V1.5 | <span style="color:#FFFFFF">Unassigned properties no longer default to Partner B: they are excluded from both partners and from the targets, shown in the new Unassigned indicator (row 6), and the Final Settlement is marked Provisional until every property is assigned (rows 44, 65).</span> |
| V1.4 | <span style="color:#FFFFFF">Tax-basis vocabulary aligned with the White Paper: rows 31/45 *Remaining Tax Basis*, row 59 *Basis Shortfall* (§11.3), row 61 *Basis True-Up* (§11.4, §14.1); the separate tool is the *Tax Basis Tool*. Import header confirmed as `remaining_tax_basis` and now actually accepted (V1.3 listed it as confirmed, but the v7.5 tool used `remaining_basis`, which is still accepted). Row 33 is now `depreciation` with the year supplied via `_meta` `depreciation_year` (legacy `depreciation_2025` accepted). `cash_equivalents` added to the `_meta` import sheet (row 5). Added the Print / Export section.</span> |
| V1.3 | <span style="color:#FFFFFF">Aligned with White Paper v6.10. Gap sign convention is now uniformly target − actual (positive = owed) — the former "Proportionality vs Target" rows 48–54 had the subtraction reversed and contradicted rows 56–62. Total True-Up now consists of NPV Equity gap + Basis True-Up + Bid Difference gap + Cash & Equivalents gap only (§14.1); Adj. Market Value, Debt Service and Net Cash Flow gaps are reference only. "Proportionality vs Target" rows rewritten to describe the section C bars (actual shares vs target tick) rather than duplicating the gap formulas. Reference rows are listed first (56–59), then the settlement metrics (60–65), matching the tool. Added Final Settlement (row 65).</span> |
| V1.2 | <span style="color:#FFFFFF">Previous version.</span> |
