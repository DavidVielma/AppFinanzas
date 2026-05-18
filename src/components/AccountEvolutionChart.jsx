import { useState } from "react";
import { calculateAccountLedger, formatCurrency, monthLabels } from "../lib/finance";

const palette = ["#155e63", "#d97745", "#2f8f5b", "#2f6fb0", "#7c3aed", "#be123c", "#475569", "#0f766e"];

function buildScale(series) {
  const values = series.flatMap((item) => item.points.map((point) => point.value));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  return { min, max, range };
}

function getPoint(monthIndex, value, scale) {
  const x = 48 + monthIndex * 64;
  const y = 236 - ((value - scale.min) / scale.range) * 184;
  return { x, y };
}

function buildPath(points, scale) {
  return points
    .map((point, index) => {
      const { x, y } = getPoint(index, point.value, scale);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function AccountEvolutionChart({ accounts, movements, year, accountFilter }) {
  const [tooltip, setTooltip] = useState(null);
  const chartAccounts = accounts
    .filter((account) => account.name !== "Otros" && account.type !== "tarjeta_credito" && (!accountFilter || account.name === accountFilter))
    .slice(0, accountFilter ? 1 : 6);

  const series = chartAccounts.map((account, index) => {
    const points = monthLabels.map((label, monthIndex) => {
      const ledger = calculateAccountLedger(movements, Number(year), monthIndex + 1, accounts);
      return {
        label,
        cumulative: Number(ledger.closing[account.name] || 0),
        monthly: Number(ledger.monthNet[account.name] || 0)
      };
    });

    return {
      account,
      color: palette[index % palette.length],
      points
    };
  });

  function renderChart(title, mode) {
    const modeSeries = series.map((item) => ({
      ...item,
      points: item.points.map((point) => ({ ...point, value: mode === "cumulative" ? point.cumulative : point.monthly }))
    }));
    const scale = buildScale(modeSeries);
    const zero = getPoint(0, 0, scale).y;
    const activeTooltip = tooltip?.mode === mode ? tooltip : null;
    const tooltipX = activeTooltip ? Math.min(Math.max(activeTooltip.x - 86, 44), 570) : 0;
    const tooltipY = activeTooltip ? Math.max(activeTooltip.y - 88, 12) : 0;

    return (
      <section className="evolution-card">
        <header>
          <div>
            <h2>{title}</h2>
            <p>{mode === "cumulative" ? "Saldo acumulado por cuenta" : "Movimiento neto mensual por cuenta"}</p>
          </div>
        </header>
        <div className="evolution-chart-wrap">
          <svg className="evolution-chart" viewBox="0 0 780 280" role="img" aria-label={title}>
            <line className="evolution-zero" x1="38" y1={zero} x2="754" y2={zero} />
            {[0, 1, 2, 3].map((line) => (
              <line className="evolution-grid" key={line} x1="38" y1={52 + line * 46} x2="754" y2={52 + line * 46} />
            ))}
            {monthLabels.map((label, index) => {
              const { x } = getPoint(index, 0, scale);
              return (
                <text className="evolution-axis" key={label} x={x} y="264" textAnchor="middle">
                  {label.slice(0, 3)}
                </text>
              );
            })}
            {modeSeries.map((item) => (
              <g key={item.account.name}>
                <path d={buildPath(item.points, scale)} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {item.points.map((point, index) => {
                  const { x, y } = getPoint(index, point.value, scale);
                  return (
                    <g key={`${item.account.name}-${point.label}`}>
                      <circle cx={x} cy={y} r="4" fill={item.color} />
                      <circle
                        className="evolution-hit-point"
                        cx={x}
                        cy={y}
                        r="12"
                        onMouseEnter={() => setTooltip({ mode, account: item.account.name, label: point.label, value: point.value, x, y, color: item.color })}
                        onMouseLeave={() => setTooltip(null)}
                        onFocus={() => setTooltip({ mode, account: item.account.name, label: point.label, value: point.value, x, y, color: item.color })}
                        onBlur={() => setTooltip(null)}
                        tabIndex="0"
                      />
                    </g>
                  );
                })}
              </g>
            ))}
            {activeTooltip && (
              <g className="evolution-tooltip" transform={`translate(${tooltipX} ${tooltipY})`}>
                <rect width="172" height="76" rx="8" />
                <circle cx="12" cy="16" r="4" fill={activeTooltip.color} />
                <text x="22" y="19">{activeTooltip.account}</text>
                <text x="12" y="40">{activeTooltip.label}</text>
                <text x="12" y="62">{formatCurrency(activeTooltip.value)}</text>
              </g>
            )}
          </svg>
        </div>
        <div className="evolution-legend">
          {modeSeries.map((item) => {
            const last = item.points[item.points.length - 1]?.value || 0;
            return (
              <div key={item.account.name}>
                <i style={{ backgroundColor: item.color }} />
                <span>{item.account.name}</span>
                <strong className={last >= 0 ? "income-text" : "expense-text"}>{formatCurrency(last)}</strong>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="evolution-grid-panel">
      {renderChart("Evolucion acumulada de cuentas", "cumulative")}
      {renderChart("Evolucion mensual de cuentas", "monthly")}
    </div>
  );
}
