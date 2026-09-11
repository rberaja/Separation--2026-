# RE Partition Tool — Field Reference V1.2

*Every field the tool uses, its source, and the formula applied — v7.2*

**Source key:** ↑ Uploaded = value comes from the Excel import table. Calculated = derived by the tool from uploaded values. Tool input = entered by the user in the tool interface, not imported.

**Reference Name key:** **Bold** = confirmed against the v7.4 tool's actual field/import names (shown in orange, bold in the original). *Italic* = proposed for this version — no equivalent field exists in v7.4 (shown in gray, italic in the original).

## GLOBAL INFORMATION

### A. Property Identification

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 2 | Name | **name** | ↑ Uploaded | Y | Property name or address. Used as the display label throughout the tool. |
| 3 | Assign | **assign** | ↑ Uploaded | | "A" or "B" — which partner receives this property. Controls partner panel totals and proportionality meters. |
| 4 | Market Discount Rate | **discount_rate** | Tool input | Y | Set once in the tool header. Applied to every property's loan to compute Debt NPV. Represents today's market rate for comparable debt. |
| 5 | Cash & Cash Equivalents | *cash_equivalents* | ↑ Uploaded | Y |Cash and cash equivalents that will be uploaded to be inserted into the common pot value.  |

## PROPERTY CARD

### B. Property

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 8 | Market Value | **market_value** | ↑ Uploaded | Y | Agreed appraised market value of the property in dollars. The primary valuation input. |
| 9 | Bid Difference | *bid_difference* | Tool input | Y | Winning bid − agreed market value. Positive means the winner bid above market value to secure the property; negative means the winner bid below. Shown as a separate cash adjustment in the settlement ledger and split 60/40 through the shared pot. Does not change the property's NPV Equity figure. |
| 10 | Deferred CapEx | **deferred_capex** | ↑ Uploaded | Y | Deferred capital expenditures in dollars — known repairs or replacements not yet funded. |
| 11 | NOI / yr | **noi** | ↑ Uploaded | Y | Net Operating Income per year in dollars — rental income minus operating expenses, before any debt service. |
| 12 | Occupancy Actual % | **occupancy_actual_pct** | ↑ Uploaded | Y | Current actual occupancy as a percentage (e.g. 91.5 for 91.5%). Reflects today's occupied-unit reality. |

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
| 23 | ADJ. NET VALUE | **adj_net_value** | Calculated | N | market_value − deferred_capex. Represents the effective value of the property after adjusting for deferred spend. |
| 24 | DEBT NPV | **debt_npv** | Calculated | N | Present value of all remaining loan cash flows discounted at the Market Discount Rate. For an IO loan in its IO period: PV of IO payments + PV of balloon at end of IO period, both discounted at the market rate. For an amortizing loan: PV of the remaining monthly P&I stream to balloon/reset, plus PV of the remaining balance at that date, discounted at the market rate. A below-market rate loan has Debt NPV < loan_balance — the borrower benefits from cheaper-than-market debt. |
| 25 | NPV EQUITY | **npv_equity** | Calculated | N | Adj. Market Value − Debt NPV. The true economic equity in the property after valuing the debt correctly at current market rates rather than simply subtracting the face balance. |
| 26 | ANNUAL DEBT SERVICE | **annual_debt_service** | Calculated | N | If IO period is still active: loan_balance × loan_rate ÷ 100. Otherwise: monthly_payment × 12 (or computed payment × 12 if monthly_payment is blank). |
| 27 | NET CASH FLOW / YR | **net_cash_flow** | Calculated | N | noi − Annual Debt Service. The cash the property produces after meeting its loan obligations. |

### F. Tax and Compliance

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 29 | NEXT 40-YR CERTIFICATION | *next_40yr_certification* | ↑ Uploaded | N | Year the property's next 40-year recertification is due. Supplied via Excel/import table. Displayed on the property card for compliance awareness. |
| 30 | ZONING | *zoning* | ↑ Uploaded | N | Zoning designation of the property (e.g. RM-24). Supplied via Excel/import table. Displayed on the card for reference. |
| 31 | REMAINING TAX BASIS | **remaining_tax_basis** | ↑ Uploaded | N | Remaining tax basis of the property in dollars — the remaining depreciable value the IRS allows the owner to write off. Used to calculate the Basis True-Up. |
| 32 | BLANK | | ------------------ | | |
| 33 | DEPRECIATION 2025 | **depreciation_2025** | ↑ Uploaded | N | Annual depreciation tax shield for the current year. Typically: Tax Basis ÷ remaining depreciable life × effective tax rate. Displayed on the card for reference. |

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
| 44 | Properties | *properties_count* | | N | |
| 45 | Remaining Tax Basis (total) | *remaining_tax_basis_total* | Calculated | N | Sum of remaining_tax_basis for all properties assigned to this partner. Compared to each partner's proportional target remaining tax basis to compute the Basis True-Up. |
| 46 | Bid Difference (total) | *bid_difference_total* | Calculated | N | Sum of Bid Difference for all properties assigned to this partner. |

### Proportionality vs Target

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 48 | NPV Equity gap | *npv_equity_gap* | Calculated | N | Partner's NPV Equity (total) − (portfolio total NPV Equity × ownership %). Positive = partner is under-allocated and is owed; negative = over-allocated and owes. |
| 49 | Adj. Market Value gap | *adj_market_value_gap* | Calculated | N | Partner's Adj. Market Value (total) − (portfolio total Adj. Market Value × ownership %). |
| 50 | Debt Service gap | *debt_service_gap* | Calculated | N | Partner's Ann. Debt Service (total) − (portfolio total Ann. Debt Service × ownership %). |
| 51 | Net Cash Flow gap | *net_cash_flow_gap* | Calculated | N | Partner's Net CF / yr (total) − (portfolio total Net CF / yr × ownership %). |
| 52 | Basis True-Up | *basis_true_up* | Calculated | N | (Portfolio total Remaining Tax Basis × ownership %) − Partner's Remaining Tax Basis (total). Positive means the partner received less remaining tax basis than their proportional share and is owed compensation. The dollar value is the present value of the lost future depreciation benefit, calculated from the depreciation schedule and not discounted a second time. |
| 53 | Bid Difference gap | *bid_difference_gap* | Calculated | N | Sum of Bid Differences for properties won by this partner minus the partner's ownership percentage of the total portfolio Bid Differences. Split according to ownership percentage through the shared settlement pot. |
| 54 | Total True-Up | *total_true_up* | Calculated | N | Sum of all gap line items above. The partner whose Total True-Up is negative is the one who pays cash to close the gap. By construction the two partners' totals net to zero. |

## GAP ANALYSIS & SETTLEMENT

| # | Field | Reference Name | Source | Modifiable In Tool | Formula / Notes |
|---|---|---|---|---|---|
| 56 | NPV Equity | *npv_equity_gap* | Calculated | N | (Portfolio total NPV Equity × ownership %) − Partner's NPV Equity (total). Positive means the partner received less NPV Equity than their proportional target and is owed cash; negative means the partner received more than target and pays cash. |
| 57 | Adjusted Market Value | *adj_market_value_gap* | Calculated | N | (Portfolio total Adj. Market Value × ownership %) − Partner's Adj. Market Value (total). Positive means the partner received less adjusted property value than their proportional target and is owed cash; negative means the partner received more than target and pays cash. |
| 58 | Debt Service | *debt_service_gap* | Calculated | N | Partner's Annual Debt Service (total) − (portfolio total Annual Debt Service × ownership %). Debt service is a burden, so the sign is intentionally reversed from value metrics. Positive means the partner carries more debt-service burden than their proportional target and is owed cash; negative means the partner carries less burden and pays cash. |
| 59 | Net Cash Flow | *net_cash_flow_gap* | Calculated | N | (Portfolio total Net Cash Flow / yr × ownership %) − Partner's Net Cash Flow / yr (total). Positive means the partner receives less annual net cash flow than their proportional target and is owed cash; negative means the partner receives more than target and pays cash. |
| 60 | Basis True-Up | *basis_true_up* | Calculated | N | (Portfolio total Remaining Tax Basis × ownership %) − Partner's Remaining Tax Basis (total). Positive means the partner received less remaining tax basis than their proportional share. The compensation amount is the present value of the lost future depreciation benefit, calculated from the depreciation schedule and not discounted a second time. |
| 61 | Bid Difference | *bid_difference_gap* | Calculated | N | (Portfolio total Bid Difference × ownership %) − Partner's Bid Difference (total). Positive means the partner received less than their proportional share of the total Bid Difference adjustment and is owed cash; negative means the partner received more than their proportional share and pays cash through the shared settlement pot. |
| 62 | Cash Equivalents | *cash_equivalents_gap* | Calculated | N | (Portfolio total Cash Equivalents × ownership %) − Partner's Cash Equivalents allocated. Positive means the partner received less cash or cash-equivalent value than their proportional share and is owed cash; negative means the partner received more than their proportional share and pays or offsets through the final settlement. |
