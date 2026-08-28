import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Save } from "lucide-react";
import { CategorySelector } from "./CategoryVisuals";
import { flowTypes, formatCurrency, getCategoryOptions, getTypeFromAmount, isCreditCardAccount, monthLabels } from "../lib/finance";

function normalizeResponsibleName(name, currentResponsible) {
  const value = String(name || "").trim();
  if (!value || value.toLowerCase() === "yo") {
    return currentResponsible || "Yo";
  }
  return value;
}

function parseResponsibleNames(value, currentResponsible) {
  const raw = String(value || "").trim();
  if (!raw) return currentResponsible ? [currentResponsible] : [];

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const names = JSON.parse(raw);
      if (Array.isArray(names)) return names.map((name) => normalizeResponsibleName(name, currentResponsible)).filter(Boolean);
    } catch {
      return [];
    }
  }

  return raw.split(",").map((name) => normalizeResponsibleName(name, currentResponsible)).filter(Boolean);
}

function parseAmountInput(value) {
  const raw = String(value || "");
  const isNegative = raw.trim().startsWith("-");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return isNegative ? "-" : "";
  return `${isNegative ? "-" : ""}${Number(digits)}`;
}

function formatAmountInput(value) {
  const raw = String(value ?? "");
  if (!raw || raw === "-") return raw;
  const isNegative = raw.startsWith("-");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return `${isNegative ? "-" : ""}${Number(digits).toLocaleString("es-CL")}`;
}

function getStatusClass(status) {
  if (status === "Confirmado") return "confirmed";
  if (status === "Pendiente") return "pending";
  return "projected";
}

export function PeriodSelector({ month, year, onChange }) {
  const pickerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(Number(year) || new Date().getFullYear());
  const selectedMonth = Math.min(12, Math.max(1, Number(month) || 1));
  const selectedYear = Number(year) || viewYear;

  useEffect(() => {
    setViewYear(Number(year) || new Date().getFullYear());
  }, [year]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!pickerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function selectMonth(nextMonth) {
    onChange({ month: nextMonth, year: viewYear });
    setIsOpen(false);
  }

  return (
    <fieldset className="period-picker" ref={pickerRef}>
      <legend>Periodo</legend>
      <button type="button" className={`period-trigger ${isOpen ? "open" : ""}`} onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen} aria-haspopup="dialog">
        <CalendarDays size={18} aria-hidden="true" />
        <span>{monthLabels[selectedMonth - 1]} {selectedYear}</span>
      </button>
      {isOpen && (
        <div className="period-popover" role="dialog" aria-label="Seleccionar periodo">
          <div className="period-year-control">
            <button type="button" onClick={() => setViewYear((current) => Math.max(2000, current - 1))} aria-label="Año anterior">
              <ChevronLeft size={16} />
            </button>
            <strong>{viewYear}</strong>
            <button type="button" onClick={() => setViewYear((current) => Math.min(2100, current + 1))} aria-label="Año siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="period-month-grid">
            {monthLabels.map((label, index) => {
              const nextMonth = index + 1;
              const isActive = nextMonth === selectedMonth && viewYear === selectedYear;
              return (
                <button type="button" className={isActive ? "active" : ""} key={label} onClick={() => selectMonth(nextMonth)} aria-pressed={isActive}>
                  {label.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </fieldset>
  );
}

export function MovementForm({ accounts, cardPaymentTotals, cardFullPaymentTotals = {}, responsibles, currentResponsible, categoryOptionsByType, draft, onChange, onSubmit, editingId, showTypeSummary = true }) {
  const amountInputRef = useRef(null);

  function update(field, value) {
    const next = { ...draft, [field]: value };

    if (field === "flow") {
      if (value === "Transferencia") {
        next.type = "Egreso";
        next.category = "Transferencia";
        next.installment_mode = "none";
      }
      if (value === "Pago Tarjeta") {
        next.type = "Egreso";
        next.category = "Pago Tarjeta";
        next.recurring_frequency = "none";
        next.installment_mode = "none";
        next.card_payment_mode = next.card_payment_mode || "auto";
      }
    }

    if (field === "card_payment_mode" && draft.flow === "Pago Tarjeta" && value === "auto" && paymentSuggestion) {
      next.amount = -Math.abs(paymentSuggestion);
    }

    if (field === "amount" && draft.flow === "Movimiento") {
      const nextType = getTypeFromAmount(value);
      if (nextType === "Ingreso") {
        next.installment_mode = "none";
        next.installment_count = "1";
      }
      if (draft.installment_mode === "none" && getTypeFromAmount(draft.amount) !== nextType) {
        next.category = (categoryOptionsByType?.[nextType] || getCategoryOptions(nextType))[0];
      }
    }

    if (field === "installment_mode" && value !== "none") {
      next.recurring_frequency = "none";
      if (!(categoryOptionsByType?.Egreso || getCategoryOptions("Egreso")).includes(next.category)) {
        next.category = (categoryOptionsByType?.Egreso || getCategoryOptions("Egreso"))[0];
      }
    }

    if (field === "recurring_frequency" && value !== "none") {
      next.installment_mode = "none";
      next.installment_count = "1";
    }

    onChange(next);
  }

  const amountType = draft.flow === "Movimiento" ? getTypeFromAmount(draft.amount) : "Egreso";
  const hasInstallments = draft.installment_mode && draft.installment_mode !== "none";
  const inferredType = hasInstallments ? "Egreso" : amountType;
  const categoryOptions = categoryOptionsByType?.[inferredType] || getCategoryOptions(inferredType);
  const needsTarget = draft.flow === "Transferencia" || draft.flow === "Pago Tarjeta";
  const targetLabel = draft.flow === "Pago Tarjeta" ? "Tarjeta" : "Destino";
  const targetAccounts = accounts.filter((account) => account.name !== draft.account && (draft.flow !== "Pago Tarjeta" || isCreditCardAccount(account.name, accounts)));
  const paymentSuggestion = draft.flow === "Pago Tarjeta" && draft.target_account
    ? cardFullPaymentTotals[draft.target_account] || 0
    : 0;
  const currentPendingAmount = draft.flow === "Pago Tarjeta" && draft.target_account ? cardPaymentTotals[draft.target_account] || 0 : 0;
  const isFullCreditCardPayment = draft.flow === "Pago Tarjeta" && draft.card_payment_mode !== "manual";
  const responsibleOptions = responsibles.length ? responsibles : [{ name: draft.responsible || "Yo" }];
  const selectedResponsibles = parseResponsibleNames(draft.responsible, currentResponsible);
  const installmentCount = Math.max(1, Number.parseInt(draft.installment_count, 10) || 1);
  const installmentPreview = draft.installment_mode === "total" && Number(draft.amount)
    ? Math.abs(Number(draft.amount)) / installmentCount
    : Math.abs(Number(draft.amount) || 0);
  const canUseInstallments = !editingId && draft.flow === "Movimiento" && amountType === "Egreso";
  const canUseRecurring = !editingId && draft.flow !== "Pago Tarjeta" && draft.installment_mode === "none";
  const recurringCount = Math.max(1, Math.min(120, Number.parseInt(draft.recurring_count, 10) || 1));
  const recurringFrequencyLabel = {
    monthly: "mensuales",
    bimonthly: "cada 2 meses",
    quarterly: "trimestrales",
    yearly: "anuales"
  }[draft.recurring_frequency] || "mensuales";
  const visibleCategoryOptions = categoryOptions.includes(draft.category) ? categoryOptions : [draft.category, ...categoryOptions].filter(Boolean);

  function toggleResponsible(name) {
    const next = selectedResponsibles.includes(name)
      ? selectedResponsibles.filter((item) => item !== name)
      : [...selectedResponsibles, name];
    const paidNames = parseResponsibleNames(draft.paid_responsibles, currentResponsible);
    onChange({
      ...draft,
      responsible: next.join(", "),
      paid_responsibles: next.length > 1 ? JSON.stringify(paidNames.filter((item) => next.includes(item))) : "[]"
    });
  }

  function toggleResponsiblePayment(name) {
    const paidNames = parseResponsibleNames(draft.paid_responsibles, currentResponsible);
    const nextPaidNames = paidNames.includes(name)
      ? paidNames.filter((item) => item !== name)
      : [...paidNames, name];
    update("paid_responsibles", JSON.stringify(nextPaidNames));
  }

  function toggleAmountSign() {
    const currentAmount = String(draft.amount || "");
    const nextAmount = currentAmount.startsWith("-")
      ? currentAmount.replace(/^-/, "")
      : currentAmount
        ? `-${currentAmount}`
        : "-";
    update("amount", nextAmount);
    window.requestAnimationFrame(() => amountInputRef.current?.focus({ preventScroll: true }));
  }

  return (
    <form className="movement-form" onSubmit={onSubmit}>
      <label>
        Operacion
        <select value={draft.flow} onChange={(event) => update("flow", event.target.value)}>
          {flowTypes.map((flow) => (
            <option key={flow}>{flow}</option>
          ))}
        </select>
      </label>
      <div className={`field-summary type-summary ${showTypeSummary ? "" : "hidden"}`}>
        <span>Tipo</span>
        <strong className={`pill ${inferredType === "Ingreso" ? "income" : "expense"}`}>{inferredType}</strong>
      </div>
      <label className="status-field">
        Estado
        <select className={`status-select form-status-select ${getStatusClass(draft.status)}`} value={draft.status} onChange={(event) => update("status", event.target.value)}>
          <option>Confirmado</option>
          <option>Proyectado</option>
          <option>Pendiente</option>
        </select>
      </label>
      <PeriodSelector month={draft.month} year={draft.year} onChange={({ month, year }) => onChange({ ...draft, month, year })} />
      <label>
        Cuenta
        <select value={draft.account} onChange={(event) => update("account", event.target.value)}>
          {accounts.map((account) => (
            <option key={account.name}>{account.name}</option>
          ))}
        </select>
      </label>
      <CategorySelector categories={visibleCategoryOptions} value={draft.category} onChange={(category) => update("category", category)} />
      {needsTarget && (
        <label className="full-on-mobile">
          {targetLabel}
          <select value={draft.target_account} onChange={(event) => update("target_account", event.target.value)} required>
            <option value="">Seleccionar</option>
            {targetAccounts.map((account) => (
                <option key={account.name}>{account.name}</option>
              ))}
          </select>
        </label>
      )}
      <label className="wide">
        Descripcion
        <input value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="Ej: Chat GPT" required />
      </label>
      <label className="full-on-mobile">
        {draft.installment_mode === "total" ? "Valor total" : draft.installment_mode === "fixed" ? "Valor cuota mensual" : "Monto"}
        {draft.flow === "Pago Tarjeta" && (
          <div className="payment-mode-control segmented compact-segmented" role="group" aria-label="Tipo de pago de tarjeta">
            <button type="button" className={draft.card_payment_mode !== "manual" ? "active" : ""} onClick={() => update("card_payment_mode", "auto")} aria-pressed={draft.card_payment_mode !== "manual"}>
              Pago completo
            </button>
            <button type="button" className={draft.card_payment_mode === "manual" ? "active" : ""} onClick={() => update("card_payment_mode", "manual")} aria-pressed={draft.card_payment_mode === "manual"}>
              Pago parcial
            </button>
          </div>
        )}
        <div className="amount-input-row">
          <input
            ref={amountInputRef}
            type="text"
            inputMode="decimal"
            value={formatAmountInput(isFullCreditCardPayment ? -Math.abs(paymentSuggestion) : draft.amount)}
            onChange={(event) => update("amount", parseAmountInput(event.target.value))}
            placeholder="Ej: 1.450.000 o -250.000"
            readOnly={isFullCreditCardPayment}
            required
          />
          <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={toggleAmountSign} disabled={isFullCreditCardPayment} aria-label="Cambiar signo del monto">
            {String((isFullCreditCardPayment ? -Math.abs(paymentSuggestion) : draft.amount) || "").startsWith("-") ? "-" : "+"}
          </button>
        </div>
        {draft.flow === "Pago Tarjeta" && (
          <div className="payment-suggestion">
            <span>
              {isFullCreditCardPayment
                ? `El monto se ajusta automaticamente al total de la tarjeta: $${Math.round(paymentSuggestion).toLocaleString("es-CL")}.`
                : `Pendiente actual: $${Math.round(currentPendingAmount).toLocaleString("es-CL")}. El saldo no pagado queda para el siguiente mes.`}
            </span>
          </div>
        )}
      </label>
      {canUseInstallments && (
        <fieldset className="installment-box">
          <legend>Cuotas</legend>
          <div className="installment-grid">
            <label>
              Modalidad
              <select value={draft.installment_mode} onChange={(event) => update("installment_mode", event.target.value)}>
                <option value="none">Sin cuotas</option>
                <option value="total">Sin intereses: dividir total</option>
                <option value="fixed">Con intereses: cuota fija</option>
              </select>
            </label>
            {draft.installment_mode !== "none" && (
              <label>
                Meses
                <input type="number" min="2" step="1" value={draft.installment_count} onChange={(event) => update("installment_count", event.target.value)} />
              </label>
            )}
          </div>
          {draft.installment_mode !== "none" && (
            <p>
              Se crearan {installmentCount} movimientos mensuales de ${Math.round(installmentPreview).toLocaleString("es-CL")} desde este mes.
            </p>
          )}
        </fieldset>
      )}
      {canUseRecurring && (
        <fieldset className="installment-box">
          <legend>Repeticion</legend>
          <div className="installment-grid">
            <label>
              Frecuencia
              <select value={draft.recurring_frequency} onChange={(event) => update("recurring_frequency", event.target.value)}>
                <option value="none">No repetir</option>
                <option value="monthly">Mensual</option>
                <option value="bimonthly">Cada 2 meses</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
              </select>
            </label>
            {draft.recurring_frequency !== "none" && (
              <label>
                Veces
                <input type="number" min="2" max="120" step="1" value={draft.recurring_count} onChange={(event) => update("recurring_count", event.target.value)} />
              </label>
            )}
          </div>
          {draft.recurring_frequency !== "none" && (
            <p>
              Se crearan {recurringCount} movimientos proyectados {recurringFrequencyLabel} desde este periodo.
            </p>
          )}
        </fieldset>
      )}
      {editingId && draft.recurring_id && (
        <fieldset className="installment-box">
          <legend>Aplicar cambios</legend>
          <label>
            Alcance
            <select value={draft.recurring_edit_scope || "one"} onChange={(event) => update("recurring_edit_scope", event.target.value)}>
              <option value="one">Solo este movimiento</option>
              <option value="following">Este y los siguientes</option>
              <option value="all">Toda la serie</option>
            </select>
          </label>
          {draft.recurring_edit_scope !== "one" && (
            <p>
              Se actualizaran los datos comunes de la serie. Cada movimiento conservara su mes y año.
            </p>
          )}
        </fieldset>
      )}
      <fieldset className="responsible-picker">
        <legend>Responsables</legend>
        <div>
          {responsibleOptions.map((responsible) => (
            <label key={responsible.name}>
              <input type="checkbox" checked={selectedResponsibles.includes(normalizeResponsibleName(responsible.name, currentResponsible))} onChange={() => toggleResponsible(normalizeResponsibleName(responsible.name, currentResponsible))} />
              <span>{responsible.name === currentResponsible ? "Yo" : responsible.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {editingId && selectedResponsibles.length > 1 && (
        <fieldset className="responsible-payment-editor">
          <legend>Pago por persona</legend>
          <p>El monto se divide automaticamente entre {selectedResponsibles.length} {selectedResponsibles.length === 1 ? "persona" : "personas"}.</p>
          <div>
            {selectedResponsibles.map((responsible) => {
              const paid = parseResponsibleNames(draft.paid_responsibles, currentResponsible).includes(responsible);
              const share = Number(draft.amount || 0) / selectedResponsibles.length;
              return (
                <button type="button" className={paid ? "paid" : "pending"} key={responsible} onClick={() => toggleResponsiblePayment(responsible)} aria-pressed={paid}>
                  <span><strong>{responsible === currentResponsible ? "Yo" : responsible}</strong><small>{paid ? "Pagado" : "Pendiente"}</small></span>
                  <b>{formatCurrency(share)}</b>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <button className="primary-action form-action">
        {editingId ? <Save size={18} /> : <Plus size={18} />}
        {editingId ? "Guardar" : "Agregar"}
      </button>
    </form>
  );
}
