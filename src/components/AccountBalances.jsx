import { calculateAccountLedger, formatCurrency } from "../lib/finance";

export function AccountBalances({ accounts, movements, year, month }) {
  const ledger = calculateAccountLedger(movements, year, month, accounts);

  return (
    <section className="balance-list">
      <h2>Cuentas</h2>
      {accounts.filter((account) => account.type !== "tarjeta_credito").map((account) => {
        const opening = ledger.opening[account.name] || 0;
        const monthNet = ledger.monthNet[account.name] || 0;
        const balance = ledger.closing[account.name] || 0;
        const isCard = account.type === "tarjeta_credito";
        return (
          <article className="account-balance" key={account.name} style={{ backgroundColor: account.color || "#ffffff" }}>
            <header>
              <span>
                {account.name}
                <small>{isCard ? "Tarjeta" : account.type === "ahorro" ? "Ahorro" : "Principal"}</small>
              </span>
              <strong className={balance >= 0 ? "income-text" : "expense-text"}>{formatCurrency(balance)}</strong>
            </header>
            <dl>
              <div>
                <dt>Inicial</dt>
                <dd>{formatCurrency(opening)}</dd>
              </div>
              <div>
                <dt>Mes</dt>
                <dd>{formatCurrency(monthNet)}</dd>
              </div>
            </dl>
          </article>
        );
      })}
    </section>
  );
}
