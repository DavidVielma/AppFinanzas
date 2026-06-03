export const movementTypes = ["Ingreso", "Egreso"];

export const flowTypes = ["Movimiento", "Transferencia", "Pago Tarjeta"];

export const defaultAccounts = [
  { name: "Principal", type: "principal", color: "#e2e8f0", archived: false, locked: true, sort_order: 0 },
  { name: "Ahorro", type: "ahorro", color: "#cfe9d8", archived: false, locked: true, sort_order: 1 },
  { name: "Tarjeta de Credito", type: "tarjeta_credito", color: "#d7e7ff", archived: false, locked: false, sort_order: 2 }
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
  "Tarjeta de Credito",
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

export function normalizeCategory(category, type = "Egreso", categoryOptions = null) {
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
  const options = categoryOptions || getCategoryOptions(type);
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
  const resolved = movements.map((movement) => ({ ...movement }));
  const autoPaymentIndexes = resolved
    .map((movement, index) => ({ movement, index }))
    .filter(({ movement }) => movement.flow === "Pago Tarjeta" && movement.target_account && movement.card_payment_mode === "auto")
    .sort((a, b) => {
      const aMovement = a.movement;
      const bMovement = b.movement;
      return (
        Number(aMovement.year) - Number(bMovement.year) ||
        Number(aMovement.month) - Number(bMovement.month) ||
        Number(aMovement.sort_order || 0) - Number(bMovement.sort_order || 0) ||
        Date.parse(aMovement.created_at || "") - Date.parse(bMovement.created_at || "") ||
        String(aMovement.id || "").localeCompare(String(bMovement.id || ""))
      );
    });

  autoPaymentIndexes.forEach(({ movement, index }) => {
    const amount = -Math.abs(calculateCreditCardFullPaymentAmounts(resolved, movement.year, movement.month, accounts, { excludePaymentId: movement.id })?.[movement.target_account] || 0);

    resolved[index] = {
      ...movement,
      amount,
      type: getTypeFromAmount(amount),
      card_payment_mode: "auto"
    };
  });

  return resolved;
}

export function getCreditCardPaymentCoverage(movement, movements, accounts = defaultAccounts) {
  if (movement?.flow !== "Pago Tarjeta" || !movement.target_account) {
    return null;
  }

  const amountPaid = Math.abs(Number(movement.amount || 0));
  const totalDue = Math.abs(Number(calculateCreditCardFullPaymentAmounts(movements, movement.year, movement.month, accounts, { excludePaymentId: movement.id })[movement.target_account] || 0));
  const isTotal = totalDue > 0 && amountPaid >= totalDue - 1;

  return {
    amountPaid,
    totalDue,
    isTotal,
    mode: isTotal ? "auto" : "manual",
    label: isTotal ? "Total" : "Parcial"
  };
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

export function calculateCreditCardPeriodStats(movements, year, month, accounts = defaultAccounts) {
  const ledger = calculateAccountLedger(movements, year, month, accounts);
  const cardAccounts = accounts.filter((account) => account.type === "tarjeta_credito");
  const stats = {};

  cardAccounts.forEach((account) => {
    const cardName = account.name;
    const openingBalance = Number(ledger.opening[cardName] || 0);
    const closingBalance = Number(ledger.closing[cardName] || 0);
    const monthCardMovements = movements.filter(
      (movement) =>
        Number(movement.year) === Number(year) &&
        Number(movement.month) === Number(month) &&
        (movement.account || "Principal") === cardName &&
        !isInternalFlow(movement)
    );
    const monthNetCharges = monthCardMovements.reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
    const payments = movements
      .filter(
        (movement) =>
          Number(movement.year) === Number(year) &&
          Number(movement.month) === Number(month) &&
          movement.flow === "Pago Tarjeta" &&
          movement.target_account === cardName
      )
      .reduce((sum, movement) => sum + Math.abs(Number(movement.amount || 0)), 0);

    stats[cardName] = {
      openingDebt: Math.abs(Math.min(openingBalance, 0)),
      monthCharges: Math.abs(Math.min(monthNetCharges, 0)),
      payments,
      pending: Math.abs(Math.min(closingBalance, 0)),
      closingBalance
    };
  });

  return stats;
}

export function calculateCreditCardFullPaymentAmounts(movements, year, month, accounts = defaultAccounts, options = {}) {
  const excludePaymentId = options.excludePaymentId;
  const adjustedMovements = excludePaymentId
    ? movements.map((movement) =>
        movement.id === excludePaymentId && movement.flow === "Pago Tarjeta"
          ? { ...movement, amount: 0 }
          : movement
      )
    : movements;
  const stats = calculateCreditCardPeriodStats(adjustedMovements, year, month, accounts);

  return Object.fromEntries(
    Object.entries(stats).map(([cardName, item]) => {
      const fullPaymentAmount = Math.max(0, item.openingDebt + item.monthCharges - item.payments);
      return [cardName, fullPaymentAmount];
    })
  );
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
