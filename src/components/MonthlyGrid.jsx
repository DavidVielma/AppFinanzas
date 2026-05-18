import { formatCurrency } from "../lib/finance";

export function MonthlyGrid({ summary, selectedMonth, onSelectMonth }) {
  return (
    <section className="month-grid" aria-label="Resumen anual por mes">
      {summary.monthly.map((item) => (
        <button
          type="button"
          key={item.month}
          className={`month-cell ${selectedMonth === item.month ? "active" : ""}`}
          onClick={() => onSelectMonth(item.month)}
        >
          <span>{item.label}</span>
          <strong>{formatCurrency(item.balance)}</strong>
          <small>{item.count} movimientos</small>
        </button>
      ))}
    </section>
  );
}
