from datetime import date
from pathlib import Path

from app.services.analytics import (
    analysis_date,
    build_cash_forecast,
    build_receivables_risk,
    build_scenario_result,
    current_cash,
    detect_expense_anomalies,
    load_assumptions,
    load_invoices,
    load_transactions,
    summarize_finance,
)

ROOT = Path(__file__).resolve().parents[2]
SAMPLE = ROOT / "data" / "sample"


def sample_data():
    return (
        load_transactions(SAMPLE / "transactions.csv"),
        load_invoices(SAMPLE / "invoices.csv"),
        load_assumptions(SAMPLE / "assumptions.csv"),
    )


def test_summary_reconciles_current_cash():
    transactions, invoices, assumptions = sample_data()
    summary = summarize_finance(transactions, invoices, assumptions)

    assert summary["current_cash"] == current_cash(transactions, assumptions)
    assert summary["overdue_receivables"] > 0
    assert summary["minimum_cash_buffer"] == assumptions.minimum_cash_buffer


def test_forecast_cash_roll_forward_reconciles_each_week():
    transactions, invoices, assumptions = sample_data()
    forecast = build_cash_forecast(transactions, invoices, assumptions)

    assert len(forecast) == 13
    for index, week in enumerate(forecast):
        assert round(week["opening_cash"] + week["net_cash_flow"], 2) == week["ending_cash"]
        if index:
            assert week["opening_cash"] == forecast[index - 1]["ending_cash"]


def test_stress_scenario_changes_liquidity_result():
    transactions, invoices, assumptions = sample_data()
    base = build_scenario_result(transactions, invoices, assumptions, 0, 0, 0, 0)
    stress = build_scenario_result(transactions, invoices, assumptions, -20, 12, 30, 50000)

    assert stress["minimum_cash"] < base["minimum_cash"]
    assert stress["buffer_breach_week"] is not None


def test_receivable_risk_and_expense_anomalies_are_explainable():
    transactions, invoices, _ = sample_data()
    receivables = build_receivables_risk(invoices, analysis_date(transactions))
    anomalies = detect_expense_anomalies(transactions)

    assert receivables[0]["recommended_action"]
    assert all(0 <= item["risk_score"] <= 1 for item in receivables)
    assert {item["category"] for item in anomalies} == {"Marketing", "Cloud & Software"}
    assert all(item["amount_multiple"] > 2 for item in anomalies)