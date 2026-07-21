# Architecture

```mermaid
flowchart LR
    A[Bank and ERP CSV exports] --> B[FastAPI validation]
    B --> C[Active finance dataset]
    C --> D[Cash forecast engine]
    C --> E[Receivables risk engine]
    C --> F[Expense anomaly engine]
    D --> G[Scenario service]
    D --> H[React CFO workspace]
    E --> H
    F --> H
    C --> I[Power BI semantic model]
    J[GitHub Actions] --> K[Python tests and Ruff]
    J --> L[Frontend production build]
```

## Ownership Boundaries

- `services/analytics.py` owns deterministic finance calculations.
- `services/data_sources.py` owns input validation and active dataset persistence.
- `api/routes.py` maps typed contracts to service calls.
- React components own presentation and user interactions only.
- Power BI assets define an independent executive reporting layer.

## Production Evolution

Replace local CSV persistence with object storage plus PostgreSQL metadata. Run ingestion and forecasting as background jobs, store scenario versions, add SSO/RBAC, and publish model health/forecast accuracy telemetry.