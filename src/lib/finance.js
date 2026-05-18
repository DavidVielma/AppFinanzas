export const movementTypes = ["Ingreso", "Egreso"];

export const flowTypes = ["Movimiento", "Transferencia", "Pago Tarjeta"];

export const defaultAccounts = [
  { name: "Principal", type: "principal", color: "#e2e8f0", archived: false, locked: true },
  { name: "Ahorro", type: "ahorro", color: "#cfe9d8", archived: false, locked: true },
  { name: "Tarjeta Falabella", type: "tarjeta_credito", color: "#cfe9d8", archived: false, locked: false },
  { name: "Banco de Chile", type: "tarjeta_credito", color: "#d7e7ff", archived: false, locked: false },
  { name: "Otros", type: "principal", color: "#e2e8f0", archived: false, locked: true }
];

export const incomeCategories = [
  "Sin definir",
  "Sueldo",
  "Honorarios",
  "Bonos",
  "Ingreso Extra",
  "Balance Anterior",
  "Inversiones",
  "Reembolso",
  "Regalos",
  "Otros"
];

export const expenseCategories = [
  "Sin definir",
  "Ahorro",
  "Casa",
  "Supermercado",
  "Alimentacion",
  "Servicios Basicos",
  "Arriendo / Dividendo",
  "Transporte",
  "Combustible",
  "Salud",
  "Educacion",
  "Mascotas",
  "Ropa",
  "Regalos",
  "Impuestos",
  "Seguros",
  "Suscripciones",
  "Entretenimiento",
  "Restaurantes",
  "Viajes",
  "Emergencias",
  "Inversiones",
  "Transferencia",
  "Pago Tarjeta",
  "CMR",
  "Tarjeta Falabella",
  "Banco de Chile",
  "Otros"
];

export const defaultCategories = Array.from(new Set([...incomeCategories, ...expenseCategories]));

export const monthLabels = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

export function formatCurrency(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Math.round(Number(value) || 0));
}

export function getCurrentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function normalizeAmount(type, amount) {
  const abs = Math.abs(Number(amount) || 0);
  return type === "Egreso" ? -abs : abs;
}

export function getTypeFromAmount(amount) {
  return Number(amount) > 0 ? "Ingreso" : "Egreso";
}

export function getCategoryOptions(type) {
  return type === "Ingreso" ? incomeCategories : expenseCategories;
}

export function normalizeCategory(category, type = "Egreso") {
  const value = String(category || "").trim();
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
  const aliases = {
    alimentacion: "Alimentacion",
    alimentos: "Alimentacion",
    supermercado: "Supermercado",
    super: "Supermercado",
    sueldo: "Sueldo",
    salario: "Sueldo",
    honorario: "Honorarios",
    honorarios: "Honorarios",
    bono: "Bonos",
    bonos: "Bonos",
    "ingreso extra": "Ingreso Extra",
    extra: "Ingreso Extra",
    "balance anterior": "Balance Anterior",
    anterior: "Balance Anterior",
    inversion: "Inversiones",
    inversiones: "Inversiones",
    ahorro: "Ahorro",
    casa: "Casa",
    hogar: "Casa",
    "servicios basicos": "Servicios Basicos",
    servicios: "Servicios Basicos",
    luz: "Servicios Basicos",
    agua: "Servicios Basicos",
    gas: "Servicios Basicos",
    internet: "Servicios Basicos",
    arriendo: "Arriendo / Dividendo",
    dividendo: "Arriendo / Dividendo",
    transporte: "Transporte",
    auto: "Transporte",
    combustible: "Combustible",
    bencina: "Combustible",
    salud: "Salud",
    educacion: "Educacion",
    mascotas: "Mascotas",
    ropa: "Ropa",
    regalos: "Regalos",
    impuestos: "Impuestos",
    seguros: "Seguros",
    suscripcion: "Suscripciones",
    suscripciones: "Suscripciones",
    entretenimiento: "Entretenimiento",
    restaurantes: "Restaurantes",
    restaurant: "Restaurantes",
    viajes: "Viajes",
    viaje: "Viajes",
    emergencia: "Emergencias",
    emergencias: "Emergencias",
    transferencia: "Transferencia",
    "pago tarjeta": "Pago Tarjeta",
    reembolso: "Reembolso",
    indefinido: "Sin definir",
    "sin definir": "Sin definir",
    "sin categoria": "Sin definir",
    otros: "Otros"
  };
  const canonical = aliases[normalized] || value || "Sin definir";
  if (["Transferencia", "Pago Tarjeta", "Ahorro"].includes(canonical)) {
    return canonical;
  }
  const options = getCategoryOptions(type);
  return options.includes(canonical) ? canonical : "Otros";
}

export function getAccountMeta(name) {
  return getAccountMetaFrom(defaultAccounts, name);
}

export function getAccountMetaFrom(accounts, name) {
  return accounts.find((account) => account.name === name) || { name: name || "Principal", type: "principal", color: "#f8fafc" };
}

export function isCreditCardAccount(name, accounts = defaultAccounts) {
  return getAccountMetaFrom(accounts, name).type === "tarjeta_credito";
}

export function isInternalFlow(movement) {
  return movement.flow === "Transferencia" || movement.flow === "Pago Tarjeta";
}

export function isCarryoverMovement(movement) {
  return movement.category === "Balance Anterior";
}

export function isSummaryMovement(movement, accounts = defaultAccounts) {
  const account = movement.account || "Principal";
  const accountMeta = accounts.find((item) => item.name === account);
  return Boolean(accountMeta) && accountMeta.type !== "tarjeta_credito" && movement.flow !== "Transferencia";
}

function getPeriodKey(year, month, account) {
  return `${year}-${month}-${account}`;
}

export function calculateCreditCardPaymentTotals(movements, accounts = defaultAccounts) {
  const cardNames = new Set(accounts.filter((account) => account.type === "tarjeta_credito").map((account) => account.name));
  const totals = {};

  movements.forEach((movement) => {
    const account = movement.account || "Principal";

    if (!cardNames.has(account) || isInternalFlow(movement)) {
      return;
    }

    const key = getPeriodKey(movement.year, movement.month, account);
    totals[key] = (totals[key] || 0) + Number(movement.amount || 0);
  });

  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Math.abs(Math.min(value, 0))]));
}

export function resolveDynamicPayments(movements, accounts = defaultAccounts) {
  const paymentTotals = calculateCreditCardPaymentTotals(movements, accounts);

  return movements.map((movement) => {
    if (movement.flow !== "Pago Tarjeta" || !movement.target_account) {
      return movement;
    }

    const key = getPeriodKey(movement.year, movement.month, movement.target_account);
    const amount = -(paymentTotals[key] || 0);

    return {
      ...movement,
      amount,
      type: getTypeFromAmount(amount)
    };
  });
}

function applyMovementToBalances(balances, movement) {
  const account = movement.account || "Principal";
  const target = movement.target_account;
  const amount = Number(movement.amount) || 0;

  balances[account] = (balances[account] || 0) + amount;

  if (target && isInternalFlow(movement)) {
    balances[target] = (balances[target] || 0) + Math.abs(amount);
  }
}

export function calculateAccountBalances(movements, accounts = defaultAccounts) {
  const balances = accounts.reduce((acc, account) => {
    acc[account.name] = 0;
    return acc;
  }, {});

  movements.forEach((movement) => applyMovementToBalances(balances, movement));

  return balances;
}

export function calculateAccountLedger(movements, year, month, accounts = defaultAccounts) {
  const makeZeroBalances = () =>
    accounts.reduce((acc, account) => {
      acc[account.name] = 0;
      return acc;
    }, {});

  const opening = makeZeroBalances();
  const monthNet = makeZeroBalances();

  movements.forEach((movement) => {
    const movementYear = Number(movement.year);
    const movementMonth = Number(movement.month);

    if (movementYear < year || (movementYear === year && movementMonth < month)) {
      applyMovementToBalances(opening, movement);
      return;
    }

    if (movementYear === year && movementMonth === month) {
      applyMovementToBalances(monthNet, movement);
    }
  });

  const closing = makeZeroBalances();
  accounts.forEach((account) => {
    closing[account.name] = (opening[account.name] || 0) + (monthNet[account.name] || 0);
  });

  return { opening, monthNet, closing };
}

export function calculateSummary(movements, year, accounts = defaultAccounts) {
  const monthly = monthLabels.map((label, index) => {
    const month = index + 1;
    const rows = movements.filter((item) => item.year === year && item.month === month);
    const summaryRows = rows.filter((item) => isSummaryMovement(item, accounts));
    const income = summaryRows
      .filter((item) => item.type === "Ingreso")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = summaryRows
      .filter((item) => item.type === "Egreso")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const projected = summaryRows
      .filter((item) => item.status === "Proyectado")
      .reduce((sum, item) => sum + Number(item.amount), 0);

    return {
      label,
      month,
      income,
      expenses,
      balance: income + expenses,
      projected,
      count: rows.length
    };
  });

  const annualIncome = monthly.reduce((sum, item) => sum + item.income, 0);
  const annualExpenses = monthly.reduce((sum, item) => sum + item.expenses, 0);

  return {
    monthly,
    annualIncome,
    annualExpenses,
    annualBalance: annualIncome + annualExpenses
  };
}

export function groupByCategory(movements) {
  return movements.reduce((groups, item) => {
    const key = item.category || "Sin categoria";
    groups[key] = (groups[key] || 0) + Number(item.amount);
    return groups;
  }, {});
}
