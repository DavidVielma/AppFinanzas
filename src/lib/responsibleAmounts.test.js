import assert from "node:assert/strict";
import { getResponsibleAmount, parseResponsibleAmounts } from "./responsibleAmounts.js";

assert.deepEqual(parseResponsibleAmounts('{"Tomas":12000,"Fabian":8500}'), { Tomas: 12000, Fabian: 8500 });
assert.deepEqual(parseResponsibleAmounts("invalid"), {});

const customMovement = {
  amount: 20500,
  responsible_amounts: JSON.stringify({ Tomas: 12000, Fabian: 8500 })
};
assert.equal(getResponsibleAmount(customMovement, "tomas", 2), 12000);
assert.equal(getResponsibleAmount(customMovement, "Fabian", 2), 8500);

const equalMovement = { amount: -30000 };
assert.equal(getResponsibleAmount(equalMovement, "Tomas", 3), 10000);

console.log("responsible amount tests passed");
