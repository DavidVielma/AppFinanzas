import { Plus, Trash2 } from "lucide-react";
import { ColorPicker } from "./ColorPicker";
import { formatCurrency } from "../lib/finance";
import { getAccountColorStyle } from "../lib/colors";

const colorOptions = [
  { label: "Verde", value: "#cfe9d8" },
  { label: "Azul", value: "#d7e7ff" },
  { label: "Amarillo", value: "#fde68a" },
  { label: "Rojo", value: "#ffd6d6" },
  { label: "Gris", value: "#e2e8f0" },
  { label: "Morado", value: "#e9d5ff" },
  { label: "Cian", value: "#cceff2" },
  { label: "Naranja", value: "#fed7aa" }
];

export function CreditCardManager({ accounts, cardPaymentTotals, cardPaymentStats = {}, draft, onDraftChange, onCreate, onDelete }) {
  const cards = accounts.filter((account) => account.type === "tarjeta_credito");

  return (
    <section className="card-manager">
      <div className="section-heading compact-heading">
        <div>
          <h2>Tarjetas</h2>
          <p>Administra tarjetas de credito</p>
        </div>
      </div>
      <form className="card-form" onSubmit={onCreate}>
        <label>
          Nombre
          <input value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} placeholder="Ej: Visa Santander" required />
        </label>
        <label>
          Color
          <ColorPicker value={draft.color} onChange={(color) => onDraftChange({ ...draft, color })} presets={colorOptions} compact showHex={false} />
        </label>
        <button type="submit" className="primary-action">
          <Plus size={16} />
          Crear
        </button>
      </form>
      <div className="card-list">
        {cards.map((card) => {
          const stats = cardPaymentStats[card.name] || {};
          return (
            <article className="credit-card-row" key={card.name} style={getAccountColorStyle(card.color)}>
              <div>
                <strong>{card.name}</strong>
                <span>Pendiente {formatCurrency(-(cardPaymentTotals[card.name] || 0))}</span>
                {stats.payments > 0 && <small>Pagado este mes {formatCurrency(stats.payments)}</small>}
              </div>
              <button type="button" className="icon-button danger" onClick={() => onDelete(card)} aria-label={`Eliminar ${card.name}`}>
                <Trash2 size={16} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
