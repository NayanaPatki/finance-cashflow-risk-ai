# Data Dictionary

## transactions.csv

| Column | Type | Description |
| --- | --- | --- |
| transaction_id | string | Unique cash transaction identifier. |
| transaction_date | date | Actual or scheduled cash date in `YYYY-MM-DD`. |
| account | string | Bank or ledger account label. |
| direction | string | `inflow` or `outflow`. |
| category | string | Finance category used for baseline and anomaly analysis. |
| counterparty | string | Customer, supplier, bank, or authority. |
| amount | decimal | Positive transaction amount in USD. |
| status | string | `actual` or `planned`. |
| description | string | Business explanation for the cash movement. |

## invoices.csv

| Column | Type | Description |
| --- | --- | --- |
| invoice_id | string | Unique customer invoice identifier. |
| customer | string | Customer account name. |
| issue_date | date | Invoice issue date. |
| due_date | date | Contractual payment due date. |
| amount | decimal | Original invoice value. |
| amount_paid | decimal | Cash collected against the invoice. |
| payment_date | date | Most recent payment date; blank when unpaid. |
| status | string | `paid`, `open`, or `disputed`. |

## assumptions.csv

| Assumption | Unit | Purpose |
| --- | --- | --- |
| opening_cash | USD | Cash immediately before the first actual transaction. |
| minimum_cash_buffer | USD | Management liquidity threshold. |
| forecast_weeks | weeks | Rolling forecast horizon; currently 13. |