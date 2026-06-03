import { ArrowDown, ArrowUp, FileSearch, Pencil, Trash2 } from "lucide-react";
import { CategoryBadge } from "./CategoryVisuals";
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

function getTcSummaryLink(movement) {
  const description = String(movement?.source_movement?.description || movement?.description || "");
  if (!description.startsWith("TC ")) return null;
  const separator = description.lastIndexOf(" - ");
  if (separator <= 3) return null;
  return {
    importName: description.slice(3, separator).trim(),
    userLabel: description.slice(separator + 3).trim()
  };
}

function getPaymentBadge(movement) {
  if (movement.flow !== "Pago Tarjeta") return null;
  return movement.payment_badge || (movement.card_payment_mode === "manual" ? "Parcial" : "Total");
}

function getPaymentBadgeMode(movement) {
  if (movement.flow !== "Pago Tarjeta") return null;
  return movement.payment_badge_mode || (movement.card_payment_mode === "manual" ? "manual" : "auto");
}

export function MovementTable({ movements, currentResponsible, onEdit, onDelete, onStatusChange, onMove, onOpenTcDetail }) {
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
          {movements.map((movement) => {
            const tcLink = getTcSummaryLink(movement);
            const paymentBadge = getPaymentBadge(movement);
            const paymentBadgeMode = getPaymentBadgeMode(movement);
            return (
            <tr key={movement.row_key || movement.id}>
              <td data-label="Descripcion" className="description-cell" title={movement.description}>
                <span className="description-content">
                  <span className="description-text">{movement.description}</span>
                  <span className="movement-badges">
                    {movement.recurring_id && <span className="recurring-badge">Recurrente</span>}
                    {paymentBadge && <span className={`payment-mode-badge ${paymentBadgeMode}`}>{paymentBadge}</span>}
                  </span>
                </span>
              </td>
              <td data-label="Cuenta" className="account-cell" title={`${movement.account || "Principal"}${movement.target_account ? ` -> ${movement.target_account}` : ""}`}>
                {movement.account || "Principal"}
                {movement.target_account ? ` -> ${movement.target_account}` : ""}
              </td>
              <td data-label="Tipo">
                <span className={`pill ${movement.type === "Ingreso" ? "income" : "expense"}`}>{movement.type}</span>
              </td>
              <td data-label="Categoria" className={getCategoryClass(movement.category)}><CategoryBadge category={movement.category} compact /></td>
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
                {tcLink && onOpenTcDetail && (
                  <button type="button" className="icon-button" onClick={() => onOpenTcDetail(tcLink)} aria-label="Ver detalle TC">
                    <FileSearch size={16} />
                  </button>
                )}
                <button type="button" className="icon-button danger" onClick={() => onDelete(movement.source_movement?.id || movement.id)} aria-label="Eliminar movimiento">
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
            );
          })}
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
          const tcLink = getTcSummaryLink(movement);
          const paymentBadge = getPaymentBadge(movement);
          const paymentBadgeMode = getPaymentBadgeMode(movement);
          return (
            <article className="mobile-movement-card" key={movement.row_key ? `${movement.row_key}-mobile` : `${movement.id}-mobile`}>
              <header>
                <div>
                  <strong className="description-text">{movement.description}</strong>
                  <span className="movement-badges">
                    {movement.recurring_id && <span className="recurring-badge">Recurrente</span>}
                    {paymentBadge && <span className={`payment-mode-badge ${paymentBadgeMode}`}>{paymentBadge}</span>}
                  </span>
                  <span className="mobile-account-text">{accountText}</span>
                </div>
                <b className={movement.amount >= 0 ? "income-text" : "expense-text"}>{formatCurrency(movement.amount)}</b>
              </header>
              <div className="mobile-movement-meta">
                <span className={`pill ${movement.type === "Ingreso" ? "income" : "expense"}`}>{movement.type}</span>
                <CategoryBadge category={movement.category} compact />
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
                  <button type="button" className="icon-button mobile-reorder-action" onClick={() => onMove(movement, -1)} disabled={!movement.canMoveUp} aria-label="Subir movimiento">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" className="icon-button mobile-reorder-action" onClick={() => onMove(movement, 1)} disabled={!movement.canMoveDown} aria-label="Bajar movimiento">
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" className="icon-button" onClick={() => onEdit(movement.source_movement || movement)} aria-label="Editar movimiento">
                    <Pencil size={16} />
                  </button>
                  {tcLink && onOpenTcDetail && (
                    <button type="button" className="icon-button" onClick={() => onOpenTcDetail(tcLink)} aria-label="Ver detalle TC">
                      <FileSearch size={16} />
                    </button>
                  )}
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
