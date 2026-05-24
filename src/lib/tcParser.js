export const tcSectionNames = [
  "FALABELLA",
  "HOMECENTER - SODIMAC",
  "TOTTUS",
  "PAT",
  "COMPRAS NACIONALES",
  "COMPRAS INTERNACIONALES",
  "OTROS"
];

const sectionNameSet = new Set(tcSectionNames);

function parseChileanAmount(value) {
  const normalized = String(value || "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatStatementDate(value) {
  const [day, month, year] = String(value || "").split("/");
  if (!day || !month || !year) return value || "";
  return `${year}-${month}-${day}`;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getUserLabel(code, users) {
  const user = users[code];
  if (!user) return code;
  return `${user.role}${user.card ? ` ${user.card}` : ""}`;
}

export function parseFalabellaStatement(text) {
  const users = parseUsers(text);
  const compactText = cleanText(text);
  const billingDate = compactText.match(/Fecha Facturaci\S*n Estado de Cuenta:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || "";
  const billingPeriod = compactText.match(/Per\S*odo Facturado\s*(\d{2}\/\d{2}\/\d{4})\s*(\d{2}\/\d{2}\/\d{4})/i);
  const statementTotal = parseChileanAmount(compactText.match(/Monto Total Facturado a Pagar\s*\$?\s*([\d.]+)/i)?.[1]);
  const previousBilled = parseChileanAmount(compactText.match(/Monto facturado o a pagar per\S*odo anterior\s*([\d.]+)/i)?.[1]);
  const previousPaid = parseChileanAmount(compactText.match(/Monto pagado per\S*odo anterior\s*(-?[\d.]+)/i)?.[1]);
  const previousBalance = parseChileanAmount(compactText.match(/Saldo adeudado final periodo anterior\s*(-?[\d.]+)/i)?.[1]);
  const previousOverpayment = Math.max(0, Math.abs(previousPaid) - previousBilled);
  const lines = text.split(/\r?\n/);
  const movements = [];
  const adjustments = previousBalance > 0 ? [buildPreviousBalanceAdjustment(previousBalance)] : [];
  let currentSection = "";
  let inOperations = false;
  let inAdjustments = false;

  lines.forEach((rawLine) => {
    const line = cleanText(rawLine.replace(/\f/g, " "));
    if (!line) return;

    if (/^2\.1\s+Total Operaciones/i.test(line)) {
      inOperations = true;
      return;
    }

    if (/^2\.2\s+/i.test(line)) {
      inOperations = false;
      return;
    }

    if (/^2\.3\s+Cargos/i.test(line)) {
      inAdjustments = true;
      return;
    }

    if (/^III\.\s+/i.test(line)) {
      inAdjustments = false;
      return;
    }

    if (inAdjustments) {
      const adjustment = parseAdjustmentLine(line, adjustments.length);
      if (adjustment && shouldIncludeAdjustment(adjustment, previousOverpayment)) {
        adjustments.push(adjustment);
      }
      return;
    }

    if (!inOperations) return;

    const maybeSection = line.toUpperCase();
    if (sectionNameSet.has(maybeSection)) {
      currentSection = maybeSection;
      return;
    }

    if (!currentSection || /^Sin Movimientos$/i.test(line) || /^ESTADO DE CUENTA/i.test(line)) {
      return;
    }

    const movement = parseMovementLine(line, currentSection, users);
    if (movement) {
      movements.push({ ...movement, id: `${movement.date}-${movement.userCode}-${movements.length}` });
    }
  });

  if (previousOverpayment > 10) {
    adjustments.push(buildPreviousOverpaymentAdjustment(previousOverpayment));
  }

  const operationsTotal = movements.reduce((sum, movement) => sum + movement.amount, 0);
  const adjustmentsTotal = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
  const reconciledTotal = operationsTotal + adjustmentsTotal;
  const difference = statementTotal ? reconciledTotal - statementTotal : 0;

  return {
    bank: "Banco Falabella",
    billingDate,
    statementTotal,
    previousBilled,
    previousPaid,
    previousBalance,
    previousOverpayment,
    period: {
      from: billingPeriod?.[1] || "",
      to: billingPeriod?.[2] || ""
    },
    users,
    movements,
    adjustments,
    reconciliation: {
      operationsTotal,
      adjustmentsTotal,
      reconciledTotal,
      statementTotal,
      difference
    },
    summaryByUser: summarizeBy(movements, "userCode", users),
    summaryBySection: summarizeBy(movements, "section"),
    insights: buildInsights(movements, users, { adjustmentsTotal, difference })
  };
}

function parseUsers(text) {
  const users = {};
  const userPattern = /^\s*(?:\(1\)\s*)?(T|A\d+):\s*([^:]+):\s*([*\d]+)\s*$/gim;
  let match = userPattern.exec(text);

  while (match) {
    users[match[1]] = {
      code: match[1],
      role: cleanText(match[2]),
      card: cleanText(match[3])
    };
    match = userPattern.exec(text);
  }

  return users;
}

function parseMovementLine(line, section, users) {
  const pattern = /^(.*?)\s*(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(T|A\d+)\s+(-?[\d.]+)(?:\s+(-?[\d.]+))?(?:\s+\d{2}\/\d{2})?(?:\s+[a-z]{3}-\d{4})?(?:\s+(-?[\d.]+))?\s*$/i;
  const match = line.match(pattern);
  if (!match) return null;

  const [, location, date, description, userCode, firstAmount, secondAmount, lastAmount] = match;
  const billedAmount = parseChileanAmount(lastAmount || secondAmount || firstAmount);

  return {
    section,
    location: cleanText(location) || "S/I",
    date,
    isoDate: formatStatementDate(date),
    description: cleanText(description),
    userCode,
    userLabel: getUserLabel(userCode, users),
    amount: billedAmount,
    signedAmount: -Math.abs(billedAmount)
  };
}

function parseAdjustmentLine(line, index) {
  const pattern = /^(.*?)\s*(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(?:(T|A\d+)\s+)?(-?[\d.]+)(?:\s+(-?[\d.]+))?(?:\s+\d{2}\/\d{2})?(?:\s+[a-z]{3}-\d{4})?(?:\s+(-?[\d.]+))?\s*$/i;
  const match = line.match(pattern);
  if (!match) return null;

  const [, location, date, description, userCode, firstAmount, secondAmount, lastAmount] = match;
  const rawAmount = parseChileanAmount(lastAmount || secondAmount || firstAmount);
  const firstParsedAmount = parseChileanAmount(firstAmount);
  const isPayment = firstParsedAmount < 0 || /pago tarjeta/i.test(description);
  const amount = isPayment ? firstParsedAmount : rawAmount;

  return {
    id: `adjustment-${date}-${index}`,
    location: cleanText(location) || "S/I",
    date,
    isoDate: formatStatementDate(date),
    description: cleanText(description),
    userCode: userCode || "",
    amount,
    type: amount < 0 ? "Abono" : "Cargo"
  };
}

function buildPreviousOverpaymentAdjustment(amount) {
  return {
    id: "adjustment-previous-overpayment",
    location: "S/I",
    date: "",
    isoDate: "",
    description: "Sobrepago periodo anterior",
    userCode: "",
    amount: -Math.abs(amount),
    type: "Abono"
  };
}

function buildPreviousBalanceAdjustment(amount) {
  return {
    id: "adjustment-previous-balance",
    location: "S/I",
    date: "",
    isoDate: "",
    description: "Saldo adeudado periodo anterior",
    userCode: "",
    amount,
    type: "Cargo"
  };
}

function shouldIncludeAdjustment(adjustment, previousOverpayment) {
  if (adjustment.amount >= 0) return true;
  if (!/pago tarjeta/i.test(adjustment.description)) return true;
  return false;
}

function summarizeBy(movements, key, users = {}) {
  const groups = new Map();

  movements.forEach((movement) => {
    const groupKey = movement[key] || "Sin clasificar";
    const current = groups.get(groupKey) || {
      key: groupKey,
      label: key === "userCode" ? getUserLabel(groupKey, users) : groupKey,
      count: 0,
      total: 0
    };

    current.count += 1;
    current.total += movement.amount;
    groups.set(groupKey, current);
  });

  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

function buildInsights(movements, users, reconciliation = {}) {
  if (!movements.length) {
    return ["No se detectaron movimientos en la seccion 2.1 del estado de cuenta."];
  }

  const userSummary = summarizeBy(movements, "userCode", users);
  const sectionSummary = summarizeBy(movements, "section");
  const topUser = userSummary[0];
  const topSection = sectionSummary[0];
  const topMovement = [...movements].sort((a, b) => b.amount - a.amount)[0];

  return [
    `${topUser.label} concentra el mayor gasto del periodo con ${topUser.count} movimientos.`,
    `${topSection.label} es la seccion con mayor monto acumulado.`,
    `El movimiento de mayor valor detectado fue "${topMovement.description}" por ${topMovement.amount.toLocaleString("es-CL")}.`,
    `La conciliacion suma cargos y abonos por ${Number(reconciliation.adjustmentsTotal || 0).toLocaleString("es-CL")}; diferencia contra el total facturado: ${Number(reconciliation.difference || 0).toLocaleString("es-CL")}.`
  ];
}
