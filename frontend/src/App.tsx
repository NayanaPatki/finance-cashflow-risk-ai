import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CircleDollarSign,
  Database,
  FileWarning,
  Gauge,
  LineChart,
  Play,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import { CashForecastChart } from "./components/CashForecastChart";
import { FinanceDataSources } from "./components/FinanceDataSources";
import {
  fallbackAnomalies,
  fallbackForecast,
  fallbackReceivables,
  fallbackScenario,
  fallbackSource,
  fallbackSummary,
  type DataSourceStatus,
  type ExpenseAnomaly,
  type FinanceSummary,
  type ForecastWeek,
  type ReceivableRisk,
  type ScenarioInput,
  type ScenarioResult,
} from "./lib/sampleData";

type ViewId = "overview" | "forecast" | "receivables" | "anomalies" | "scenario" | "data";
type NavItem = { id: ViewId; label: string; title: string; subtitle: string; icon: ComponentType<{ size?: number }> };

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";
const navItems: NavItem[] = [
  { id: "overview", label: "Executive overview", title: "Cash Control Center", subtitle: "Liquidity, working capital, and financial risk", icon: Gauge },
  { id: "forecast", label: "13-week forecast", title: "13-Week Cash Forecast", subtitle: "Weekly cash roll-forward and buffer monitoring", icon: LineChart },
  { id: "receivables", label: "Receivables risk", title: "Receivables Risk", subtitle: "Collections priority and customer exposure", icon: ReceiptText },
  { id: "anomalies", label: "Expense anomalies", title: "Expense Anomalies", subtitle: "Unusual outflows requiring finance review", icon: FileWarning },
  { id: "scenario", label: "Scenario planner", title: "Scenario Planner", subtitle: "Stress-test liquidity before decisions are made", icon: SlidersHorizontal },
  { id: "data", label: "Finance data", title: "Finance Data", subtitle: "Validated bank and ERP input workflow", icon: Database },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

function App() {
  const [view, setView] = useState<ViewId>("overview");
  const [summary, setSummary] = useState<FinanceSummary>(fallbackSummary);
  const [forecast, setForecast] = useState<ForecastWeek[]>(fallbackForecast);
  const [receivables, setReceivables] = useState<ReceivableRisk[]>(fallbackReceivables);
  const [anomalies, setAnomalies] = useState<ExpenseAnomaly[]>(fallbackAnomalies);
  const [source, setSource] = useState<DataSourceStatus>(fallbackSource);
  const [connection, setConnection] = useState<"loading" | "live" | "demo">("loading");
  const [refreshing, setRefreshing] = useState(false);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      const responses = await Promise.all([
        fetch(`${API_BASE_URL}/summary`),
        fetch(`${API_BASE_URL}/forecast`),
        fetch(`${API_BASE_URL}/receivables`),
        fetch(`${API_BASE_URL}/anomalies`),
        fetch(`${API_BASE_URL}/data-source`),
      ]);
      if (responses.some((response) => !response.ok)) throw new Error("Finance API request failed.");
      const [nextSummary, nextForecast, nextReceivables, nextAnomalies, nextSource] = await Promise.all([
        responses[0].json() as Promise<FinanceSummary>,
        responses[1].json() as Promise<ForecastWeek[]>,
        responses[2].json() as Promise<ReceivableRisk[]>,
        responses[3].json() as Promise<ExpenseAnomaly[]>,
        responses[4].json() as Promise<DataSourceStatus>,
      ]);
      setSummary(nextSummary);
      setForecast(nextForecast);
      setReceivables(nextReceivables);
      setAnomalies(nextAnomalies);
      setSource(nextSource);
      setConnection("live");
    } catch {
      setSummary(fallbackSummary);
      setForecast(fallbackForecast);
      setReceivables(fallbackReceivables);
      setAnomalies(fallbackAnomalies);
      setSource(fallbackSource);
      setConnection("demo");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void refreshData(); }, [refreshData]);
  const current = navItems.find((item) => item.id === view) ?? navItems[0];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand" aria-label="Finance Risk AI">FR</div>
        <nav aria-label="Finance dashboard views" role="tablist" aria-orientation="vertical">
          {navItems.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-button${view === item.id ? " active" : ""}`} type="button" role="tab" aria-selected={view === item.id} aria-label={item.label} title={item.label} onClick={() => setView(item.id)}><Icon size={19} /></button>;
          })}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">{current.subtitle}</p><h1>{current.title}</h1></div>
          <div className="topbar-actions">
            <span className={`connection ${connection}`}><Database size={15} />{connection === "live" ? "Live API" : connection === "demo" ? "Demo fallback" : "Connecting"}</span>
            <button className="refresh-button" type="button" onClick={() => void refreshData()} disabled={refreshing}><RefreshCw size={17} className={refreshing ? "spin" : ""} />{refreshing ? "Refreshing" : "Refresh"}</button>
          </div>
        </header>

        <div role="tabpanel" className="view-content">
          {view === "overview" && <Overview summary={summary} forecast={forecast} receivables={receivables} anomalies={anomalies} />}
          {view === "forecast" && <ForecastView summary={summary} forecast={forecast} />}
          {view === "receivables" && <ReceivablesView receivables={receivables} summary={summary} />}
          {view === "anomalies" && <AnomaliesView anomalies={anomalies} />}
          {view === "scenario" && <ScenarioPlanner summary={summary} />}
          {view === "data" && <FinanceDataSources status={source} apiBaseUrl={API_BASE_URL} onChanged={refreshData} />}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, note, tone = "blue" }: { label: string; value: string; note: string; tone?: string }) {
  return <article className="metric" data-tone={tone}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>;
}

function Overview({ summary, forecast, receivables, anomalies }: { summary: FinanceSummary; forecast: ForecastWeek[]; receivables: ReceivableRisk[]; anomalies: ExpenseAnomaly[] }) {
  const highestRisk = receivables[0];
  const totalInflow = forecast.reduce((sum, week) => sum + week.operating_inflow + week.receivable_collections + week.planned_inflow, 0);
  const totalOutflow = forecast.reduce((sum, week) => sum + week.operating_outflow + week.planned_outflow, 0);
  return <>
    <section className="kpi-grid" aria-label="Finance KPIs">
      <Metric label="Current cash" value={money.format(summary.current_cash)} note={`As of ${summary.as_of_date}`} tone="green" />
      <Metric label="30-day net cash flow" value={money.format(summary.net_cash_flow_30d)} note={summary.net_cash_flow_30d < 0 ? "Cash burn requires attention" : "Positive cash generation"} tone={summary.net_cash_flow_30d < 0 ? "red" : "green"} />
      <Metric label="Cash runway" value={summary.cash_runway_months === null ? "N/A" : `${summary.cash_runway_months} months`} note={`Minimum buffer ${money.format(summary.minimum_cash_buffer)}`} tone="amber" />
      <Metric label="Overdue receivables" value={money.format(summary.overdue_receivables)} note={`${percent.format(summary.overdue_receivables / Math.max(summary.open_receivables, 1))} of open AR`} tone="violet" />
    </section>

    <section className="overview-grid">
      <div className="panel chart-panel">
        <div className="panel-heading"><div><h2>13-Week Liquidity Outlook</h2><p>Projected ending cash against management buffer</p></div><StatusBadge status={summary.liquidity_status} /></div>
        <CashForecastChart forecast={forecast} buffer={summary.minimum_cash_buffer} />
      </div>
      <div className="panel bridge-panel">
        <div className="panel-heading"><div><h2>Forecast Cash Bridge</h2><p>Total modeled movement over 13 weeks</p></div><BarChart3 size={20} /></div>
        <div className="bridge-list">
          <div><span>Opening cash</span><strong>{money.format(summary.current_cash)}</strong></div>
          <div className="positive"><span>Forecast inflows</span><strong>+{money.format(totalInflow)}</strong></div>
          <div className="negative"><span>Forecast outflows</span><strong>-{money.format(totalOutflow)}</strong></div>
          <div className="total"><span>Ending cash</span><strong>{money.format(forecast[forecast.length - 1]?.ending_cash ?? 0)}</strong></div>
        </div>
      </div>
      <div className="panel action-panel">
        <div className="panel-heading"><div><h2>Finance Action Queue</h2><p>Highest-priority interventions</p></div><ShieldAlert size={20} /></div>
        <div className="action-list">
          {highestRisk && <article><span className="action-icon amber"><ReceiptText size={18} /></span><div><strong>Resolve {highestRisk.customer} AR risk</strong><p>{highestRisk.recommended_action}. Exposure: {money.format(highestRisk.balance)}.</p></div></article>}
          <article><span className="action-icon red"><AlertTriangle size={18} /></span><div><strong>Review {anomalies.length} expense anomalies</strong><p>{anomalies[0]?.category ?? "Expense"} is the largest exception at {anomalies[0]?.amount_multiple ?? 0}x its category median.</p></div></article>
          <article><span className="action-icon blue"><CalendarClock size={18} /></span><div><strong>Protect the cash buffer</strong><p>Current runway is {summary.cash_runway_months ?? "not available"} months despite the base forecast staying above buffer.</p></div></article>
        </div>
      </div>
    </section>
  </>;
}

function ForecastView({ summary, forecast }: { summary: FinanceSummary; forecast: ForecastWeek[] }) {
  const minimumWeek = [...forecast].sort((a, b) => a.ending_cash - b.ending_cash)[0];
  const negativeWeeks = forecast.filter((week) => week.net_cash_flow < 0).length;
  return <>
    <section className="compact-kpis">
      <Metric label="Minimum forecast cash" value={money.format(minimumWeek?.ending_cash ?? 0)} note={`Week ${minimumWeek?.week_number ?? "-"}`} tone="amber" />
      <Metric label="Ending cash" value={money.format(forecast[forecast.length - 1]?.ending_cash ?? 0)} note="Week 13 projected balance" tone="green" />
      <Metric label="Negative cash-flow weeks" value={String(negativeWeeks)} note="Weeks requiring funding attention" tone="red" />
    </section>
    <section className="panel chart-panel full"><div className="panel-heading"><div><h2>Weekly Cash Roll-Forward</h2><p>Opening balance plus modeled inflows and outflows</p></div><span className="as-of">As of {summary.as_of_date}</span></div><CashForecastChart forecast={forecast} buffer={summary.minimum_cash_buffer} /></section>
    <section className="panel table-panel"><div className="panel-heading"><div><h2>Forecast Detail</h2><p>13-week operating and scheduled cash movements</p></div></div><div className="table-scroll"><table><thead><tr><th>Week</th><th>Opening</th><th>Operating inflow</th><th>AR collections</th><th>Planned inflow</th><th>Operating outflow</th><th>Planned outflow</th><th>Net flow</th><th>Ending cash</th></tr></thead><tbody>{forecast.map((week) => <tr key={week.week_number} className={week.below_buffer ? "danger-row" : ""}><td><strong>W{week.week_number}</strong><small>{week.week_start}</small></td><td>{money.format(week.opening_cash)}</td><td>{money.format(week.operating_inflow)}</td><td>{money.format(week.receivable_collections)}</td><td>{money.format(week.planned_inflow)}</td><td>{money.format(week.operating_outflow)}</td><td>{money.format(week.planned_outflow)}</td><td className={week.net_cash_flow < 0 ? "negative-text" : "positive-text"}>{money.format(week.net_cash_flow)}</td><td><strong>{money.format(week.ending_cash)}</strong></td></tr>)}</tbody></table></div></section>
  </>;
}

function ReceivablesView({ receivables, summary }: { receivables: ReceivableRisk[]; summary: FinanceSummary }) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const visible = useMemo(() => receivables.filter((item) => (riskFilter === "All" || item.risk_band === riskFilter) && (!search || `${item.customer} ${item.invoice_id}`.toLowerCase().includes(search.toLowerCase()))), [receivables, riskFilter, search]);
  const highRisk = receivables.filter((item) => item.risk_band === "High" || item.risk_band === "Medium");
  return <>
    <section className="compact-kpis"><Metric label="Open receivables" value={money.format(summary.open_receivables)} note={`${receivables.length} unpaid invoices`} tone="blue" /><Metric label="Overdue balance" value={money.format(summary.overdue_receivables)} note="Past contractual due date" tone="amber" /><Metric label="Priority accounts" value={String(highRisk.length)} note="Medium or high risk" tone="red" /></section>
    <section className="panel table-panel"><div className="panel-heading table-heading"><div><h2>Collections Worklist</h2><p>{visible.length} {visible.length === 1 ? "invoice" : "invoices"} matching current filters</p></div><div className="table-tools"><label className="search-box"><Search size={16} /><span className="sr-only">Search receivables</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or invoice" /></label><label><span className="sr-only">Filter receivables by risk</span><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}><option>All</option><option>High</option><option>Medium</option><option>Low</option></select></label></div></div><div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Due date</th><th>Balance</th><th>Overdue</th><th>Risk</th><th>Recommended action</th></tr></thead><tbody>{visible.map((item) => <tr key={item.invoice_id}><td><strong>{item.invoice_id}</strong></td><td>{item.customer}</td><td>{item.due_date}</td><td>{money.format(item.balance)}</td><td>{item.overdue_days ? `${item.overdue_days} days` : "Current"}</td><td><span className={`risk-pill ${item.risk_band.toLowerCase()}`}>{item.risk_band} {percent.format(item.risk_score)}</span></td><td className="long-cell">{item.recommended_action}</td></tr>)}</tbody></table></div></section>
  </>;
}

function AnomaliesView({ anomalies }: { anomalies: ExpenseAnomaly[] }) {
  const total = anomalies.reduce((sum, item) => sum + item.amount, 0);
  return <>
    <section className="compact-kpis"><Metric label="Anomalies detected" value={String(anomalies.length)} note="Outflows outside category norms" tone="red" /><Metric label="Spend under review" value={money.format(total)} note="Total flagged transaction value" tone="amber" /><Metric label="Detection method" value="Median + MAD" note="Robust to skewed spend data" tone="violet" /></section>
    <section className="anomaly-grid">{anomalies.map((item) => <article className="panel anomaly-card" key={item.transaction_id}><div className="anomaly-top"><span className="anomaly-icon"><AlertTriangle size={19} /></span><span className={`risk-pill ${item.severity.toLowerCase()}`}>{item.severity}</span></div><div><span className="category-label">{item.category}</span><strong>{money.format(item.amount)}</strong><p>{item.counterparty} on {item.transaction_date}</p></div><div className="comparison"><span>Category median</span><strong>{money.format(item.category_median)}</strong><span>Variance signal</span><strong>{item.amount_multiple}x</strong></div><div className="review-note"><CircleDollarSign size={16} /><span>Verify approval, contract terms, and duplicate billing before close.</span></div></article>)}</section>
  </>;
}

function ScenarioPlanner({ summary }: { summary: FinanceSummary }) {
  const [inputs, setInputs] = useState<ScenarioInput>({ revenue_change_pct: -20, expense_change_pct: 12, collection_delay_days: 30, one_time_outflow: 50000 });
  const [result, setResult] = useState<ScenarioResult>(fallbackScenario);
  const [running, setRunning] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const runScenario = async () => {
    setRunning(true);
    try {
      const response = await fetch(`${API_BASE_URL}/scenario`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inputs) });
      if (!response.ok) throw new Error("Scenario request failed");
      setResult(await response.json() as ScenarioResult);
      setIsLive(true);
    } catch { setResult(fallbackScenario); setIsLive(false); }
    finally { setRunning(false); }
  };
  const update = (field: keyof ScenarioInput, value: number) => setInputs((current) => ({ ...current, [field]: value }));
  return <section className="scenario-layout">
    <aside className="panel assumption-panel"><div className="panel-heading"><div><h2>Scenario Assumptions</h2><p>Adjust operating and timing drivers</p></div><SlidersHorizontal size={20} /></div><div className="slider-list"><ScenarioSlider label="Revenue change" value={inputs.revenue_change_pct} min={-60} max={50} unit="%" onChange={(value) => update("revenue_change_pct", value)} /><ScenarioSlider label="Expense change" value={inputs.expense_change_pct} min={-30} max={60} unit="%" onChange={(value) => update("expense_change_pct", value)} /><ScenarioSlider label="Collection delay" value={inputs.collection_delay_days} min={0} max={90} unit=" days" onChange={(value) => update("collection_delay_days", value)} /><ScenarioSlider label="One-time outflow" value={inputs.one_time_outflow} min={0} max={250000} step={5000} unit=" USD" onChange={(value) => update("one_time_outflow", value)} /></div><button className="primary-button" type="button" onClick={() => void runScenario()} disabled={running}><Play size={17} />{running ? "Running" : "Run scenario"}</button></aside>
    <div className="scenario-results"><section className="compact-kpis scenario-kpis"><Metric label="Minimum cash" value={money.format(result.minimum_cash)} note={`Buffer ${money.format(summary.minimum_cash_buffer)}`} tone={result.minimum_cash < summary.minimum_cash_buffer ? "red" : "green"} /><Metric label="Ending cash" value={money.format(result.ending_cash)} note="Week 13 modeled balance" tone="blue" /><Metric label="Buffer breach" value={result.buffer_breach_week ? `Week ${result.buffer_breach_week}` : "No breach"} note={isLive ? "Live model result" : "Demo result"} tone={result.buffer_breach_week ? "red" : "green"} /></section><section className="panel chart-panel"><div className="panel-heading"><div><h2>Scenario Liquidity Curve</h2><p>Cash impact of changed drivers</p></div><StatusBadge status={result.liquidity_status} /></div><CashForecastChart forecast={result.forecast} buffer={summary.minimum_cash_buffer} /></section></div>
  </section>;
}

function ScenarioSlider({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  const display = unit === " USD" ? money.format(value) : `${value}${unit}`;
  return <label className="scenario-control"><span><strong>{label}</strong><output>{display}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

export default App;