import { useState } from "react";
import { formatCurrency } from "../lib/finance";

function getScale(summary) {
  const values = summary.monthly.flatMap((item) => [Math.abs(item.income), Math.abs(item.expenses), Math.abs(item.balance)]);
  return Math.max(...values, 1);
}

function getBalanceY(balance, max) {
  return 136 - (Number(balance || 0) / max) * 84;
}

export function AnnualFlowChart({ summary }) {
  const [tooltip, setTooltip] = useState(null);
  const max = getScale(summary);
  const zeroY = getBalanceY(0, max);

  return (
    <section className="evolution-card annual-flow-card">
      <header>
        <div>
          <h2>Grafica anual</h2>
          <p>Ingresos, egresos y balance mensual</p>
        </div>
      </header>
      <div className="annual-bars">
        <svg viewBox="0 0 780 280" role="img" aria-label="Grafica anual de ingresos egresos y balance">
          <line className="evolution-zero" x1="36" y1={zeroY} x2="754" y2={zeroY} />
          {[0, 1, 2, 3].map((line) => (
            <line className="evolution-grid" key={line} x1="36" y1={54 + line * 44} x2="754" y2={54 + line * 44} />
          ))}
          {summary.monthly.map((item, index) => {
            const groupX = 48 + index * 60;
            const incomeHeight = (Math.abs(item.income) / max) * 92;
            const expenseHeight = (Math.abs(item.expenses) / max) * 92;
            const balanceY = getBalanceY(item.balance, max);

            return (
              <g key={item.month}>
                <rect className="annual-bar-hit" x={groupX - 7} y="34" width="44" height="210" onMouseEnter={() => setTooltip({ ...item, x: groupX - 18, y: 26 })} onMouseLeave={() => setTooltip(null)} />
                <rect className="annual-income-bar" x={groupX} y={zeroY - incomeHeight} width="14" height={incomeHeight} rx="4" />
                <rect className="annual-expense-bar" x={groupX + 18} y={zeroY} width="14" height={expenseHeight} rx="4" />
                <circle className={item.balance >= 0 ? "annual-balance-dot income" : "annual-balance-dot expense"} cx={groupX + 16} cy={balanceY} r="5" />
                <text className={item.balance >= 0 ? "annual-balance-label income" : "annual-balance-label expense"} x={groupX + 16} y={Math.max(18, balanceY - 10)} textAnchor="middle">
                  {formatCurrency(item.balance)}
                </text>
                <text className="evolution-axis" x={groupX + 16} y="264" textAnchor="middle">
                  {item.label.slice(0, 3)}
                </text>
              </g>
            );
          })}
          {tooltip && (
            <g className="evolution-tooltip" transform={`translate(${Math.min(tooltip.x, 590)} ${tooltip.y})`}>
              <rect width="172" height="92" rx="8" />
              <text x="12" y="19">{tooltip.label}</text>
              <text x="12" y="40">Ingresos: {formatCurrency(tooltip.income)}</text>
              <text x="12" y="60">Egresos: {formatCurrency(tooltip.expenses)}</text>
              <text x="12" y="80">Balance: {formatCurrency(tooltip.balance)}</text>
            </g>
          )}
        </svg>
      </div>
      <div className="evolution-legend annual-flow-legend">
        <div>
          <i style={{ backgroundColor: "#2f8f5b" }} />
          <span>Ingresos</span>
          <strong className="income-text">{formatCurrency(summary.annualIncome)}</strong>
        </div>
        <div>
          <i style={{ backgroundColor: "#d97745" }} />
          <span>Egresos</span>
          <strong className="expense-text">{formatCurrency(summary.annualExpenses)}</strong>
        </div>
        <div>
          <i style={{ backgroundColor: "#155e63" }} />
          <span>Balance mensual</span>
          <strong>{formatCurrency(summary.annualBalance)}</strong>
        </div>
      </div>
    </section>
  );
}
