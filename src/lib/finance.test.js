import assert from "node:assert/strict";
import { normalizeCategory } from "./finance.js";

assert.equal(
  normalizeCategory("auto", "Egreso", ["Movilizacion", "auto", "Transporte"]),
  "auto",
  "A custom category must take precedence over a built-in alias"
);

assert.equal(
  normalizeCategory("AUTO", "Egreso", ["Movilizacion", "Auto", "Transporte"]),
  "Auto",
  "A custom category match must preserve its configured spelling"
);

assert.equal(
  normalizeCategory("auto", "Egreso", ["Movilizacion", "Transporte"]),
  "Transporte",
  "The built-in alias must still apply when no matching custom category exists"
);

console.log("finance category normalization tests passed");
