import { calculateAccountLedger, formatCurrency, monthLabels } from "../lib/finance";

function getVisibleSortValue(movement) {
  return Number(movement.visible_sort_order ?? movement.sort_order) || Date.parse(movement.created_at || "") || 0;
}

function expandRowsForAccount(rows, accountName) {
  const expanded = [];

  rows.forEach((movement) => {
    if ((movement.account || "Principal") === accountName) {
      expanded.push(movement);
    }

    if (movement.flow === "Transferencia" && movement.target_account === accountName) {
      expanded.push({
        ...movement,
        row_key: `${movement.id}-annual-target-${accountName}`,
        description: `Transferencia recibida: ${movement.description}`,
        type: "Ingreso",
        amount: Math.abs(Number(movement.amount) || 0),
        visible_sort_order: movement.target_sort_order ?? movement.sort_order
      });
    }
  });

  return expanded.sort((a, b) => getVisibleSortValue(a) - getVisibleSortValue(b) || String(a.id).localeCompare(String(b.id)));
}

function hasAccountRows(account, rows) {
  return rows.some((movement) => (movement.account || "Principal") === account.name || movement.target_account === account.name);
}

export function AnnualSummaryView({ accounts, movements, year, summary }) {
  const yearMovements = movements.filter((movement) => Number(movement.year) === Number(year));

  return (
    <section className="annual-summary-view">
      <div className="dashboard-panel annual-summary-intro">
        <div>
          <span className="eyebrow">Resumen Anual</span>
          <h2>Vista mensual compacta</h2>
          <p>Balance mensual, saldos acumulados de cuentas principales y detalle resumido por cuenta y tarjeta.</p>
        </div>
        <strong>{formatCurrency(summary.annualBalance)}</strong>
      </div>

      <div className="annual-month-slicer" aria-label="Meses del año">
        {monthLabels.map((month) => (
          <a key={month} href={`#annual-${month.toLowerCase()}`}>
            {month.slice(0, 3)}
          </a>
        ))}
      </div>

      <div className="annual-summary-scroll">
        {monthLabels.map((monthName, index) => {
          const month = index + 1;
          const monthRows = yearMovements.filter((movement) => Number(movement.month) === month);
          const ledger = calculateAccountLedger(movements, Number(year), month, accounts);
          const monthSummary = summary.monthly.find((item) => item.month === month);
          const visibleAccounts = accounts.filter((account) => account.name !== "Otros" && (!account.archived || hasAccountRows(account, monthRows)));
          const mainAccounts = visibleAccounts.filter((account) => account.type !== "tarjeta_credito");
          const cardAccounts = visibleAccounts.filter((account) => account.type === "tarjeta_credito");

          return (
            <article className="annual-month-card" id={`annual-${monthName.toLowerCase()}`} key={monthName}>
              <header>
                <h3>Finales de {monthName}</h3>
                <div>
                  <span>Balance del mes</span>
                  <strong className={(monthSummary?.balance || 0) >= 0 ? "income-text" : "expense-text"}>{formatCurrency(monthSummary?.balance || 0)}</strong>
                </div>
              </header>

              <section className="annual-account-state">
                <h4>Cuentas principales</h4>
                {mainAccounts.map((account) => (
                  <div key={account.name}>
                    <span>{account.name}</span>
                    <strong className={(ledger.closing[account.name] || 0) >= 0 ? "income-text" : "expense-text"}>{formatCurrency(ledger.closing[account.name] || 0)}</strong>
                  </div>
                ))}
              </section>

              <section className="annual-account-groups">
                {[...mainAccounts, ...cardAccounts].map((account) => {
                  const rows = expandRowsForAccount(monthRows, account.name);
                  const accountMovementTotal = rows.reduce((sum, movement) => sum + Number(movement.amount || 0), 0);

                  return (
                    <div className={`annual-account-box ${account.type === "tarjeta_credito" ? "card" : ""}`} key={account.name}>
                      <h4 style={{ backgroundColor: account.color || "#f8fafc" }}>
                        <span>{account.name}</span>
                        <strong className={accountMovementTotal >= 0 ? "income-text" : "expense-text"}>
                          {formatCurrency(accountMovementTotal)}
                        </strong>
                      </h4>
                      <div className="annual-movement-list">
                        <div className="annual-movement-head">
                          <span>Descripcion</span>
                          <span>Monto</span>
                        </div>
                        {rows.slice(0, 12).map((movement) => (
                          <div className="annual-movement-row" key={movement.row_key || movement.id}>
                            <span className="annual-movement-description" title={`${movement.description} - ${movement.type}`}>
                              <i className={`annual-type-dot ${movement.type === "Ingreso" ? "income" : "expense"}`} />
                              <span>{movement.description}</span>
                            </span>
                            <strong className={Number(movement.amount) >= 0 ? "income-text" : "expense-text"}>{formatCurrency(movement.amount)}</strong>
                          </div>
                        ))}
                        {!rows.length && <div className="annual-movement-empty">Sin movimientos</div>}
                        {rows.length > 12 && <div className="annual-movement-empty">+ {rows.length - 12} movimientos mas</div>}
                      </div>
                    </div>
                  );
                })}
              </section>
            </article>
          );
        })}
      </div>
    </section>
  );
}
