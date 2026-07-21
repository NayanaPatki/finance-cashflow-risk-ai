from __future__ import annotations

import csv
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from statistics import mean, median


@dataclass(frozen=True)
class Transaction:
    transaction_id: str
    transaction_date: date
    account: str
    direction: str
    category: str
    counterparty: str
    amount: float
    status: str
    description: str

    @property
    def signed_amount(self) -> float:
        return self.amount if self.direction == "inflow" else -self.amount


@dataclass(frozen=True)
class Invoice:
    invoice_id: str
    customer: str
    issue_date: date
    due_date: date
    amount: float
    amount_paid: float
    payment_date: date | None
    status: str

    @property
    def balance(self) -> float:
        return round(max(self.amount - self.amount_paid, 0), 2)


@dataclass(frozen=True)
class FinanceAssumptions:
    opening_cash: float
    minimum_cash_buffer: float
    forecast_weeks: int = 13


def load_assumptions(path: str | Path) -> FinanceAssumptions:
    with Path(path).open(newline="", encoding="utf-8-sig") as file:
        values = {row["assumption"].strip(): float(row["value"]) for row in csv.DictReader(file)}
    return FinanceAssumptions(
        opening_cash=values["opening_cash"],
        minimum_cash_buffer=values["minimum_cash_buffer"],
        forecast_weeks=int(values.get("forecast_weeks", 13)),
    )

def load_transactions(path: str | Path) -> list[Transaction]:
    with Path(path).open(newline="", encoding="utf-8-sig") as file:
        rows = csv.DictReader(file)
        transactions = []
        for row in rows:
            direction = row["direction"].strip().lower()
            status = row["status"].strip().lower()
            if direction not in {"inflow", "outflow"}:
                raise ValueError(f"Invalid direction for {row['transaction_id']}: {direction}")
            if status not in {"actual", "planned"}:
                raise ValueError(f"Invalid status for {row['transaction_id']}: {status}")
            amount = float(row["amount"])
            if amount <= 0:
                raise ValueError(f"Transaction amount must be positive for {row['transaction_id']}")
            transactions.append(
                Transaction(
                    transaction_id=row["transaction_id"].strip(),
                    transaction_date=date.fromisoformat(row["transaction_date"]),
                    account=row["account"].strip(),
                    direction=direction,
                    category=row["category"].strip(),
                    counterparty=row["counterparty"].strip(),
                    amount=amount,
                    status=status,
                    description=row["description"].strip(),
                )
            )
    return transactions


def load_invoices(path: str | Path) -> list[Invoice]:
    with Path(path).open(newline="", encoding="utf-8-sig") as file:
        rows = csv.DictReader(file)
        invoices = []
        for row in rows:
            amount = float(row["amount"])
            amount_paid = float(row["amount_paid"])
            if amount <= 0 or amount_paid < 0 or amount_paid > amount:
                raise ValueError(f"Invalid invoice amounts for {row['invoice_id']}")
            payment_date = date.fromisoformat(row["payment_date"]) if row["payment_date"].strip() else None
            invoices.append(
                Invoice(
                    invoice_id=row["invoice_id"].strip(),
                    customer=row["customer"].strip(),
                    issue_date=date.fromisoformat(row["issue_date"]),
                    due_date=date.fromisoformat(row["due_date"]),
                    amount=amount,
                    amount_paid=amount_paid,
                    payment_date=payment_date,
                    status=row["status"].strip().lower(),
                )
            )
    return invoices


def analysis_date(transactions: list[Transaction]) -> date:
    actual_dates = [item.transaction_date for item in transactions if item.status == "actual"]
    if not actual_dates:
        raise ValueError("At least one actual transaction is required.")
    return max(actual_dates)


def current_cash(transactions: list[Transaction], assumptions: FinanceAssumptions) -> float:
    as_of = analysis_date(transactions)
    actual_flow = sum(
        item.signed_amount
        for item in transactions
        if item.status == "actual" and item.transaction_date <= as_of
    )
    return round(assumptions.opening_cash + actual_flow, 2)


def summarize_finance(
    transactions: list[Transaction],
    invoices: list[Invoice],
    assumptions: FinanceAssumptions,
) -> dict:
    as_of = analysis_date(transactions)
    cash = current_cash(transactions, assumptions)
    trailing_start = as_of - timedelta(days=29)
    trailing = [
        item
        for item in transactions
        if item.status == "actual" and trailing_start <= item.transaction_date <= as_of
    ]
    inflows = sum(item.amount for item in trailing if item.direction == "inflow")
    outflows = sum(item.amount for item in trailing if item.direction == "outflow")
    overdue = sum(invoice.balance for invoice in invoices if invoice.balance and invoice.due_date < as_of)
    open_receivables = sum(invoice.balance for invoice in invoices)
    monthly_burn = _average_monthly_outflow(transactions, as_of)
    runway = round(cash / monthly_burn, 1) if monthly_burn > 0 else None
    base_forecast = build_cash_forecast(transactions, invoices, assumptions)
    minimum_forecast_cash = min(row["ending_cash"] for row in base_forecast)

    return {
        "as_of_date": as_of,
        "current_cash": cash,
        "net_cash_flow_30d": round(inflows - outflows, 2),
        "cash_runway_months": runway,
        "overdue_receivables": round(overdue, 2),
        "open_receivables": round(open_receivables, 2),
        "minimum_forecast_cash": round(minimum_forecast_cash, 2),
        "minimum_cash_buffer": assumptions.minimum_cash_buffer,
        "liquidity_status": _liquidity_status(minimum_forecast_cash, assumptions.minimum_cash_buffer, runway),
    }


def build_cash_forecast(
    transactions: list[Transaction],
    invoices: list[Invoice],
    assumptions: FinanceAssumptions,
    revenue_change_pct: float = 0,
    expense_change_pct: float = 0,
    collection_delay_days: int = 0,
    one_time_outflow: float = 0,
) -> list[dict]:
    as_of = analysis_date(transactions)
    starting_cash = current_cash(transactions, assumptions)
    weekly_inflow, weekly_outflow = _weekly_operating_baseline(transactions, as_of)
    planned = [item for item in transactions if item.status == "planned" and item.transaction_date > as_of]
    open_invoices = [invoice for invoice in invoices if invoice.balance > 0]

    rows = []
    opening_cash = starting_cash
    week_start = as_of + timedelta(days=1)
    for week_number in range(1, assumptions.forecast_weeks + 1):
        week_end = week_start + timedelta(days=6)
        planned_inflow = sum(
            item.amount for item in planned if item.direction == "inflow" and week_start <= item.transaction_date <= week_end
        )
        planned_outflow = sum(
            item.amount for item in planned if item.direction == "outflow" and week_start <= item.transaction_date <= week_end
        )
        receivable_collections = sum(
            invoice.balance
            for invoice in open_invoices
            if week_start <= invoice.due_date + timedelta(days=collection_delay_days) <= week_end
        )
        operating_inflow = weekly_inflow * (1 + revenue_change_pct / 100)
        operating_outflow = weekly_outflow * (1 + expense_change_pct / 100)
        scenario_outflow = one_time_outflow if week_number == 1 else 0
        total_inflow = operating_inflow + planned_inflow + receivable_collections
        total_outflow = operating_outflow + planned_outflow + scenario_outflow
        net_cash_flow = total_inflow - total_outflow
        ending_cash = opening_cash + net_cash_flow
        rows.append(
            {
                "week_number": week_number,
                "week_start": week_start,
                "week_end": week_end,
                "opening_cash": round(opening_cash, 2),
                "operating_inflow": round(operating_inflow, 2),
                "receivable_collections": round(receivable_collections, 2),
                "planned_inflow": round(planned_inflow, 2),
                "operating_outflow": round(operating_outflow, 2),
                "planned_outflow": round(planned_outflow + scenario_outflow, 2),
                "net_cash_flow": round(net_cash_flow, 2),
                "ending_cash": round(ending_cash, 2),
                "below_buffer": ending_cash < assumptions.minimum_cash_buffer,
            }
        )
        opening_cash = ending_cash
        week_start = week_end + timedelta(days=1)
    return rows


def build_scenario_result(
    transactions: list[Transaction],
    invoices: list[Invoice],
    assumptions: FinanceAssumptions,
    revenue_change_pct: float,
    expense_change_pct: float,
    collection_delay_days: int,
    one_time_outflow: float,
) -> dict:
    forecast = build_cash_forecast(
        transactions,
        invoices,
        assumptions,
        revenue_change_pct,
        expense_change_pct,
        collection_delay_days,
        one_time_outflow,
    )
    minimum_cash = min(row["ending_cash"] for row in forecast)
    breach = next((row for row in forecast if row["below_buffer"]), None)
    return {
        "assumptions": {
            "revenue_change_pct": revenue_change_pct,
            "expense_change_pct": expense_change_pct,
            "collection_delay_days": collection_delay_days,
            "one_time_outflow": one_time_outflow,
        },
        "forecast": forecast,
        "ending_cash": forecast[-1]["ending_cash"],
        "minimum_cash": round(minimum_cash, 2),
        "buffer_breach_week": breach["week_number"] if breach else None,
        "liquidity_status": _liquidity_status(minimum_cash, assumptions.minimum_cash_buffer, None),
    }


def build_receivables_risk(invoices: list[Invoice], as_of: date) -> list[dict]:
    open_invoices = [invoice for invoice in invoices if invoice.balance > 0]
    total_open = sum(invoice.balance for invoice in open_invoices) or 1
    rows = []
    for invoice in open_invoices:
        overdue_days = max((as_of - invoice.due_date).days, 0)
        aging_component = min(overdue_days / 90, 1) * 0.6
        concentration_component = min(invoice.balance / total_open, 1) * 0.25
        dispute_component = 0.15 if invoice.status == "disputed" else 0
        risk_score = round(min(aging_component + concentration_component + dispute_component, 1), 2)
        rows.append(
            {
                "invoice_id": invoice.invoice_id,
                "customer": invoice.customer,
                "due_date": invoice.due_date,
                "balance": invoice.balance,
                "overdue_days": overdue_days,
                "risk_score": risk_score,
                "risk_band": "High" if risk_score >= 0.6 else "Medium" if risk_score >= 0.3 else "Low",
                "recommended_action": _collection_action(overdue_days, invoice.status, risk_score),
            }
        )
    return sorted(rows, key=lambda row: (row["risk_score"], row["balance"]), reverse=True)


def detect_expense_anomalies(transactions: list[Transaction]) -> list[dict]:
    as_of = analysis_date(transactions)
    recent_start = as_of - timedelta(days=89)
    expenses = [
        item
        for item in transactions
        if item.status == "actual" and item.direction == "outflow" and item.transaction_date >= recent_start
    ]
    by_category: dict[str, list[float]] = defaultdict(list)
    for item in expenses:
        by_category[item.category].append(item.amount)

    anomalies = []
    for item in expenses:
        values = by_category[item.category]
        category_median = median(values)
        deviations = [abs(value - category_median) for value in values]
        mad = median(deviations) if deviations else 0
        robust_score = 0 if mad == 0 else 0.6745 * abs(item.amount - category_median) / mad
        amount_multiple = item.amount / category_median if category_median else 0
        is_anomaly = (len(values) >= 3 and robust_score >= 3.5) or amount_multiple >= 2.25
        if is_anomaly:
            severity = "High" if amount_multiple >= 3 or robust_score >= 6 else "Medium"
            anomalies.append(
                {
                    "transaction_id": item.transaction_id,
                    "transaction_date": item.transaction_date,
                    "category": item.category,
                    "counterparty": item.counterparty,
                    "amount": item.amount,
                    "category_median": round(category_median, 2),
                    "amount_multiple": round(amount_multiple, 1),
                    "severity": severity,
                    "reason": f"{amount_multiple:.1f}x the category median",
                }
            )
    return sorted(anomalies, key=lambda row: (row["severity"] == "High", row["amount_multiple"]), reverse=True)


def _weekly_operating_baseline(transactions: list[Transaction], as_of: date) -> tuple[float, float]:
    baseline_start = as_of - timedelta(days=55)
    recurring = [
        item
        for item in transactions
        if item.status == "actual"
        and baseline_start <= item.transaction_date <= as_of
        and item.category not in {"Financing", "Capital Expenditure", "Tax"}
    ]
    inflow = sum(item.amount for item in recurring if item.direction == "inflow") / 8
    outflow = sum(item.amount for item in recurring if item.direction == "outflow") / 8
    return inflow, outflow


def _average_monthly_outflow(transactions: list[Transaction], as_of: date) -> float:
    start = as_of - timedelta(days=89)
    outflows = sum(
        item.amount
        for item in transactions
        if item.status == "actual" and item.direction == "outflow" and start <= item.transaction_date <= as_of
    )
    return round(outflows / 3, 2)


def _liquidity_status(minimum_cash: float, buffer: float, runway: float | None) -> str:
    if minimum_cash < 0:
        return "Critical"
    if minimum_cash < buffer or (runway is not None and runway < 3):
        return "Watch"
    return "Healthy"


def _collection_action(overdue_days: int, status: str, risk_score: float) -> str:
    if status == "disputed":
        return "Escalate dispute to account owner and finance lead"
    if overdue_days >= 60 or risk_score >= 0.6:
        return "Call customer and place account on credit hold"
    if overdue_days >= 30:
        return "Send final reminder and propose payment plan"
    if overdue_days > 0:
        return "Send personalized overdue reminder"
    return "Monitor until due date"