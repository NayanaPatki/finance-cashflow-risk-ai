from datetime import date

from pydantic import BaseModel, Field


class FinanceSummary(BaseModel):
    as_of_date: date
    current_cash: float
    net_cash_flow_30d: float
    cash_runway_months: float | None
    overdue_receivables: float
    open_receivables: float
    minimum_forecast_cash: float
    minimum_cash_buffer: float
    liquidity_status: str


class ForecastWeek(BaseModel):
    week_number: int
    week_start: date
    week_end: date
    opening_cash: float
    operating_inflow: float
    receivable_collections: float
    planned_inflow: float
    operating_outflow: float
    planned_outflow: float
    net_cash_flow: float
    ending_cash: float
    below_buffer: bool


class ReceivableRisk(BaseModel):
    invoice_id: str
    customer: str
    due_date: date
    balance: float
    overdue_days: int
    risk_score: float = Field(ge=0, le=1)
    risk_band: str
    recommended_action: str


class ExpenseAnomaly(BaseModel):
    transaction_id: str
    transaction_date: date
    category: str
    counterparty: str
    amount: float
    category_median: float
    amount_multiple: float
    severity: str
    reason: str


class ScenarioRequest(BaseModel):
    revenue_change_pct: float = Field(default=0, ge=-60, le=100)
    expense_change_pct: float = Field(default=0, ge=-40, le=100)
    collection_delay_days: int = Field(default=0, ge=0, le=120)
    one_time_outflow: float = Field(default=0, ge=0, le=10_000_000)


class ScenarioAssumptions(BaseModel):
    revenue_change_pct: float
    expense_change_pct: float
    collection_delay_days: int
    one_time_outflow: float


class ScenarioResult(BaseModel):
    assumptions: ScenarioAssumptions
    forecast: list[ForecastWeek]
    ending_cash: float
    minimum_cash: float
    buffer_breach_week: int | None
    liquidity_status: str


class DataBundleRequest(BaseModel):
    transactions_file_name: str = Field(min_length=1, max_length=255)
    transactions_csv: str = Field(min_length=1, max_length=5_000_000)
    invoices_file_name: str = Field(min_length=1, max_length=255)
    invoices_csv: str = Field(min_length=1, max_length=5_000_000)
    opening_cash: float = Field(gt=0, le=100_000_000)
    minimum_cash_buffer: float = Field(gt=0, le=100_000_000)


class DataSourceStatus(BaseModel):
    source_type: str
    source_label: str
    transaction_rows: int
    invoice_rows: int
    as_of_date: date
    opening_cash: float
    minimum_cash_buffer: float
    imported_at: str | None