export type FinanceSummary = {
  as_of_date: string;
  current_cash: number;
  net_cash_flow_30d: number;
  cash_runway_months: number | null;
  overdue_receivables: number;
  open_receivables: number;
  minimum_forecast_cash: number;
  minimum_cash_buffer: number;
  liquidity_status: string;
};

export type ForecastWeek = {
  week_number: number;
  week_start: string;
  week_end: string;
  opening_cash: number;
  operating_inflow: number;
  receivable_collections: number;
  planned_inflow: number;
  operating_outflow: number;
  planned_outflow: number;
  net_cash_flow: number;
  ending_cash: number;
  below_buffer: boolean;
};

export type ReceivableRisk = {
  invoice_id: string;
  customer: string;
  due_date: string;
  balance: number;
  overdue_days: number;
  risk_score: number;
  risk_band: string;
  recommended_action: string;
};

export type ExpenseAnomaly = {
  transaction_id: string;
  transaction_date: string;
  category: string;
  counterparty: string;
  amount: number;
  category_median: number;
  amount_multiple: number;
  severity: string;
  reason: string;
};

export type ScenarioInput = {
  revenue_change_pct: number;
  expense_change_pct: number;
  collection_delay_days: number;
  one_time_outflow: number;
};

export type ScenarioResult = {
  assumptions: ScenarioInput;
  forecast: ForecastWeek[];
  ending_cash: number;
  minimum_cash: number;
  buffer_breach_week: number | null;
  liquidity_status: string;
};

export type DataSourceStatus = {
  source_type: string;
  source_label: string;
  transaction_rows: number;
  invoice_rows: number;
  as_of_date: string;
  opening_cash: number;
  minimum_cash_buffer: number;
  imported_at: string | null;
};

export const fallbackSummary: FinanceSummary = {
  as_of_date: "2026-06-30",
  current_cash: 202200,
  net_cash_flow_30d: -18050,
  cash_runway_months: 1.1,
  overdue_receivables: 121000,
  open_receivables: 433000,
  minimum_forecast_cash: 289875,
  minimum_cash_buffer: 120000,
  liquidity_status: "Watch",
};

const forecastEndings = [289875, 333550, 310225, 355900, 358575, 271250, 296425, 299100, 271775, 299450, 302125, 326300, 328975];
export const fallbackForecast: ForecastWeek[] = forecastEndings.map((ending, index) => ({
  week_number: index + 1,
  week_start: `2026-${index < 5 ? "07" : index < 9 ? "08" : "09"}-${String(1 + (index * 7) % 28).padStart(2, "0")}`,
  week_end: `2026-${index < 5 ? "07" : index < 9 ? "08" : "09"}-${String(7 + (index * 7) % 28).padStart(2, "0")}`,
  opening_cash: index === 0 ? 202200 : forecastEndings[index - 1],
  operating_inflow: 43500,
  receivable_collections: index < 5 ? [85000, 41000, 0, 68000, 0][index] : 0,
  planned_inflow: index === 7 ? 25000 : 0,
  operating_outflow: 40825,
  planned_outflow: [0, 65000, 18000, 0, 0, 90000, 0, 0, 30000, 0, 0, 0, 0][index],
  net_cash_flow: ending - (index === 0 ? 202200 : forecastEndings[index - 1]),
  ending_cash: ending,
  below_buffer: ending < 120000,
}));

export const fallbackReceivables: ReceivableRisk[] = [
  { invoice_id: "INV-1004", customer: "Vertex Labs", due_date: "2026-06-07", balance: 38000, overdue_days: 23, risk_score: 0.33, risk_band: "Medium", recommended_action: "Escalate dispute to account owner and finance lead" },
  { invoice_id: "INV-1003", customer: "BluePeak Foods", due_date: "2026-05-31", balance: 41000, overdue_days: 30, risk_score: 0.22, risk_band: "Low", recommended_action: "Send final reminder and propose payment plan" },
  { invoice_id: "INV-1005", customer: "Northstar Retail", due_date: "2026-06-17", balance: 42000, overdue_days: 13, risk_score: 0.11, risk_band: "Low", recommended_action: "Send personalized overdue reminder" },
  { invoice_id: "INV-1010", customer: "Northstar Retail", due_date: "2026-07-20", balance: 68000, overdue_days: 0, risk_score: 0.04, risk_band: "Low", recommended_action: "Monitor until due date" },
];

export const fallbackAnomalies: ExpenseAnomaly[] = [
  { transaction_id: "TX-0053", transaction_date: "2026-06-09", category: "Marketing", counterparty: "Growth Media", amount: 24000, category_median: 4300, amount_multiple: 5.6, severity: "High", reason: "5.6x the category median" },
  { transaction_id: "TX-0046", transaction_date: "2026-06-01", category: "Cloud & Software", counterparty: "CloudStack", amount: 15000, category_median: 2900, amount_multiple: 5.2, severity: "High", reason: "5.2x the category median" },
];

export const fallbackSource: DataSourceStatus = {
  source_type: "demo",
  source_label: "Bundled finance sample data",
  transaction_rows: 78,
  invoice_rows: 12,
  as_of_date: "2026-06-30",
  opening_cash: 180000,
  minimum_cash_buffer: 120000,
  imported_at: null,
};

export const fallbackScenario: ScenarioResult = {
  assumptions: { revenue_change_pct: -20, expense_change_pct: 12, collection_delay_days: 30, one_time_outflow: 50000 },
  forecast: fallbackForecast.map((week, index) => ({ ...week, ending_cash: Math.max(105504, week.ending_cash - 50000 - index * 9000), below_buffer: week.ending_cash - 50000 - index * 9000 < 120000 })),
  ending_cash: 170504,
  minimum_cash: 105504,
  buffer_breach_week: 4,
  liquidity_status: "Watch",
};