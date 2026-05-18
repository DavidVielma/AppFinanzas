import { useState } from "react";
import { formatCurrency, isInternalFlow, monthLabels } from "../lib/finance";

const palette = ["#2f8f5b", "#2f6fb0", "#d97745", "#7c3aed", "#be123c", "#475569"];

function getPoint(monthIndex, value, max) {
  const x = 48 + monthIndex * 64;
  const y = 230 - (value / (max || 1)) * 178;
  return { x, y };
}

function buildPath(points, max) {
  return points
    .map((point, index) => {
      const { x, y } = getPoint(index, point.value, max);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function CreditCardMonthlyChart({ accounts, movements, year }) {
  const [tooltip, setTooltip] = useState(null);
  const cards = accounts.filter((account) => account.type === "tarjeta_credito");
  const series = cards.map((card, index) => {
    const points = monthLabels.map((label, monthIndex) => {
      const value = movements
        .filter(
          (movement) =>
            Number(movement.year) === Number(year) &&
            Number(movement.month) === monthIndex + 1 &&
            movement.account === card.name &&
            !isInternalFlow(movement)
        )
        .reduce((sum, movement) => sum + Math.abs(Math.min(Number(movement.amount || 0), 0)), 0);

      return { label, value };
    });

    return {
      card,
      color: palette[index % palette.length],
      points
    };
  });
  const max = Math.max(...series.flatMap((item) => item.points.map((point) => point.value)), 1);
  const tooltipX = tooltip ? Math.min(Math.max(tooltip.x - 86, 44), 570) : 0;
  const tooltipY = tooltip ? Math.max(tooltip.y - 88, 12) : 0;

  return (
    <section className="evolution-card credit-card-chart-card">
      <header>
        <div>
          <h2>Gasto mensual en tarjetas</h2>
          <p>Total mensual consumido por tarjeta, sin pagos de tarjeta</p>
        </div>
      </header>
      <div className="evolution-chart-wrap">
        <svg className="evolution-chart" viewBox="0 0 780 280" role="img" aria-label="Gasto mensual en tarjetas">
          {[0, 1, 2, 3].map((line) => (
            <line className="evolution-grid" key={line} x1="38" y1={52 + line * 46} x2="754" y2={52 + line * 46} />
          ))}
          {monthLabels.map((label, index) => {
            const { x } = getPoint(index, 0, max);
            return (
              <text className="evolution-axis" key={label} x={x} y="264" textAnchor="middle">
                {label.slice(0, 3)}
              </text>
            );
          })}
          {series.map((item) => (
            <g key={item.card.name}>
              <path d={buildPath(item.points, max)} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {item.points.map((point, index) => {
                const { x, y } = getPoint(index, point.value, max);
                return (
                  <g key={`${item.card.name}-${point.label}`}>
                    <circle cx={x} cy={y} r="4" fill={item.color} />
                    <circle
                      className="evolution-hit-point"
                      cx={x}
                      cy={y}
                      r="12"
                      tabIndex="0"
                      onMouseEnter={() => setTooltip({ card: item.card.name, label: point.label, value: point.value, x, y, color: item.color })}
                      onMouseLeave={() => setTooltip(null)}
                      onFocus={() => setTooltip({ card: item.card.name, label: point.label, value: point.value, x, y, color: item.color })}
                      onBlur={() => setTooltip(null)}
                    />
                  </g>
                );
              })}
            </g>
          ))}
          {tooltip && (
            <g className="evolution-tooltip" transform={`translate(${tooltipX} ${tooltipY})`}>
              <rect width="172" height="76" rx="8" />
              <circle cx="12" cy="16" r="4" fill={tooltip.color} />
              <text x="22" y="19">{tooltip.card}</text>
              <text x="12" y="40">{tooltip.label}</text>
              <text x="12" y="62">{formatCurrency(tooltip.value)}</text>
            </g>
          )}
        </svg>
      </div>
      <div className="evolution-legend">
        {series.map((item) => {
          const total = item.points.reduce((sum, point) => sum + point.value, 0);
          return (
            <div key={item.card.name}>
              <i style={{ backgroundColor: item.color }} />
              <span>{item.card.name}</span>
              <strong className="expense-text">{formatCurrency(total)}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}
