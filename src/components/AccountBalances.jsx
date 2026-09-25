import { calculateAccountLedger, formatCurrency } from "../lib/finance";
import { getAccountColorStyle } from "../lib/colors";

export function AccountBalances({ accounts, movements, year, month, className = "" }) {
  const ledger = calculateAccountLedger(movements, year, month, accounts);
  const confirmedLedger = calculateAccountLedger(
    movements.filter((item) => item.status === "Confirmado"),
    year,
    month,
    accounts
  );

  return (
    <section className={["balance-list", className].filter(Boolean).join(" ")}>
      <h2>Cuentas</h2>
      {accounts.filter((account) => account.type !== "tarjeta_credito").map((account) => {
        const opening = ledger.opening[account.name] || 0;
        const monthNet = ledger.monthNet[account.name] || 0;
        const balance = ledger.closing[account.name] || 0;
        const confirmedBalance = confirmedLedger.closing[account.name] || 0;
        const isCard = account.type === "tarjeta_credito";
        return (
          <article className="account-balance" key={account.name} style={getAccountColorStyle(account.color, "#ffffff")}>
            <header>
              <span>
                {account.name}
                <small>{isCard ? "Tarjeta" : account.type === "ahorro" ? "Ahorro" : "Principal"}</small>
              </span>
              <div className="account-balance-amount">
                <strong className={balance >= 0 ? "income-text" : "expense-text"}>{formatCurrency(balance)}</strong>
                <span className="account-balance-confirmed">Confirmado {formatCurrency(confirmedBalance)}</span>
              </div>
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
