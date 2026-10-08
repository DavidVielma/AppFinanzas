import assert from "node:assert/strict";
import { getMovementSeriesRows, hasMovementSeries, parseInstallmentDescription, buildInstallmentDescription, shiftPeriod, getMonthOffset } from "./movementSeries.js";

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

assert.deepEqual(getMovementSeriesRows(legacy[1], movements, "all").map((m) => m.id), ["l1", "l2", "l3", "l4"], "legacy installments group by period anchor");
assert.deepEqual(getMovementSeriesRows(legacy[1], movements, "following").map((m) => m.id), ["l2", "l3", "l4"]);
assert.deepEqual(getMovementSeriesRows(legacy[1], movements, "one").map((m) => m.id), ["l2"]);
assert.equal(hasMovementSeries(other, movements), false, "a lone installment with another anchor is not a series");

const linked = [1, 2, 3].map((index) => ({ id: `r${index}`, recurring_id: "s1", recurring_occurrence: index, flow: "Movimiento", description: `Tele (${index}/3)`, year: 2026, month: index }));
assert.deepEqual(getMovementSeriesRows(linked[2], linked, "following").map((m) => m.id), ["r3"]);
assert.deepEqual(getMovementSeriesRows(linked[0], linked, "all").map((m) => m.id), ["r1", "r2", "r3"]);

assert.deepEqual(shiftPeriod(2026, 12, 1), { year: 2027, month: 1 });
assert.deepEqual(shiftPeriod(2026, 1, -1), { year: 2025, month: 12 });
assert.equal(getMonthOffset(2026, 11, 2027, 2), 3);

console.log("movement series tests passed");
