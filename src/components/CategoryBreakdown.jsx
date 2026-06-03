import { CategoryBadge } from "./CategoryVisuals";
import { formatCurrency, groupByCategory } from "../lib/finance";

export function CategoryBreakdown({ movements }) {
  const groups = Object.entries(groupByCategory(movements)).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const max = Math.max(...groups.map(([, value]) => Math.abs(value)), 1);

  return (
    <section className="breakdown">
      <h2>Categorias del mes</h2>
      {groups.map(([category, value]) => (
        <div className="bar-row" key={category}>
          <div className="bar-label">
            <CategoryBadge category={category} />
            <strong>{formatCurrency(value)}</strong>
          </div>
          <div className="bar-track">
            <div className={value >= 0 ? "bar income" : "bar expense"} style={{ width: `${(Math.abs(value) / max) * 100}%` }} />
          </div>
        </div>
      ))}
      {groups.length === 0 && <p className="muted">Agrega movimientos para ver el detalle por categoria.</p>}
    </section>
  );
}
