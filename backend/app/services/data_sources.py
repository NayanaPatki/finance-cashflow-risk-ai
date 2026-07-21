from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.services.analytics import analysis_date, load_assumptions, load_invoices, load_transactions

TRANSACTION_FIELDS = (
    "transaction_id",
    "transaction_date",
    "account",
    "direction",
    "category",
    "counterparty",
    "amount",
    "status",
    "description",
)
INVOICE_FIELDS = (
    "invoice_id",
    "customer",
    "issue_date",
    "due_date",
    "amount",
    "amount_paid",
    "payment_date",
    "status",
)
MAX_BYTES = 5_000_000


class DataSourceError(ValueError):
    pass


def project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def sample_paths() -> tuple[Path, Path, Path]:
    root = project_root() / "data" / "sample"
    return root / "transactions.csv", root / "invoices.csv", root / "assumptions.csv"


def active_paths() -> tuple[Path, Path, Path]:
    root = project_root() / "data" / "raw"
    return root / "transactions.csv", root / "invoices.csv", root / "assumptions.csv"


def metadata_path() -> Path:
    return project_root() / "data" / "raw" / "source_metadata.json"


def resolved_paths() -> tuple[Path, Path, Path]:
    active = active_paths()
    return active if all(path.exists() for path in active) else sample_paths()


def load_active_data():
    transaction_path, invoice_path, assumption_path = resolved_paths()
    return (
        load_transactions(transaction_path),
        load_invoices(invoice_path),
        load_assumptions(assumption_path),
    )


def import_data_bundle(
    transactions_csv: str,
    invoices_csv: str,
    transactions_file_name: str,
    invoices_file_name: str,
    opening_cash: float,
    minimum_cash_buffer: float,
) -> dict[str, Any]:
    _validate_csv_shape(transactions_csv, TRANSACTION_FIELDS, "transactions")
    _validate_csv_shape(invoices_csv, INVOICE_FIELDS, "invoices")
    if len(transactions_csv.encode("utf-8")) > MAX_BYTES or len(invoices_csv.encode("utf-8")) > MAX_BYTES:
        raise DataSourceError("Each CSV must be 5 MB or smaller.")

    transaction_path, invoice_path, assumption_path = active_paths()
    transaction_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_transaction = transaction_path.with_suffix(".tmp")
    temporary_invoice = invoice_path.with_suffix(".tmp")
    temporary_assumption = assumption_path.with_suffix(".tmp")
    temporary_transaction.write_text(transactions_csv.lstrip("\ufeff"), encoding="utf-8", newline="")
    temporary_invoice.write_text(invoices_csv.lstrip("\ufeff"), encoding="utf-8", newline="")
    assumption_text = (
        "assumption,value,unit,description\n"
        f"opening_cash,{opening_cash},USD,Imported opening cash balance\n"
        f"minimum_cash_buffer,{minimum_cash_buffer},USD,Imported minimum liquidity threshold\n"
        "forecast_weeks,13,weeks,Rolling cash forecast horizon\n"
    )
    temporary_assumption.write_text(assumption_text, encoding="utf-8", newline="")

    try:
        transactions = load_transactions(temporary_transaction)
        invoices = load_invoices(temporary_invoice)
        load_assumptions(temporary_assumption)
        if not transactions or not invoices:
            raise DataSourceError("Both files must contain at least one data row.")
        analysis_date(transactions)
    except (KeyError, TypeError, ValueError) as exc:
        temporary_transaction.unlink(missing_ok=True)
        temporary_invoice.unlink(missing_ok=True)
        temporary_assumption.unlink(missing_ok=True)
        raise DataSourceError(str(exc)) from exc

    temporary_transaction.replace(transaction_path)
    temporary_invoice.replace(invoice_path)
    temporary_assumption.replace(assumption_path)
    imported_at = datetime.now(timezone.utc).isoformat()
    metadata = {
        "source_type": "csv",
        "source_label": f"{_safe_name(transactions_file_name)} + {_safe_name(invoices_file_name)}",
        "imported_at": imported_at,
    }
    metadata_path().write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return get_data_source_status()


def get_data_source_status() -> dict[str, Any]:
    transactions, invoices, assumptions = load_active_data()
    using_active = all(path.exists() for path in active_paths())
    metadata: dict[str, Any] = {}
    if using_active and metadata_path().exists():
        try:
            metadata = json.loads(metadata_path().read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            metadata = {}
    return {
        "source_type": str(metadata.get("source_type", "demo")),
        "source_label": str(metadata.get("source_label", "Bundled finance sample data")),
        "transaction_rows": len(transactions),
        "invoice_rows": len(invoices),
        "as_of_date": analysis_date(transactions),
        "opening_cash": assumptions.opening_cash,
        "minimum_cash_buffer": assumptions.minimum_cash_buffer,
        "imported_at": metadata.get("imported_at"),
    }


def reset_data_source() -> dict[str, Any]:
    for path in (*active_paths(), metadata_path()):
        path.unlink(missing_ok=True)
    return get_data_source_status()


def _validate_csv_shape(csv_text: str, required: tuple[str, ...], label: str) -> None:
    reader = csv.DictReader(io.StringIO(csv_text.lstrip("\ufeff")))
    fields = [field.strip() for field in (reader.fieldnames or [])]
    missing = [field for field in required if field not in fields]
    if missing:
        raise DataSourceError(f"The {label} CSV is missing: {', '.join(missing)}")


def _safe_name(file_name: str) -> str:
    return Path(file_name.replace("\\", "/")).name[:120]