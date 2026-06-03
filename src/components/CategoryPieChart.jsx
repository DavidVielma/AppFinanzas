import { useEffect, useState } from "react";
import { CategoryBadge } from "./CategoryVisuals";
import { formatCurrency, groupByCategory } from "../lib/finance";

const palette = ["#155e63", "#d97745", "#2f8f5b", "#2f6fb0", "#c2410c", "#7c3aed", "#0f766e", "#b45309", "#be123c", "#475569", "#94a3b8"];

function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians)
  };
}

function describeDonutSlice(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M", outerStart.x, outerStart.y,
    "A", outerRadius, outerRadius, 0, largeArcFlag, 0, outerEnd.x, outerEnd.y,
    "L", innerStart.x, innerStart.y,
    "A", innerRadius, innerRadius, 0, largeArcFlag, 1, innerEnd.x, innerEnd.y,
    "Z"
  ].join(" ");
}

export function CategoryPieChart({ movements, scopeLabel = "Mes actual" }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showAllMovements, setShowAllMovements] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const filteredMovements = movements.filter((movement) => {
    if (typeFilter === "income") return Number(movement.amount) > 0;
    if (typeFilter === "expense") return Number(movement.amount) < 0;
    return true;
  });
  const movementsByCategory = filteredMovements.reduce((acc, movement) => {
    const category = movement.category || "Sin categoria";
    acc[category] = acc[category] || [];
    acc[category].push(movement);
    return acc;
  }, {});
  const groups = Object.entries(groupByCategory(filteredMovements))
    .map(([category, value]) => ({ category, value, size: Math.abs(Number(value) || 0), movements: movementsByCategory[category] || [] }))
    .filter((item) => item.size > 0)
    .sort((a, b) => b.size - a.size);
  const top = groups.slice(0, 10);
  const other = groups.slice(10).reduce(
    (acc, item) => ({
      category: "Otras",
      value: acc.value + Number(item.value || 0),
      size: acc.size + item.size,
      movements: [...acc.movements, ...item.movements]
    }),
    { category: "Otras", value: 0, size: 0, movements: [] }
  );
  const slices = other.size ? [...top, other] : top;
  const selectedSlice = slices.find((item) => item.category === selectedCategory) || null;
  const total = slices.reduce((sum, item) => sum + item.size, 0);
  const selectedPercent = selectedSlice && total ? (selectedSlice.size / total) * 100 : 0;
  const selectedMovements = selectedSlice?.movements || [];
  const visibleMovements = showAllMovements ? selectedMovements : selectedMovements.slice(0, 8);

  useEffect(() => {
    setShowAllMovements(false);
  }, [selectedCategory, typeFilter]);

  useEffect(() => {
    setSelectedCategory(null);
  }, [typeFilter]);

  function selectSlice(category) {
    setSelectedCategory((current) => (current === category ? null : category));
  }

  let cursorAngle = 0;
  const sliceGeometry = slices.map((item, index) => {
    const angle = total ? (item.size / total) * 360 : 0;
    const startAngle = cursorAngle;
    const endAngle = cursorAngle + Math.min(angle, 359.999);
    const midAngle = startAngle + angle / 2;
    const outsideOffset = index % 2 === 0 ? 0 : 16;
    const insideLabelPoint = polarToCartesian(210, 210, 108, midAngle);
    const connectorStart = polarToCartesian(210, 210, 154, midAngle);
    const connectorEnd = polarToCartesian(210, 210, 176 + outsideOffset, midAngle);
    const outsideLabelPoint = polarToCartesian(210, 210, 198 + outsideOffset, midAngle);
    cursorAngle = endAngle;

    return {
      ...item,
      color: palette[index % palette.length],
      percent: total ? (item.size / total) * 100 : 0,
      path: describeDonutSlice(210, 210, 150, 68, startAngle, endAngle),
      insideLabelX: insideLabelPoint.x,
      insideLabelY: insideLabelPoint.y,
      connectorStartX: connectorStart.x,
      connectorStartY: connectorStart.y,
      connectorEndX: connectorEnd.x,
      connectorEndY: connectorEnd.y,
      outsideLabelX: outsideLabelPoint.x,
      outsideLabelY: outsideLabelPoint.y,
      labelOutside: total ? (item.size / total) * 100 < 8 : false
    };
  });

  return (
    <section className="pie-panel">
      <div className="pie-heading">
        <div>
          <h2>Categorias principales</h2>
          <p>Top 10 categorias y acumulado en Otras · {scopeLabel}</p>
        </div>
        <div className="pie-type-filter segmented compact-segmented" role="group" aria-label="Filtrar categorias por tipo">
          <button type="button" className={typeFilter === "all" ? "active" : ""} onClick={() => setTypeFilter("all")}>
            Todos
          </button>
          <button type="button" className={typeFilter === "income" ? "active" : ""} onClick={() => setTypeFilter("income")}>
            Ingresos
          </button>
          <button type="button" className={typeFilter === "expense" ? "active" : ""} onClick={() => setTypeFilter("expense")}>
            Egresos
          </button>
        </div>
      </div>
      <div className="pie-layout">
        <svg className="pie-chart" viewBox="0 0 420 420" role="img" aria-label="Grafica de torta por categorias">
          <circle cx="210" cy="210" r="150" fill="#edf1f5" />
          {sliceGeometry.map((item) => (
            <g
              className={`pie-slice ${selectedSlice?.category === item.category ? "active" : ""}`}
              key={item.category}
              onClick={() => selectSlice(item.category)}
              role="button"
              tabIndex="0"
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  selectSlice(item.category);
                }
              }}
            >
              <title>{`${item.category}: ${item.percent.toFixed(1)}%`}</title>
              <path d={item.path} fill={item.color} />
              {item.labelOutside && (
                <line className="pie-label-line" x1={item.connectorStartX} y1={item.connectorStartY} x2={item.connectorEndX} y2={item.connectorEndY} />
              )}
              <text
                className={item.labelOutside ? "pie-outside-label" : ""}
                x={item.labelOutside ? item.outsideLabelX : item.insideLabelX}
                y={item.labelOutside ? item.outsideLabelY : item.insideLabelY}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {item.percent.toFixed(0)}%
              </text>
            </g>
          ))}
          <circle cx="210" cy="210" r="66" fill="#fff" stroke="#dbe4e5" />
          <text className="pie-center-label" x="210" y="204" textAnchor="middle">
            {selectedSlice ? `${selectedPercent.toFixed(0)}%` : sliceGeometry.length}
          </text>
          <text className="pie-center-subtitle" x="210" y="226" textAnchor="middle">
            {selectedSlice ? "seleccionado" : "categorias"}
          </text>
        </svg>
        <div className="pie-legend">
          {sliceGeometry.map((item) => (
            <button
              type="button"
              className={selectedSlice?.category === item.category ? "active" : ""}
              key={item.category}
              onClick={() => selectSlice(item.category)}
              aria-pressed={selectedSlice?.category === item.category}
            >
              <i style={{ backgroundColor: item.color }} />
              <CategoryBadge category={item.category} compact />
              <em>{`${item.percent.toFixed(1)}%`}</em>
              <strong>{formatCurrency(item.value)}</strong>
            </button>
          ))}
          {!sliceGeometry.length && <p className="muted">No hay movimientos para este filtro.</p>}
        </div>
        {selectedSlice && (
          <div className="pie-detail">
            <div>
              <span>Categoria seleccionada</span>
              <button type="button" className="pie-clear-selection" onClick={() => setSelectedCategory(null)}>
                Limpiar
              </button>
            </div>
            <div>
              <span>Categoria</span>
              <CategoryBadge category={selectedSlice.category} />
            </div>
            <div>
              <span>Total</span>
              <strong>{formatCurrency(selectedSlice.value)}</strong>
            </div>
            <div>
              <span>Movimientos</span>
              <strong>{selectedMovements.length}</strong>
            </div>
            <div className="pie-detail-list">
              {visibleMovements.map((movement) => (
                <p key={movement.id}>
                  <span>{movement.description}</span>
                  <strong className={Number(movement.amount) >= 0 ? "income-text" : "expense-text"}>{formatCurrency(movement.amount)}</strong>
                </p>
              ))}
              {selectedMovements.length > 8 && (
                <button type="button" className="pie-more-button" onClick={() => setShowAllMovements((current) => !current)}>
                  {showAllMovements ? "Ver menos" : `+ ${selectedMovements.length - 8} movimientos mas`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
