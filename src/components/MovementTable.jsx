import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "../lib/finance";

function getStatusClass(status) {
  if (status === "Confirmado") return "confirmed";
  if (status === "Pendiente") return "pending";
  return "projected";
}

function getCategoryClass(category) {
  return category === "Sin definir" ? "undefined-category" : "";
}

function formatResponsibles(value, currentResponsible) {
  const raw = String(value || "").trim();
  if (!raw) return "Yo";

  const displayName = (name) => name === currentResponsible || String(name).toLowerCase() === "yo" ? "Yo" : name;

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const names = JSON.parse(raw);
      if (Array.isArray(names)) return names.map(displayName).join(", ");
    } catch {
      return raw;
    }
  }

  return raw.split(",").map((name) => displayName(name.trim())).join(", ");
}

export function MovementTable({ movements, currentResponsible, onEdit, onDelete, onStatusChange, onMove }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Descripcion</th>
            <th>Cuenta</th>
            <th>Tipo</th>
            <th>Categoria</th>
            <th>Resp.</th>
            <th>Estado</th>
            <th className="amount-col">Monto</th>
            <th className="actions-col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.row_key || movement.id}>
              <td data-label="Descripcion" className="description-cell" title={movement.description}>
                {movement.description}
                {movement.recurring_id && <span className="recurring-badge">Recurrente</span>}
              </td>
              <td data-label="Cuenta" className="account-cell" title={`${movement.account || "Principal"}${movement.target_account ? ` -> ${movement.target_account}` : ""}`}>
                {movement.account || "Principal"}
                {movement.target_account ? ` -> ${movement.target_account}` : ""}
              </td>
              <td data-label="Tipo">
                <span className={`pill ${movement.type === "Ingreso" ? "income" : "expense"}`}>{movement.type}</span>
              </td>
              <td data-label="Categoria" className={getCategoryClass(movement.category)}>{movement.category}</td>
              <td data-label="Responsables" title={formatResponsibles(movement.responsible, currentResponsible)}>{formatResponsibles(movement.responsible, currentResponsible)}</td>
              <td data-label="Estado">
                <select
                  className={`status-select ${getStatusClass(movement.status)}`}
                  value={movement.status}
                  onChange={(event) => onStatusChange(movement.source_movement || movement, event.target.value)}
                  aria-label={`Estado de ${movement.description}`}
                >
                  <option>Confirmado</option>
                  <option>Proyectado</option>
                  <option>Pendiente</option>
                </select>
              </td>
              <td data-label="Monto" className={`amount-col ${movement.amount >= 0 ? "income-text" : "expense-text"}`}>{formatCurrency(movement.amount)}</td>
              <td data-label="Acciones" className="actions-col">
                <button type="button" className="icon-button" onClick={() => onMove(movement, -1)} disabled={!movement.canMoveUp} aria-label="Subir movimiento">
                  <ArrowUp size={14} />
                </button>
                <button type="button" className="icon-button" onClick={() => onMove(movement, 1)} disabled={!movement.canMoveDown} aria-label="Bajar movimiento">
                  <ArrowDown size={14} />
                </button>
                <button type="button" className="icon-button" onClick={() => onEdit(movement.source_movement || movement)} aria-label="Editar movimiento">
                  <Pencil size={16} />
                </button>
                <button type="button" className="icon-button danger" onClick={() => onDelete(movement.source_movement?.id || movement.id)} aria-label="Eliminar movimiento">
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
          {movements.length === 0 && (
            <tr>
              <td colSpan="8" className="empty-row">
                Sin movimientos para este mes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="mobile-movement-list">
        {movements.map((movement) => {
          const accountText = `${movement.account || "Principal"}${movement.target_account ? ` -> ${movement.target_account}` : ""}`;
          return (
            <article className="mobile-movement-card" key={movement.row_key ? `${movement.row_key}-mobile` : `${movement.id}-mobile`}>
              <header>
                <div>
                  <strong>{movement.description}</strong>
                  {movement.recurring_id && <span className="recurring-badge">Recurrente</span>}
                  <span>{accountText}</span>
                </div>
                <b className={movement.amount >= 0 ? "income-text" : "expense-text"}>{formatCurrency(movement.amount)}</b>
              </header>
              <div className="mobile-movement-meta">
                <span className={`pill ${movement.type === "Ingreso" ? "income" : "expense"}`}>{movement.type}</span>
                <span className={getCategoryClass(movement.category)}>{movement.category}</span>
                <span>{formatResponsibles(movement.responsible, currentResponsible)}</span>
              </div>
              <footer>
                <select
                  className={`status-select ${getStatusClass(movement.status)}`}
                  value={movement.status}
                  onChange={(event) => onStatusChange(movement.source_movement || movement, event.target.value)}
                  aria-label={`Estado de ${movement.description}`}
                >
                  <option>Confirmado</option>
                  <option>Proyectado</option>
                  <option>Pendiente</option>
                </select>
                <div className="mobile-card-actions">
                  <button type="button" className="icon-button" onClick={() => onMove(movement, -1)} disabled={!movement.canMoveUp} aria-label="Subir movimiento">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" className="icon-button" onClick={() => onMove(movement, 1)} disabled={!movement.canMoveDown} aria-label="Bajar movimiento">
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" className="icon-button" onClick={() => onEdit(movement.source_movement || movement)} aria-label="Editar movimiento">
                    <Pencil size={16} />
                  </button>
                  <button type="button" className="icon-button danger" onClick={() => onDelete(movement.source_movement?.id || movement.id)} aria-label="Eliminar movimiento">
                    <Trash2 size={16} />
                  </button>
                </div>
              </footer>
            </article>
          );
        })}
        {movements.length === 0 && <p className="empty-row">Sin movimientos para este mes.</p>}
      </div>
    </div>
  );
}
