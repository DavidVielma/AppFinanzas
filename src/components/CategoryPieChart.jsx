import { useState } from "react";
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
  const movementsByCategory = movements.reduce((acc, movement) => {
    const category = movement.category || "Sin categoria";
    acc[category] = acc[category] || [];
    acc[category].push(movement);
    return acc;
  }, {});
  const groups = Object.entries(groupByCategory(movements))
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
  const selectedSlice = slices.find((item) => item.category === selectedCategory) || slices[0];
  const total = slices.reduce((sum, item) => sum + item.size, 0);
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
      </div>
      <div className="pie-layout">
        <svg className="pie-chart" viewBox="0 0 420 420" role="img" aria-label="Grafica de torta por categorias">
          <circle cx="210" cy="210" r="150" fill="#edf1f5" />
          {sliceGeometry.map((item) => (
            <g
              className={`pie-slice ${selectedSlice?.category === item.category ? "active" : ""}`}
              key={item.category}
              onClick={() => setSelectedCategory(item.category)}
              role="button"
              tabIndex="0"
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setSelectedCategory(item.category);
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
            {sliceGeometry.length}
          </text>
          <text className="pie-center-subtitle" x="210" y="226" textAnchor="middle">
            categorias
          </text>
        </svg>
        <div className="pie-legend">
          {sliceGeometry.map((item) => (
            <div key={item.category}>
              <i style={{ backgroundColor: item.color }} />
              <span>{item.category}</span>
              <em>{`${item.percent.toFixed(1)}%`}</em>
              <strong>{formatCurrency(item.value)}</strong>
            </div>
          ))}
          {!sliceGeometry.length && <p className="muted">Agrega movimientos para ver la torta por categoria.</p>}
        </div>
        {selectedSlice && (
          <div className="pie-detail">
            <div>
              <span>Categoria seleccionada</span>
              <strong>{selectedSlice.category}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatCurrency(selectedSlice.value)}</strong>
            </div>
            <div className="pie-detail-list">
              {selectedSlice.movements.slice(0, 8).map((movement) => (
                <p key={movement.id}>
                  <span>{movement.description}</span>
                  <strong className={Number(movement.amount) >= 0 ? "income-text" : "expense-text"}>{formatCurrency(movement.amount)}</strong>
                </p>
              ))}
              {selectedSlice.movements.length > 8 && <small>+ {selectedSlice.movements.length - 8} movimientos mas</small>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
