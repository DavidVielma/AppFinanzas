import { CategoryBadge } from "./CategoryVisuals";
import { formatCurrency, groupByCategory } from "../lib/finance";

function CategoryGroup({ title, movements, variant, activeCategory, onSelectCategory }) {
  const groups = Object.entries(groupByCategory(movements)).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const max = Math.max(...groups.map(([, value]) => Math.abs(value)), 1);
  const total = movements.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="breakdown-group">
      <div className="breakdown-group-heading">
        <span>{title}</span>
        <strong className={variant === "income" ? "income-text" : "expense-text"}>{formatCurrency(total)}</strong>
      </div>
      {groups.map(([category, value]) => (
        <button
          type="button"
          className={`bar-row bar-row-clickable ${activeCategory === category ? "is-active" : ""}`}
          key={category}
          onClick={() => onSelectCategory?.(category)}
        >
          <div className="bar-label">
            <CategoryBadge category={category} />
            <strong>{formatCurrency(value)}</strong>
          </div>
          <div className="bar-track">
            <div className={variant === "income" ? "bar income" : "bar expense"} style={{ width: `${(Math.abs(value) / max) * 100}%` }} />
          </div>
        </button>
      ))}
      {groups.length === 0 && <p className="muted">Sin movimientos.</p>}
    </div>
  );
}

export function CategoryBreakdown({ movements, activeCategory, onSelectCategory }) {
  const incomeMovements = movements.filter((item) => item.type === "Ingreso");
  const expenseMovements = movements.filter((item) => item.type === "Egreso");

  return (
    <section className="breakdown">
      <h2>Categorias del mes</h2>
      {movements.length === 0 ? (
        <p className="muted">Agrega movimientos para ver el detalle por categoria.</p>
      ) : (
        <>
          <CategoryGroup title="Ingresos" movements={incomeMovements} variant="income" activeCategory={activeCategory} onSelectCategory={onSelectCategory} />
          <CategoryGroup title="Egresos" movements={expenseMovements} variant="expense" activeCategory={activeCategory} onSelectCategory={onSelectCategory} />
        </>
      )}
    </section>
  );
}
