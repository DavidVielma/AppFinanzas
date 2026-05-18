import { Plus, Save } from "lucide-react";
import { flowTypes, getCategoryOptions, getTypeFromAmount, isCreditCardAccount, normalizeCategory } from "../lib/finance";

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

export function MovementForm({ accounts, cardPaymentTotals, responsibles, currentResponsible, draft, onChange, onSubmit, editingId }) {
  function update(field, value) {
    const next = { ...draft, [field]: value };

    if (field === "flow") {
      if (value === "Transferencia") {
        next.type = "Egreso";
        next.category = "Transferencia";
      }
      if (value === "Pago Tarjeta") {
        next.type = "Egreso";
        next.category = "Pago Tarjeta";
      }
    }

    if (field === "amount" && draft.flow === "Movimiento" && draft.installment_mode === "none") {
      const nextType = getTypeFromAmount(value);
      if (getTypeFromAmount(draft.amount) !== nextType) {
        next.category = getCategoryOptions(nextType)[0];
      }
    }

    if (field === "installment_mode" && value !== "none" && !getCategoryOptions("Egreso").includes(next.category)) {
      next.category = getCategoryOptions("Egreso")[0];
    }

    onChange(next);
  }

  const hasInstallments = draft.installment_mode && draft.installment_mode !== "none";
  const inferredType = hasInstallments ? "Egreso" : draft.flow === "Movimiento" ? getTypeFromAmount(draft.amount) : "Egreso";
  const categoryOptions = getCategoryOptions(inferredType);
  const needsTarget = draft.flow === "Transferencia" || draft.flow === "Pago Tarjeta";
  const targetLabel = draft.flow === "Pago Tarjeta" ? "Tarjeta" : "Destino";
  const targetAccounts = accounts.filter((account) => account.name !== draft.account && (draft.flow !== "Pago Tarjeta" || isCreditCardAccount(account.name, accounts)));
  const paymentAmount = draft.flow === "Pago Tarjeta" && draft.target_account ? cardPaymentTotals[draft.target_account] || 0 : null;
  const responsibleOptions = responsibles.length ? responsibles : [{ name: draft.responsible || "Yo" }];
  const selectedResponsibles = parseResponsibleNames(draft.responsible, currentResponsible);
  const installmentCount = Math.max(1, Number.parseInt(draft.installment_count, 10) || 1);
  const installmentPreview = draft.installment_mode === "total" && Number(draft.amount)
    ? Math.abs(Number(draft.amount)) / installmentCount
    : Math.abs(Number(draft.amount) || 0);
  const canUseInstallments = !editingId && draft.flow === "Movimiento";

  function toggleResponsible(name) {
    const next = selectedResponsibles.includes(name)
      ? selectedResponsibles.filter((item) => item !== name)
      : [...selectedResponsibles, name];
    update("responsible", next.join(", "));
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
      <div className="field-summary">
        <span>Tipo</span>
        <strong className={`pill ${inferredType === "Ingreso" ? "income" : "expense"}`}>{inferredType}</strong>
      </div>
      <label>
        Cuenta
        <select value={draft.account} onChange={(event) => update("account", event.target.value)}>
          {accounts.map((account) => (
            <option key={account.name}>{account.name}</option>
          ))}
        </select>
      </label>
      {needsTarget && (
        <label>
          {targetLabel}
          <select value={draft.target_account} onChange={(event) => update("target_account", event.target.value)} required>
            <option value="">Seleccionar</option>
            {targetAccounts.map((account) => (
                <option key={account.name}>{account.name}</option>
              ))}
          </select>
        </label>
      )}
      <label>
        Categoria
        <input
          list="categories"
          value={draft.category}
          onChange={(event) => update("category", event.target.value)}
          onBlur={(event) => update("category", normalizeCategory(event.target.value, inferredType))}
          placeholder="Sin definir, sueldo, supermercado"
        />
        <datalist id="categories">
          {categoryOptions.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </label>
      <label className="wide">
        Descripcion
        <input value={draft.description} onChange={(event) => update("description", event.target.value)} placeholder="Ej: Chat GPT" required />
      </label>
      <label>
        {draft.installment_mode === "total" ? "Valor total" : draft.installment_mode === "fixed" ? "Valor cuota mensual" : "Monto"}
        <input
          type="number"
          value={paymentAmount !== null ? -paymentAmount : draft.amount}
          onChange={(event) => update("amount", event.target.value)}
          step="1"
          placeholder="Ej: 1450000 o -250000"
          readOnly={paymentAmount !== null}
          required
        />
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
      <label>
        Estado
        <select value={draft.status} onChange={(event) => update("status", event.target.value)}>
          <option>Confirmado</option>
          <option>Proyectado</option>
          <option>Pendiente</option>
        </select>
      </label>
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
      <button className="primary-action form-action">
        {editingId ? <Save size={18} /> : <Plus size={18} />}
        {editingId ? "Guardar" : "Agregar"}
      </button>
    </form>
  );
}
