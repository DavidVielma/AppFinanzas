import { useEffect, useRef } from "react";
import { formatCurrency } from "../lib/finance";

export function MonthlyGrid({ summary, selectedMonth, onSelectMonth }) {
  const gridRef = useRef(null);
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    const grid = gridRef.current;
    const active = grid?.querySelector(".month-cell.active");
    if (!grid || !active) return;

    const gridRect = grid.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const offset = activeRect.left - gridRect.left - (gridRect.width - activeRect.width) / 2;
    grid.scrollTo({ left: grid.scrollLeft + offset, behavior: hasCenteredRef.current ? "smooth" : "auto" });
    hasCenteredRef.current = true;
  }, [selectedMonth]);

  return (
    <section className="month-grid" aria-label="Resumen anual por mes" ref={gridRef}>
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
