from pathlib import Path

import pytest

from app.services.data_sources import DataSourceError, _validate_csv_shape


def test_transaction_schema_rejects_missing_fields():
    with pytest.raises(DataSourceError, match="missing"):
        _validate_csv_shape("transaction_id,amount\nTX-1,100\n", ("transaction_id", "direction", "amount"), "transactions")


def test_finance_template_exists_and_is_nonempty():
    root = Path(__file__).resolve().parents[2]
    template = root / "data" / "templates" / "finance_input_template.xlsx"

    assert template.exists()
    assert template.stat().st_size > 10_000