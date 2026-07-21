import type { ForecastWeek } from "../lib/sampleData";

const compactCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 0 });

export function CashForecastChart({ forecast, buffer }: { forecast: ForecastWeek[]; buffer: number }) {
  const width = 820;
  const height = 260;
  const padding = { top: 18, right: 20, bottom: 42, left: 64 };
  const values = forecast.flatMap((week) => [week.ending_cash, buffer]);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const range = Math.max(maxValue - minValue, 1);
  const x = (index: number) => padding.left + (index / Math.max(forecast.length - 1, 1)) * (width - padding.left - padding.right);
  const y = (value: number) => padding.top + ((maxValue - value) / range) * (height - padding.top - padding.bottom);
  const points = forecast.map((week, index) => `${x(index)},${y(week.ending_cash)}`).join(" ");
  const areaPoints = `${padding.left},${height - padding.bottom} ${points} ${x(forecast.length - 1)},${height - padding.bottom}`;
  const yTicks = [minValue, minValue + range / 2, maxValue];

  return (
    <div className="chart-wrap" aria-label="13-week ending cash forecast chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="cash-chart-title cash-chart-desc">
        <title id="cash-chart-title">13-week ending cash forecast</title>
        <desc id="cash-chart-desc">Ending cash by week compared with the minimum cash buffer.</desc>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
            <text x={padding.left - 10} y={y(tick) + 4} textAnchor="end" className="chart-label">{compactCurrency.format(tick)}</text>
          </g>
        ))}
        <line x1={padding.left} x2={width - padding.right} y1={y(buffer)} y2={y(buffer)} className="buffer-line" />
        <text x={width - padding.right} y={y(buffer) - 7} textAnchor="end" className="buffer-label">Minimum buffer</text>
        <polygon points={areaPoints} className="chart-area" />
        <polyline points={points} className="chart-line" />
        {forecast.map((week, index) => (
          <g key={week.week_number}>
            <circle cx={x(index)} cy={y(week.ending_cash)} r="4" className={week.below_buffer ? "chart-point danger" : "chart-point"} />
            {(index === 0 || index === forecast.length - 1 || index % 2 === 1) && (
              <text x={x(index)} y={height - 16} textAnchor="middle" className="chart-label">W{week.week_number}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}