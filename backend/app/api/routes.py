from fastapi import APIRouter, HTTPException

from app.schemas import (
    DataBundleRequest,
    DataSourceStatus,
    ExpenseAnomaly,
    FinanceSummary,
    ForecastWeek,
    ReceivableRisk,
    ScenarioRequest,
    ScenarioResult,
)
from app.services.analytics import (
    analysis_date,
    build_cash_forecast,
    build_receivables_risk,
    build_scenario_result,
    detect_expense_anomalies,
    summarize_finance,
)
from app.services.data_sources import (
    DataSourceError,
    get_data_source_status,
    import_data_bundle,
    load_active_data,
    reset_data_source,
)

router = APIRouter()


@router.get("/summary", response_model=FinanceSummary, tags=["finance analytics"])
def get_summary() -> FinanceSummary:
    transactions, invoices, assumptions = load_active_data()
    return summarize_finance(transactions, invoices, assumptions)


@router.get("/forecast", response_model=list[ForecastWeek], tags=["finance analytics"])
def get_forecast() -> list[ForecastWeek]:
    transactions, invoices, assumptions = load_active_data()
    return build_cash_forecast(transactions, invoices, assumptions)


@router.get("/receivables", response_model=list[ReceivableRisk], tags=["finance analytics"])
def get_receivables() -> list[ReceivableRisk]:
    transactions, invoices, _ = load_active_data()
    return build_receivables_risk(invoices, analysis_date(transactions))


@router.get("/anomalies", response_model=list[ExpenseAnomaly], tags=["finance analytics"])
def get_anomalies() -> list[ExpenseAnomaly]:
    transactions, _, _ = load_active_data()
    return detect_expense_anomalies(transactions)


@router.post("/scenario", response_model=ScenarioResult, tags=["finance analytics"])
def run_scenario(request: ScenarioRequest) -> ScenarioResult:
    transactions, invoices, assumptions = load_active_data()
    return build_scenario_result(
        transactions,
        invoices,
        assumptions,
        request.revenue_change_pct,
        request.expense_change_pct,
        request.collection_delay_days,
        request.one_time_outflow,
    )


@router.get("/data-source", response_model=DataSourceStatus, tags=["data sources"])
def data_source_status() -> DataSourceStatus:
    return get_data_source_status()


@router.post("/data-source", response_model=DataSourceStatus, tags=["data sources"])
def upload_data_bundle(request: DataBundleRequest) -> DataSourceStatus:
    try:
        return import_data_bundle(
            request.transactions_csv,
            request.invoices_csv,
            request.transactions_file_name,
            request.invoices_file_name,
            request.opening_cash,
            request.minimum_cash_buffer,
        )
    except DataSourceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/data-source", response_model=DataSourceStatus, tags=["data sources"])
def use_demo_data() -> DataSourceStatus:
    return reset_data_source()