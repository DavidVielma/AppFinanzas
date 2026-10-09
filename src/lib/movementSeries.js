import { parseResponsibleAmounts } from "./responsibleAmounts.js";

// Series de movimientos: recurrentes y compras en cuotas, enlazadas por recurring_id.
// El sufijo "(n/N)" de la descripcion solo indica el numero de cuota.

const installmentSuffixPattern = /\s*\((\d+)\/(\d+)\)\s*$/;

function periodIndex(year, month) {
  return Number(year) * 12 + Number(month) - 1;
}

export function parseInstallmentDescription(description) {
  const text = String(description || "");
  const match = text.match(installmentSuffixPattern);
  if (!match) return null;

  const index = Number(match[1]);
  const total = Number(match[2]);
  if (!index || !total || index > total || total < 2) return null;

  return { base: text.slice(0, match.index).trim(), index, total };
}

export function buildInstallmentDescription(base, index, total) {
  return `${String(base || "").trim()} (${index}/${total})`;
}

export function stripInstallmentSuffix(description) {
  return String(description || "").replace(installmentSuffixPattern, "").trim();
}

export function isInstallmentMovement(movement) {
  return Boolean(movement && movement.flow === "Movimiento" && parseInstallmentDescription(movement.description));
}

// Posicion del movimiento dentro de su serie, para comparar "este y los siguientes".
function getSeriesPosition(movement) {
  const installment = parseInstallmentDescription(movement.description);
  if (installment) return installment.index;

  const occurrence = Number(movement.recurring_occurrence);
  if (Number.isFinite(occurrence) && occurrence > 0) return occurrence;

  return null;
}

export function getMovementSeriesRows(movement, movements, scope = "all") {
  if (!movement) return [];
  if (scope === "one") return [movement];

  const siblings = movement.recurring_id
    ? movements.filter((item) => item.id === movement.id || item.recurring_id === movement.recurring_id)
    : [movement];

  const sorted = [...siblings].sort((a, b) => periodIndex(a.year, a.month) - periodIndex(b.year, b.month));
  if (scope === "all") return sorted;

  const basePosition = getSeriesPosition(movement);
  return sorted.filter((item) => {
    const position = getSeriesPosition(item);
    if (basePosition !== null && position !== null) return position >= basePosition;
    return periodIndex(item.year, item.month) >= periodIndex(movement.year, movement.month);
  });
}

export function hasMovementSeries(movement) {
  return Boolean(movement?.recurring_id);
}

export function getMonthOffset(fromYear, fromMonth, toYear, toMonth) {
  return periodIndex(toYear, toMonth) - periodIndex(fromYear, fromMonth);
}

export function shiftPeriod(year, month, offset) {
  const index = periodIndex(year, month) + offset;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

// Cuando cambia el monto de una compra, su reembolso se ajusta en la misma proporcion,
// persona por persona y en pesos enteros. Devuelve null si no hay nada que ajustar.
// Nombre del reembolso de una compra; se recalcula cuando la compra cambia de nombre.
export function buildReimbursementDescription(sourceDescription) {
  return `Reembolso: ${String(sourceDescription || "").trim()}`;
}

export function syncReimbursementDescription(reimbursement, newSourceDescription) {
  if (!reimbursement || newSourceDescription == null) return null;
  const description = buildReimbursementDescription(newSourceDescription);
  return reimbursement.description === description ? null : { description };
}

export function scaleReimbursement(reimbursement, oldSourceAmount, newSourceAmount) {
  const oldAbs = Math.abs(Number(oldSourceAmount) || 0);
  const newAbs = Math.abs(Number(newSourceAmount) || 0);
  if (!reimbursement || !oldAbs || oldAbs === newAbs) return null;

  const ratio = newAbs / oldAbs;
  const amounts = parseResponsibleAmounts(reimbursement.responsible_amounts);
  const names = Object.keys(amounts);
  if (!names.length) {
    return { amount: Math.round(Math.abs(Number(reimbursement.amount) || 0) * ratio) };
  }

  const scaled = Object.fromEntries(names.map((name) => [name, Math.round((Number(amounts[name]) || 0) * ratio)]));
  return {
    amount: Object.values(scaled).reduce((sum, value) => sum + value, 0),
    responsible_amounts: JSON.stringify(scaled)
  };
}
