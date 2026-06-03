import { getTypeFromAmount, normalizeCategory } from "./finance.js";

export function parseQuickAmount(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const parsed = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function inferCategoryFromText(description, amount) {
  const normalized = String(description || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const rules = [
    { category: "Salud", terms: ["farmacia", "salud", "doctor", "medico", "clinica", "hospital", "dentista", "cruz verde", "salcobrand", "ahumada"] },
    { category: "Supermercado", terms: ["super", "supermercado", "jumbo", "lider", "unimarc", "tottus", "santa isabel"] },
    { category: "Alimentacion", terms: ["comida", "almuerzo", "cena", "desayuno", "mc", "mcdonald", "burger", "kfc", "furry", "cafe", "pizza"] },
    { category: "Transporte", terms: ["uber", "didi", "cabify", "metro", "bus", "bip", "taxi", "peaje"] },
    { category: "Combustible", terms: ["bencina", "combustible", "copec", "shell", "petrobras"] },
    { category: "Servicios Basicos", terms: ["luz", "agua", "gas", "internet", "wom", "entel", "movistar", "claro", "vtr"] },
    { category: "Entretenimiento", terms: ["cine", "netflix", "spotify", "disney", "steam"] },
    { category: "Ropa", terms: ["ropa", "zara", "hm", "falabella", "paris", "ripley"] },
    { category: "Ingreso Extra", terms: ["pago", "abono", "transferencia recibida", "reembolso"] }
  ];

  const match = rules.find((rule) => rule.terms.some((term) => normalized.includes(term)));
  if (!match) return "Sin definir";

  const type = getTypeFromAmount(amount);
  return normalizeCategory(match.category, type);
}

export function parseQuickTextMovement(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const match = raw.match(/^(?:\s*(gasto|egreso|ingreso|abono)\s+)?([+-]?\$?\s*\d[\d.,]*)\s+(.+)$/i);
  if (!match) return null;

  const intent = (match[1] || "").toLowerCase();
  const parsedAmount = parseQuickAmount(match[2].replace("$", "").replace(/\s+/g, ""));
  const description = match[3].trim();

  if (parsedAmount === null || !description) return null;

  const signedAmount = intent === "ingreso" || intent === "abono" ? Math.abs(parsedAmount) : -Math.abs(parsedAmount);

  return {
    amount: signedAmount,
    description,
    category: inferCategoryFromText(description, signedAmount)
  };
}
