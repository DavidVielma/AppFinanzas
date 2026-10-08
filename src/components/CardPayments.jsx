import { Check } from "lucide-react";
import { formatCurrency } from "../lib/finance";
import { getAccountColorToken } from "./AccountLedgerSections";

const stateLabels = { paid: "Pagado", scheduled: "Programado", due: "Pagar", clear: "Sin deuda" };

// Pago de cada tarjeta en el mes: monto, estado y la cuenta desde la que se paga.
export function CardPayments({ accounts, movements, cardPaymentTotals, cardFullPaymentTotals = {}, onEdit, onQuickPay, className = "" }) {
  const creditCards = accounts.filter((account) => account.type === "tarjeta_credito");
  if (!creditCards.length) return null;

  const paymentByCard = Object.fromEntries(
    movements
      .filter((movement) => movement.flow === "Pago Tarjeta" && movement.target_account)
      .map((movement) => [movement.target_account, movement])
  );

  return (
    <section className={["balance-list", "card-payments", className].filter(Boolean).join(" ")}>
      <h2>Pagos de tarjeta</h2>
      <div className="payment-strip-list">
        {creditCards.map((card) => {
          const amount = cardFullPaymentTotals[card.name] || cardPaymentTotals[card.name] || 0;
          const payment = paymentByCard[card.name];
          const paymentAmount = payment ? Math.abs(Number(payment.amount) || 0) : amount;
          const state = payment ? (payment.status === "Confirmado" ? "paid" : "scheduled") : amount ? "due" : "clear";
          const detail = payment ? `Desde ${payment.account}` : amount ? "Sin pago registrado" : "Nada que pagar";
          return (
            <button
              type="button"
              className={`payment-strip-row ${state}`}
              key={card.name}
              onClick={() => payment ? onEdit(payment) : onQuickPay(card, amount)}
              disabled={state === "clear"}
              aria-label={payment ? `Editar pago de ${card.name}` : `Pagar ${card.name}`}
            >
              <span className="payment-strip-dot" style={{ background: getAccountColorToken(card).accent }} aria-hidden="true" />
              <span className="payment-strip-name">
                <strong>{card.name}</strong>
                <small>{detail}</small>
              </span>
              <span className="payment-strip-amount">{formatCurrency(paymentAmount)}</span>
              <span className="payment-strip-state">
                {state === "paid" && <Check size={13} aria-hidden="true" />}
                {stateLabels[state]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
