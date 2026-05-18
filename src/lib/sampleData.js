export const seedMovements = [
  { description: "Balance Anterior", flow: "Movimiento", account: "Principal", target_account: null, type: "Ingreso", category: "Balance Anterior", amount: 155653, year: 2026, month: 4, status: "Confirmado" },
  { description: "Sueldo", flow: "Movimiento", account: "Principal", target_account: null, type: "Ingreso", category: "Sueldo", amount: 1450000, year: 2026, month: 4, status: "Confirmado" },
  { description: "Supermercado Falabella", flow: "Movimiento", account: "Tarjeta Falabella", target_account: null, type: "Egreso", category: "Supermercado", amount: -302559, year: 2026, month: 4, status: "Confirmado" },
  { description: "Pago total Falabella", flow: "Pago Tarjeta", account: "Principal", target_account: "Tarjeta Falabella", type: "Egreso", category: "Pago Tarjeta", amount: -302559, year: 2026, month: 4, status: "Confirmado" },
  { description: "Transferencia a ahorro", flow: "Transferencia", account: "Principal", target_account: "Ahorro", type: "Egreso", category: "Ahorro", amount: -700000, year: 2026, month: 4, status: "Proyectado" },
  { description: "Ingreso GPT", flow: "Movimiento", account: "Principal", target_account: null, type: "Ingreso", category: "Ingreso Extra", amount: 16454, year: 2026, month: 4, status: "Confirmado" },
  { description: "Chat GPT", flow: "Movimiento", account: "CMR", target_account: null, type: "Egreso", category: "Suscripciones", amount: -21939, year: 2026, month: 4, status: "Confirmado" },
  { description: "Sueldo", flow: "Movimiento", account: "Principal", target_account: null, type: "Ingreso", category: "Sueldo", amount: 1450000, year: 2026, month: 5, status: "Proyectado" },
  { description: "Falabella mayo", flow: "Movimiento", account: "Tarjeta Falabella", target_account: null, type: "Egreso", category: "Supermercado", amount: -1077927, year: 2026, month: 5, status: "Proyectado" },
  { description: "Gastos del Viaje", flow: "Movimiento", account: "Banco de Chile", target_account: null, type: "Egreso", category: "Viajes", amount: -656874, year: 2026, month: 5, status: "Proyectado" },
  { description: "Inversion Racional", flow: "Movimiento", account: "Ahorro", target_account: null, type: "Ingreso", category: "Inversiones", amount: 2440958, year: 2026, month: 5, status: "Confirmado" },
  { description: "Gasto auto nuevo", flow: "Movimiento", account: "Principal", target_account: null, type: "Egreso", category: "Transporte", amount: -4700000, year: 2026, month: 5, status: "Proyectado" }
];
