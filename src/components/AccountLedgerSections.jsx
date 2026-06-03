import { Plus } from "lucide-react";
import { formatCurrency, getCreditCardPaymentCoverage } from "../lib/finance";
import { getMutedTextColor, getReadableTextColor } from "../lib/colors";
import { MovementTable } from "./MovementTable";

function getVisibleSortValue(movement) {
  return Number(movement.visible_sort_order ?? movement.sort_order) || Date.parse(movement.created_at || "") || 0;
}

function sortVisibleRows(a, b) {
  return getVisibleSortValue(a) - getVisibleSortValue(b) || String(a.id).localeCompare(String(b.id));
}

const accountColorTokens = {
  "#f8fafc": { fill: "#e2e8f0", accent: "#64748b" },
  "#e2e8f0": { fill: "#e2e8f0", accent: "#64748b" },
  "#f3f8ef": { fill: "#d8efc8", accent: "#4d7c0f" },
  "#edf8ef": { fill: "#cfecd8", accent: "#15803d" },
  "#cfe9d8": { fill: "#cfe9d8", accent: "#15803d" },
  "#eef5ff": { fill: "#d7e8ff", accent: "#2563eb" },
  "#d7e7ff": { fill: "#d7e7ff", accent: "#2563eb" },
  "#fff8df": { fill: "#fde68a", accent: "#b45309" },
  "#fde68a": { fill: "#fde68a", accent: "#b45309" },
  "#fff0f0": { fill: "#ffd6d6", accent: "#dc2626" },
  "#ffd6d6": { fill: "#ffd6d6", accent: "#dc2626" },
  "#e9d5ff": { fill: "#e9d5ff", accent: "#7e22ce" },
  "#cceff2": { fill: "#cceff2", accent: "#0e7490" },
  "#fed7aa": { fill: "#fed7aa", accent: "#c2410c" }
};

function getAccountColorToken(account) {
  const color = String(account.color || "").toLowerCase();
  return accountColorTokens[color] || { fill: account.color || "#e2e8f0", accent: account.color || "#64748b" };
}

export function AccountLedgerSections({ accounts, cardPaymentTotals, cardFullPaymentTotals = {}, cardPaymentStats = {}, movements, allMovements = movements, currentResponsible, filterMovement, hasActiveFilters = false, onEdit, onDelete, onStatusChange, onMove, onQuickAdd, onQuickPay, onOpenTcDetail }) {
  const visibleAccounts = accounts.filter((account) => account.name !== "Otros");
  const accountsByName = Object.fromEntries(visibleAccounts.map((account) => [account.name, account]));
  const grouped = visibleAccounts.reduce((acc, account) => {
    acc[account.name] = [];
    return acc;
  }, {});

  movements.forEach((movement) => {
    const account = movement.account || "Principal";
    if (!grouped[account]) {
      grouped[account] = [];
    }
    grouped[account].push(movement);

    if (movement.flow === "Transferencia" && movement.target_account) {
      if (!grouped[movement.target_account]) {
        grouped[movement.target_account] = [];
      }

      grouped[movement.target_account].push({
        ...movement,
        row_key: `${movement.id}-target`,
        account: movement.target_account,
        target_account: null,
        type: "Ingreso",
        amount: Math.abs(Number(movement.amount) || 0),
        description: `Transferencia recibida: ${movement.description}`,
        display_account: movement.target_account,
        visible_sort_order: movement.target_sort_order ?? movement.sort_order,
        source_movement: movement
      });
    }
  });

  const mainAccounts = visibleAccounts.filter((account) => account.type !== "tarjeta_credito");
  const creditCards = visibleAccounts.filter((account) => account.type === "tarjeta_credito");
  const paymentByCard = Object.fromEntries(
    movements
      .filter((movement) => movement.flow === "Pago Tarjeta" && movement.target_account)
      .map((movement) => [movement.target_account, movement])
  );

  function renderAccount(account) {
    const rows = [...(grouped[account.name] || [])].filter((movement) => !filterMovement || filterMovement(movement)).sort(sortVisibleRows);
    const rowsWithMoveState = rows.map((movement) => {
      const visibleIndex = rows.findIndex((item) => (item.row_key || item.id) === (movement.row_key || movement.id));
      const paymentCoverage = getCreditCardPaymentCoverage(movement.source_movement || movement, allMovements, accounts);
      return {
        ...movement,
        display_account: movement.display_account || account.name,
        canMoveUp: visibleIndex > 0,
        canMoveDown: visibleIndex >= 0 && visibleIndex < rows.length - 1,
        payment_badge: paymentCoverage?.label || null,
        payment_badge_mode: paymentCoverage?.mode || null
      };
    });
    const total = rows.reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
    const isCard = account.type === "tarjeta_credito";
    const cardStats = cardPaymentStats[account.name];
    const displayTotal = isCard && !hasActiveFilters ? -(cardStats?.monthCharges || 0) : total;
    const registeredPayment = paymentByCard[account.name];
    const isPrincipal = account.name === "Principal";
    const colorToken = getAccountColorToken(account);
    const accountAccent = isPrincipal ? "#155e63" : colorToken.accent;
    const accountFill = isPrincipal ? "#d8efed" : colorToken.fill;
    const accountInk = getReadableTextColor(accountFill);
    const accountMutedInk = getMutedTextColor(accountFill);

    return (
      <section className={`account-section ${isPrincipal ? "principal-account-section" : ""}`} key={account.name} style={{ "--account-accent": accountAccent, "--account-fill": accountFill, "--account-ink": accountInk, "--account-muted-ink": accountMutedInk }}>
        <header className="account-section-header">
          <div>
            <h3>{account.name}</h3>
            <span>{account.type === "tarjeta_credito" ? "Movimientos de tarjeta" : "Movimientos de cuenta"}</span>
          </div>
          <div className="account-section-actions">
            <strong className={displayTotal >= 0 ? "income-text" : "expense-text"}>{formatCurrency(displayTotal)}</strong>
            {isCard && (
              <button type="button" className="icon-text" onClick={() => registeredPayment ? onEdit(registeredPayment) : onQuickPay(account, cardFullPaymentTotals[account.name] || cardPaymentTotals[account.name] || 0)} disabled={!cardFullPaymentTotals[account.name] && !cardPaymentTotals[account.name] && !registeredPayment}>
                {registeredPayment ? "Editar pago" : "Pagar"}
              </button>
            )}
            {!account.archived && (
              <button type="button" className="icon-text" onClick={() => onQuickAdd(account)}>
                <Plus size={16} />
                Agregar
              </button>
            )}
          </div>
        </header>
        {isCard && cardStats && !hasActiveFilters && (
          <div className="credit-card-payment-summary">
            <span>Total consumos: <strong>{formatCurrency(-cardStats.monthCharges)}</strong></span>
            <span>Saldo anterior: <strong>{formatCurrency(-cardStats.openingDebt)}</strong></span>
            <span>Pagado: <strong>{formatCurrency(cardStats.payments)}</strong></span>
            <span>Pendiente: <strong>{formatCurrency(-cardStats.pending)}</strong></span>
          </div>
        )}
        {account.name === "Principal" && (
          <div className="principal-payment-strip">
            <strong>Pagos de tarjeta</strong>
            <div>
              {creditCards.map((card) => {
                const amount = cardFullPaymentTotals[card.name] || cardPaymentTotals[card.name] || 0;
                const payment = paymentByCard[card.name];
                return (
                  <button type="button" className="icon-text" key={card.name} onClick={() => payment ? onEdit(payment) : onQuickPay(card, amount)} disabled={!amount && !payment}>
                    {card.name}: {payment ? `pago ${formatCurrency(Math.abs(Number(payment.amount) || 0))}` : formatCurrency(amount)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <MovementTable movements={rowsWithMoveState} currentResponsible={currentResponsible} onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange} onMove={onMove} onOpenTcDetail={onOpenTcDetail} />
      </section>
    );
  }

  return (
    <div className="account-ledger">
      {mainAccounts.map(renderAccount)}
      <div className="credit-card-ledgers">
        <div className="subsection-heading">
          <h3>Tarjetas de credito</h3>
        </div>
        {creditCards.map((account) => renderAccount(accountsByName[account.name]))}
      </div>
    </div>
  );
}
