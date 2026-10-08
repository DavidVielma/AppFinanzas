import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, getCurrentPeriod, monthLabels } from "../lib/finance";
import { hasSupabaseConfig, supabase } from "../lib/supabase";
import { shiftPeriod } from "../lib/movementSeries";

function getStatusClass(status) {
  if (status === "Confirmado") return "confirmed";
  if (status === "Pendiente") return "pending";
  return "projected";
}

function readInitialPeriod(search) {
  const current = getCurrentPeriod();
  const year = Number(search.get("year"));
  const month = Number(search.get("month"));

  return {
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : current.year,
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : current.month
  };
}

function getMovementLabel(movement) {
  if (movement.flow === "Transferencia" && movement.counterpart) {
    return movement.amount >= 0 ? `Desde ${movement.counterpart}` : `Hacia ${movement.counterpart}`;
  }

  return movement.category;
}

function usePreferredTheme(search) {
  useEffect(() => {
    const forced = search.get("tema");
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme = forced === "oscuro" ? "dark" : forced === "claro" ? "light" : media?.matches ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
    };

    apply();
    media?.addEventListener?.("change", apply);
    return () => media?.removeEventListener?.("change", apply);
  }, [search]);
}

export function SharedAccountView() {
  const search = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = search.get("clave") || "";
  const [period, setPeriod] = useState(() => readInitialPeriod(search));
  const [ledger, setLedger] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  usePreferredTheme(search);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setError("La app no tiene Supabase configurado.");
      setLoading(false);
      return;
    }

    if (!token) {
      setError("Falta la clave de acceso en el enlace.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    supabase
      .rpc("get_shared_account_ledger", { p_token: token, p_year: period.year, p_month: period.month })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;
        if (rpcError) {
          setError(rpcError.message.includes("Clave invalida") ? "La clave de acceso no es valida." : "No se pudo cargar la cuenta.");
          setLedger(null);
        } else {
          setError("");
          setLedger(data);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, period.year, period.month]);

  const totals = useMemo(() => {
    const movements = ledger?.movements || [];
    const income = movements.filter((movement) => movement.amount > 0).reduce((sum, movement) => sum + Number(movement.amount), 0);
    const expense = movements.filter((movement) => movement.amount < 0).reduce((sum, movement) => sum + Number(movement.amount), 0);
    const opening = Number(ledger?.opening || 0);
    const net = income + expense;

    return { opening, income, expense, net, closing: opening + net };
  }, [ledger]);

  const movePeriod = (offset) => setPeriod((current) => shiftPeriod(current.year, current.month, offset));
  const title = ledger?.title || "Cuenta";

  return (
    <main className="shared-account">
      <header className="shared-account-header">
        <div>
          <span className="shared-account-kicker">Movimientos de la cuenta</span>
          <h1>{title}</h1>
        </div>
        <div className="shared-account-period">
          <button type="button" className="shared-account-nav" onClick={() => movePeriod(-1)} aria-label="Mes anterior">
            <ChevronLeft size={18} />
          </button>
          <strong>
            {monthLabels[period.month - 1]} {period.year}
          </strong>
          <button type="button" className="shared-account-nav" onClick={() => movePeriod(1)} aria-label="Mes siguiente">
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {error ? (
        <p className="shared-account-message">{error}</p>
      ) : (
        <>
          <section className="shared-account-totals" aria-busy={loading}>
            <div>
              <span>Saldo inicio de mes</span>
              <strong>{formatCurrency(totals.opening)}</strong>
            </div>
            <div className="positive">
              <span>Ingresos del mes</span>
              <strong>{formatCurrency(totals.income)}</strong>
            </div>
            <div className="negative">
              <span>Egresos del mes</span>
              <strong>{formatCurrency(totals.expense)}</strong>
            </div>
            <div className={totals.net >= 0 ? "positive" : "negative"}>
              <span>Neto del mes</span>
              <strong>{formatCurrency(totals.net)}</strong>
            </div>
            <div className="highlight">
              <span>Saldo acumulado</span>
              <strong>{formatCurrency(totals.closing)}</strong>
            </div>
          </section>

          <section className="shared-account-list">
            {loading && !ledger ? (
              <p className="shared-account-message">Cargando...</p>
            ) : ledger?.movements?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Descripcion</th>
                    <th>Detalle</th>
                    <th>Estado</th>
                    <th className="amount">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.movements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{movement.description}</td>
                      <td className="muted">{getMovementLabel(movement)}</td>
                      <td>
                        <span className={`status-pill ${getStatusClass(movement.status)}`}>{movement.status}</span>
                      </td>
                      <td className={`amount ${movement.amount >= 0 ? "positive" : "negative"}`}>{formatCurrency(movement.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total del mes</td>
                    <td className={`amount ${totals.net >= 0 ? "positive" : "negative"}`}>{formatCurrency(totals.net)}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="shared-account-message">Sin movimientos en este mes.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
