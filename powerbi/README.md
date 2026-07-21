# Power BI Build Guide

Use the three CSV files in `data/sample/` or equivalent production exports.

## Recommended Star Schema

- `FactTransactions` from `transactions.csv`
- `FactInvoices` from `invoices.csv`
- `DimDate` covering transaction, issue, due, and payment dates
- `DimCounterparty` for customer/vendor analysis
- `DimCategory` for cash-flow category analysis
- `Assumptions` as a disconnected single-row parameter table

Use inactive date relationships for invoice issue/payment dates and activate them in measures with `USERELATIONSHIP` where needed.

## Report Pages

1. Executive Liquidity
2. 13-Week Cash Forecast
3. Receivables and Aging
4. Expense Risk and Exceptions
5. Scenario and Assumptions
6. Data Quality and Refresh

Save the final report as PBIP so report/model metadata can be reviewed in Git.