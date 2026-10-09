import assert from "node:assert/strict";
import { buildReimbursementDescription, syncReimbursementDescription, scaleReimbursement, getMovementSeriesRows, hasMovementSeries, parseInstallmentDescription, buildInstallmentDescription, shiftPeriod, getMonthOffset } from "./movementSeries.js";

assert.deepEqual(parseInstallmentDescription("Notebook (2/12)"), { base: "Notebook", index: 2, total: 12 });
assert.equal(parseInstallmentDescription("Notebook"), null);
assert.equal(buildInstallmentDescription("Notebook ", 3, 6), "Notebook (3/6)");

const legacy = [1, 2, 3, 4].map((index) => ({
  id: `l${index}`,
  flow: "Movimiento",
  account: "Visa",
  description: `Sillon (${index}/4)`,
  year: index <= 2 ? 2026 : 2027,
  month: index <= 2 ? 10 + index : index - 2
}));
const other = { id: "x", flow: "Movimiento", account: "Visa", description: "Sillon (1/4)", year: 2025, month: 1 };
const movements = [...legacy, other];

assert.deepEqual(getMovementSeriesRows(legacy[1], movements, "all").map((m) => m.id), ["l2"], "installments without recurring_id are not grouped by name");
assert.equal(hasMovementSeries(legacy[1], movements), false);
assert.equal(hasMovementSeries(other, movements), false);

const linked = [1, 2, 3].map((index) => ({ id: `r${index}`, recurring_id: "s1", recurring_occurrence: index, flow: "Movimiento", description: `Tele (${index}/3)`, year: 2026, month: index }));
assert.deepEqual(getMovementSeriesRows(linked[2], linked, "following").map((m) => m.id), ["r3"]);
assert.deepEqual(getMovementSeriesRows(linked[0], linked, "all").map((m) => m.id), ["r1", "r2", "r3"]);

assert.deepEqual(shiftPeriod(2026, 12, 1), { year: 2027, month: 1 });
assert.deepEqual(shiftPeriod(2026, 1, -1), { year: 2025, month: 12 });
assert.equal(getMonthOffset(2026, 11, 2027, 2), 3);

const reimbursement = { amount: 12500, responsible_amounts: JSON.stringify({ Ana: 12500 }) };
assert.deepEqual(scaleReimbursement(reimbursement, -25000, -30000), { amount: 15000, responsible_amounts: JSON.stringify({ Ana: 15000 }) });
assert.deepEqual(scaleReimbursement({ amount: 10000, responsible_amounts: JSON.stringify({ Ana: 6667, Luis: 3333 }) }, -20000, -10000), { amount: 5001, responsible_amounts: JSON.stringify({ Ana: 3334, Luis: 1667 }) });
assert.equal(scaleReimbursement(reimbursement, -25000, -25000), null, "same amount leaves the reimbursement as is");
assert.equal(scaleReimbursement(reimbursement, 0, -100), null);

console.log("movement series tests passed");

assert.equal(buildReimbursementDescription("INACAP (3/3)"), "Reembolso: INACAP (3/3)");
assert.deepEqual(syncReimbursementDescription({ description: "Reembolso: Bencina" }, "Bencina Mayo"), { description: "Reembolso: Bencina Mayo" });
assert.equal(syncReimbursementDescription({ description: "Reembolso: Bencina" }, "Bencina"), null);
assert.equal(syncReimbursementDescription(null, "Bencina"), null);
