# Model Card

## Purpose

Support short-term cash planning and finance triage for an illustrative growing business. The release emphasizes explainability and deterministic reconciliation rather than claiming a trained machine-learning model.

## Forecast Method

The 13-week forecast starts from reconciled current cash. Weekly operating inflows and outflows use trailing eight-week averages, excluding financing, capital expenditure, and tax categories. Scheduled transactions and open invoice collections are added by week. Scenario inputs modify the underlying drivers before each weekly cash roll-forward.

## Risk Methods

- Invoice risk combines overdue aging (60%), open-balance concentration (25%), and dispute status (15%).
- Expense anomalies use median absolute deviation within category and an amount-to-median fallback.
- Liquidity status compares forecast minimum cash with the management buffer and current runway.

## Limitations

- Point estimates do not represent probability distributions or confidence intervals.
- The baseline assumes recent operating behavior is representative.
- Collection timing follows invoice due dates plus the selected delay.
- Risk scores are prioritization heuristics, not credit decisions.
- Sample data is synthetic and must not be interpreted as a real company forecast.

## Monitoring Plan

A production release should track weekly cash forecast error, collection date error, anomaly review precision, false positives, scenario adoption, and manual overrides by finance users.