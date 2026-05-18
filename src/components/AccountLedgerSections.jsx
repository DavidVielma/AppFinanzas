import { Plus } from "lucide-react";
import { formatCurrency } from "../lib/finance";
import { MovementTable } from "./MovementTable";

function getVisibleSortValue(movement) {
  return Number(movement.visible_sort_order ?? movement.sort_order) || Date.parse(movement.created_at || "") || 0;
}

function sortVisibleRows(a, b) {
  return getVisibleSortValue(a) - getVisibleSortValue(b) || String(a.id).localeCompare(String(b.id));
}

export function AccountLedgerSections({ accounts, cardPaymentTotals, movements, allMovements = movements, currentResponsible, filterMovement, onEdit, onDelete, onStatusChange, onMove, onQuickAdd, onQuickPay }) {
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
    allMovements
      .filter((movement) => movement.flow === "Pago Tarjeta" && movement.target_account)
      .map((movement) => [movement.target_account, movement])
  );

  function renderAccount(account) {
    const rows = [...(grouped[account.name] || [])].filter((movement) => !filterMovement || filterMovement(movement)).sort(sortVisibleRows);
    const rowsWithMoveState = rows.map((movement) => {
      const visibleIndex = rows.findIndex((item) => (item.row_key || item.id) === (movement.row_key || movement.id));
      return {
        ...movement,
        display_account: movement.display_account || account.name,
        canMoveUp: visibleIndex > 0,
        canMoveDown: visibleIndex >= 0 && visibleIndex < rows.length - 1
      };
    });
    const total = rows.reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
    const isCard = account.type === "tarjeta_credito";
    const displayTotal = isCard ? -(cardPaymentTotals[account.name] || 0) : total;
    const isPrincipal = account.name === "Principal";
    const accountAccent = isPrincipal ? "#155e63" : account.color || "#d8e3e1";

    return (
      <section className={`account-section ${isPrincipal ? "principal-account-section" : ""}`} key={account.name} style={{ "--account-accent": accountAccent }}>
        <header className="account-section-header" style={{ backgroundColor: account.color || "#f8fafc" }}>
          <div>
            <h3>{account.name}</h3>
            <span>{account.type === "tarjeta_credito" ? "Movimientos de tarjeta" : "Movimientos de cuenta"}</span>
          </div>
          <div className="account-section-actions">
            <strong className={displayTotal >= 0 ? "income-text" : "expense-text"}>{formatCurrency(displayTotal)}</strong>
            {isCard && (
              <button type="button" className="icon-text" onClick={() => onQuickPay(account, cardPaymentTotals[account.name] || 0)} disabled={!cardPaymentTotals[account.name] || Boolean(paymentByCard[account.name])}>
                Pagar
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
        {account.name === "Principal" && (
          <div className="principal-payment-strip">
            <strong>Pagos dinamicos de tarjeta</strong>
            <div>
              {creditCards.map((card) => {
                const amount = cardPaymentTotals[card.name] || 0;
                const hasPayment = Boolean(paymentByCard[card.name]);
                return (
                  <button type="button" className="icon-text" key={card.name} onClick={() => onQuickPay(card, amount)} disabled={!amount || hasPayment}>
                    {card.name}: {formatCurrency(amount)}{hasPayment ? " registrado" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <MovementTable movements={rowsWithMoveState} currentResponsible={currentResponsible} onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange} onMove={onMove} />
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
