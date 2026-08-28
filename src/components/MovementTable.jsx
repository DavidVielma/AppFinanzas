import { useEffect, useRef, useState } from "react";
import { FileSearch, Pencil, Trash2 } from "lucide-react";
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

function normalizeResponsibleName(name, currentResponsible) {
  const value = String(name || "").trim();
  if (!value || value.toLowerCase() === "yo") return currentResponsible || "Yo";
  return value;
}

function parseResponsibleNames(value, currentResponsible) {
  const raw = String(value || "").trim();
  if (!raw) return [currentResponsible || "Yo"];

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((name) => normalizeResponsibleName(name, currentResponsible)).filter(Boolean);
      }
    } catch {
      return [raw];
    }
  }

  return raw.split(",").map((name) => normalizeResponsibleName(name, currentResponsible)).filter(Boolean);
}

function displayResponsibleName(name, currentResponsible) {
  return normalizeResponsibleName(name, currentResponsible) === currentResponsible || String(name).toLowerCase() === "yo" ? "Yo" : name;
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

function isInteractiveTarget(target) {
  return Boolean(target?.closest("button, a, input, select, textarea, label, [role='button']"));
}

function getMovementKey(movement) {
  return movement.row_key || movement.id;
}

function reorderMovementsForDrag(items, fromIndex, toIndex) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;

  const reordered = [...items];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return reordered;
}

export function MovementTable({ movements, currentResponsible, selectedResponsible = "", responsibles = [], categoryOptionsByType = {}, onEdit, onDelete, onStatusChange, onQuickUpdate, onMove, onMoveToMovement, onOpenTcDetail }) {
  const longPressTimerRef = useRef(null);
  const dragRef = useRef(null);
  const dragFrameRef = useRef(null);
  const autoScrollFrameRef = useRef(null);
  const scrollLockRef = useRef(null);
  const [dragState, setDragState] = useState(null);
  const [mobileEditor, setMobileEditor] = useState(null);
  const [desktopDragKey, setDesktopDragKey] = useState(null);
  const [desktopDragOrder, setDesktopDragOrder] = useState(null);

  useEffect(() => {
    return () => {
      window.clearTimeout(longPressTimerRef.current);
      window.cancelAnimationFrame(dragFrameRef.current);
      stopAutoScroll();
      unlockPageScroll();
    };
  }, []);

  function clearLongPressTimer() {
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  function preventPageScroll(event) {
    if (!dragRef.current?.active) return;

    const touch = Array.from(event.touches).find((item) => item.identifier === dragRef.current.touchId);
    if (touch) {
      updateDragOverFromTouch(touch);
    }

    event.preventDefault();
  }

  function lockPageScroll() {
    if (scrollLockRef.current) return;

    scrollLockRef.current = {
      bodyOverflow: document.body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow,
      preventPageScroll
    };
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("touchmove", preventPageScroll, { passive: false, capture: true });
  }

  function unlockPageScroll() {
    if (!scrollLockRef.current) return;

    document.body.style.overflow = scrollLockRef.current.bodyOverflow;
    document.documentElement.style.overflow = scrollLockRef.current.htmlOverflow;
    document.removeEventListener("touchmove", scrollLockRef.current.preventPageScroll, { capture: true });
    scrollLockRef.current = null;
  }

  function stopAutoScroll() {
    window.cancelAnimationFrame(autoScrollFrameRef.current);
    autoScrollFrameRef.current = null;
  }

  function updateAutoScroll(clientY) {
    const drag = dragRef.current;
    if (!drag?.active) return;

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const edgeSize = Math.min(120, Math.max(72, viewportHeight * 0.16));
    const topDistance = clientY;
    const bottomDistance = viewportHeight - clientY;
    let speed = 0;

    if (bottomDistance < edgeSize) {
      speed = Math.min(18, Math.max(4, (edgeSize - bottomDistance) / 5));
    } else if (topDistance < edgeSize) {
      speed = -Math.min(18, Math.max(4, (edgeSize - topDistance) / 5));
    }

    drag.autoScrollSpeed = speed;

    if (!speed) {
      stopAutoScroll();
      return;
    }

    if (autoScrollFrameRef.current) return;

    function step() {
      const activeDrag = dragRef.current;
      if (!activeDrag?.active || !activeDrag.autoScrollSpeed) {
        stopAutoScroll();
        return;
      }

      window.scrollBy(0, activeDrag.autoScrollSpeed);
      updateDragOverPosition();
      autoScrollFrameRef.current = window.requestAnimationFrame(step);
    }

    autoScrollFrameRef.current = window.requestAnimationFrame(step);
  }

  function startMobileDrag(event, movement, index) {
    if (isInteractiveTarget(event.target) || event.touches.length !== 1) return;

    clearLongPressTimer();
    const touch = event.touches[0];
    dragRef.current = {
      touchId: touch.identifier,
      movement,
      startIndex: index,
      overIndex: index,
      startX: touch.clientX,
      startY: touch.clientY,
      startScrollY: window.scrollY || document.documentElement.scrollTop || 0,
      lastY: touch.clientY,
      autoScrollSpeed: 0,
      itemHeight: Math.max(56, event.currentTarget.getBoundingClientRect().height),
      active: false
    };

    longPressTimerRef.current = window.setTimeout(() => {
      if (!dragRef.current || dragRef.current.touchId !== touch.identifier) return;
      dragRef.current.active = true;
      lockPageScroll();
      setDragState({ draggingIndex: index, overIndex: index, draggingKey: getMovementKey(movement) });
    }, 360);
  }

  function updateMobileDrag(event) {
    const drag = dragRef.current;
    if (!drag) return;

    const touch = Array.from(event.touches).find((item) => item.identifier === drag.touchId);
    if (!touch) return;

    if (!drag.active) {
      const deltaX = Math.abs(touch.clientX - drag.startX);
      const deltaY = Math.abs(touch.clientY - drag.startY);
      if (deltaX > 18 || deltaY > 18) {
        clearLongPressTimer();
        dragRef.current = null;
        unlockPageScroll();
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    updateDragOverFromTouch(touch);
  }

  function updateDragOverFromTouch(touch) {
    const drag = dragRef.current;
    if (!drag?.active) return;

    drag.lastY = touch.clientY;
    updateAutoScroll(touch.clientY);
    if (dragFrameRef.current) return;

    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      updateDragOverPosition();
    });
  }

  function updateDragOverPosition() {
    const drag = dragRef.current;
    if (!drag?.active) return;

    const threshold = Math.max(68, drag.itemHeight * 0.9);
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const touchOffset = drag.lastY - drag.startY;
    const scrollOffset = scrollY - drag.startScrollY;
    const offset = touchOffset + scrollOffset;
    const steps = Math.trunc(offset / threshold);
    const overIndex = Math.max(0, Math.min(drag.startIndex + steps, movements.length - 1));

    if (Number.isFinite(overIndex) && overIndex !== drag.overIndex) {
      drag.overIndex = overIndex;
      setDragState({ draggingIndex: drag.startIndex, overIndex, draggingKey: getMovementKey(drag.movement) });
    }
  }

  function endMobileDrag(event) {
    const drag = dragRef.current;
    if (!drag) return;

    clearLongPressTimer();
    window.cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
    stopAutoScroll();
    dragRef.current = null;
    setDragState(null);
    unlockPageScroll();

    if (!drag.active || drag.overIndex === drag.startIndex) return;

    event.preventDefault();
    event.stopPropagation();
    const targetMovement = movements[drag.overIndex];
    if (targetMovement) {
      onMoveToMovement?.(drag.movement, targetMovement);
    }
  }

  function cancelMobileDrag() {
    clearLongPressTimer();
    window.cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
    stopAutoScroll();
    dragRef.current = null;
    setDragState(null);
    unlockPageScroll();
  }

  function getMobileEditorKey(movement) {
    return `${movement.row_key || movement.id}-mobile-editor`;
  }

  function toggleMobileEditor(type, movement) {
    const key = getMobileEditorKey(movement);
    setMobileEditor((current) => (current?.type === type && current?.key === key ? null : { type, key }));
  }

  function getCategoryOptions(movement) {
    const baseOptions = categoryOptionsByType[movement.type] || [];
    return Array.from(new Set([movement.category || "Sin definir", ...baseOptions]));
  }

  function getResponsibleOptions(movement) {
    const selectedNames = parseResponsibleNames(movement.responsible, currentResponsible);
    return Array.from(new Set([currentResponsible || "Yo", ...responsibles.map((responsible) => normalizeResponsibleName(responsible.name, currentResponsible)), ...selectedNames]));
  }

  function getSelectedResponsiblePayment(movement) {
    const movementResponsibles = parseResponsibleNames(movement.responsible, currentResponsible);
    if (!selectedResponsible || !movementResponsibles.includes(selectedResponsible)) return null;
    if (movementResponsibles.length === 1) return movement.status === "Confirmado" ? "paid" : "pending";
    let paidNames = [];
    try {
      const parsed = JSON.parse(String(movement.paid_responsibles || "[]"));
      if (Array.isArray(parsed)) paidNames = parsed.map((name) => normalizeResponsibleName(name, currentResponsible));
    } catch {
      paidNames = String(movement.paid_responsibles || "").split(",").map((name) => normalizeResponsibleName(name, currentResponsible));
    }
    return paidNames.includes(selectedResponsible) ? "paid" : "pending";
  }

  function updateMobileCategory(movement, category) {
    setMobileEditor(null);
    onQuickUpdate?.(movement.source_movement || movement, { category });
  }

  function toggleMovementResponsible(movement, responsible) {
    const selectedNames = parseResponsibleNames(movement.responsible, currentResponsible);
    const normalized = normalizeResponsibleName(responsible, currentResponsible);
    const isSelected = selectedNames.includes(normalized);
    const nextNames = isSelected ? selectedNames.filter((name) => name !== normalized) : [...selectedNames, normalized];
    onQuickUpdate?.(movement.source_movement || movement, { responsible: nextNames.length ? nextNames.join(", ") : normalized });
  }

  function startDesktopDrag(event, movement) {
    if (isInteractiveTarget(event.target)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", getMovementKey(movement));
    setDesktopDragKey(getMovementKey(movement));
    setDesktopDragOrder(movements.map(getMovementKey));
  }

  function previewDesktopMovement(targetMovement) {
    if (!desktopDragKey) return;
    const targetKey = getMovementKey(targetMovement);
    setDesktopDragOrder((current) => {
      const keys = current || movements.map(getMovementKey);
      const fromIndex = keys.indexOf(desktopDragKey);
      const toIndex = keys.indexOf(targetKey);
      return reorderMovementsForDrag(keys, fromIndex, toIndex);
    });
  }

  function dropDesktopMovement(event, targetMovement) {
    event.preventDefault();
    const sourceKey = event.dataTransfer.getData("text/plain") || desktopDragKey;
    const sourceMovement = movements.find((movement) => getMovementKey(movement) === sourceKey);
    setDesktopDragKey(null);
    setDesktopDragOrder(null);
    if (sourceMovement && getMovementKey(sourceMovement) !== getMovementKey(targetMovement)) {
      onMoveToMovement?.(sourceMovement, targetMovement);
    }
  }

  const mobileMovements = dragState
    ? reorderMovementsForDrag(movements, dragState.draggingIndex, dragState.overIndex)
    : movements;
  const desktopMovements = desktopDragOrder
    ? desktopDragOrder.map((key) => movements.find((movement) => getMovementKey(movement) === key)).filter(Boolean)
    : movements;

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
          {desktopMovements.map((movement) => {
            const tcLink = getTcSummaryLink(movement);
            const paymentBadge = getPaymentBadge(movement);
            const paymentBadgeMode = getPaymentBadgeMode(movement);
            const responsiblePayment = getSelectedResponsiblePayment(movement);
            return (
            <tr key={movement.row_key || movement.id} draggable className={desktopDragKey === getMovementKey(movement) ? "desktop-dragging" : ""} onDragStart={(event) => startDesktopDrag(event, movement)} onDragEnter={() => previewDesktopMovement(movement)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => dropDesktopMovement(event, movement)} onDragEnd={() => { setDesktopDragKey(null); setDesktopDragOrder(null); }}>
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
              <td data-label="Responsables" title={formatResponsibles(movement.responsible, currentResponsible)}>
                <span>{formatResponsibles(movement.responsible, currentResponsible)}</span>
                {responsiblePayment && <span className={`personal-payment-dot ${responsiblePayment}`} title={responsiblePayment === "paid" ? "Pagado" : "Pendiente"} aria-label={responsiblePayment === "paid" ? "Pagado" : "Pendiente"} />}
              </td>
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
        {mobileMovements.map((movement) => {
          const originalIndex = movements.findIndex((item) => getMovementKey(item) === getMovementKey(movement));
          const accountText = `${movement.account || "Principal"}${movement.target_account ? ` -> ${movement.target_account}` : ""}`;
          const tcLink = getTcSummaryLink(movement);
          const paymentBadge = getPaymentBadge(movement);
          const paymentBadgeMode = getPaymentBadgeMode(movement);
          const isDragging = dragState?.draggingKey === getMovementKey(movement);
          const editorKey = getMobileEditorKey(movement);
          const selectedResponsibles = parseResponsibleNames(movement.responsible, currentResponsible);
          const responsiblePayment = getSelectedResponsiblePayment(movement);
          return (
            <article
              className={`mobile-movement-card${isDragging ? " is-dragging" : ""}`}
              key={movement.row_key ? `${movement.row_key}-mobile` : `${movement.id}-mobile`}
              data-mobile-movement-index={originalIndex}
              onTouchStart={(event) => startMobileDrag(event, movement, originalIndex)}
              onTouchMove={updateMobileDrag}
              onTouchEnd={endMobileDrag}
              onTouchCancel={cancelMobileDrag}
              onContextMenu={(event) => event.preventDefault()}
            >
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
                <button type="button" className="mobile-chip-button category-chip-button" onClick={() => toggleMobileEditor("category", movement)} aria-expanded={mobileEditor?.type === "category" && mobileEditor?.key === editorKey} aria-label={`Editar categoria de ${movement.description}`}>
                  <CategoryBadge category={movement.category} compact />
                </button>
                {selectedResponsibles.map((responsible) => (
                  <span className="mobile-chip-button responsible-chip-button" key={responsible}>{displayResponsibleName(responsible, currentResponsible)}</span>
                ))}
                <button type="button" className="mobile-chip-button responsible-edit-button" onClick={() => toggleMobileEditor("responsible", movement)} aria-label={`Editar responsables de ${movement.description}`}>Editar</button>
                {responsiblePayment && <span className={`personal-payment-dot ${responsiblePayment}`} title={responsiblePayment === "paid" ? "Pagado" : "Pendiente"} aria-label={responsiblePayment === "paid" ? "Pagado" : "Pendiente"} />}
              </div>
              {mobileEditor?.type === "category" && mobileEditor.key === editorKey && (
                <div className="mobile-inline-editor category-inline-editor">
                  {getCategoryOptions(movement).map((category) => (
                    <button type="button" className={category === movement.category ? "active" : ""} key={category} onClick={() => updateMobileCategory(movement, category)}>
                      <CategoryBadge category={category} compact />
                    </button>
                  ))}
                </div>
              )}
              {mobileEditor?.type === "responsible" && mobileEditor.key === editorKey && (
                <div className="mobile-inline-editor responsible-inline-editor">
                  {getResponsibleOptions(movement).map((responsible) => {
                    const selected = selectedResponsibles.includes(responsible);
                    return (
                      <button type="button" className={selected ? "active" : ""} key={responsible} onClick={() => toggleMovementResponsible(movement, responsible)} aria-pressed={selected}>
                        {displayResponsibleName(responsible, currentResponsible)}
                      </button>
                    );
                  })}
                </div>
              )}
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
