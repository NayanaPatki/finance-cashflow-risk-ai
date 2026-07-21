# DAX Measures

```DAX
Actual Inflows =
CALCULATE (
    SUM ( FactTransactions[amount] ),
    FactTransactions[direction] = "inflow",
    FactTransactions[status] = "actual"
)

Actual Outflows =
CALCULATE (
    SUM ( FactTransactions[amount] ),
    FactTransactions[direction] = "outflow",
    FactTransactions[status] = "actual"
)

Net Cash Flow = [Actual Inflows] - [Actual Outflows]

Open Receivables =
SUMX (
    FILTER ( FactInvoices, FactInvoices[amount] > FactInvoices[amount_paid] ),
    FactInvoices[amount] - FactInvoices[amount_paid]
)

Overdue Receivables =
SUMX (
    FILTER (
        FactInvoices,
        FactInvoices[due_date] < MAX ( DimDate[Date] )
            && FactInvoices[amount] > FactInvoices[amount_paid]
    ),
    FactInvoices[amount] - FactInvoices[amount_paid]
)

Overdue AR % = DIVIDE ( [Overdue Receivables], [Open Receivables] )

Planned Net Cash Flow =
CALCULATE (
    SUMX (
        FactTransactions,
        IF ( FactTransactions[direction] = "inflow", FactTransactions[amount], -FactTransactions[amount] )
    ),
    FactTransactions[status] = "planned"
)

Current Cash =
MAX ( Assumptions[opening_cash] ) + [Net Cash Flow]

Cash Buffer Variance =
[Current Cash] - MAX ( Assumptions[minimum_cash_buffer] )
```