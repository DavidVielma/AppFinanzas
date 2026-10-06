import { useState } from "react";
import { Archive, ArchiveRestore, ChevronDown, ChevronUp, GripVertical, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { ColorPicker } from "./ColorPicker";

const accountTypeOptions = [
  { value: "principal", label: "Cuenta" },
  { value: "tarjeta_credito", label: "Tarjeta" }
];

function TypeSwitch({ name, value, defaultValue, onChange, disabled = false }) {
  const controlled = value !== undefined;
  return (
    <div className={`account-type-switch ${disabled ? "disabled" : ""}`} role="radiogroup" aria-label="Tipo">
      {accountTypeOptions.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            disabled={disabled}
            {...(controlled ? { checked: value === option.value, onChange: () => onChange?.(option.value) } : { defaultChecked: defaultValue === option.value })}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

export function AccountAdminModal({ accounts, hasMovements, accountDraft, onDraftChange, colorOptions, onCreate, onUpdate, onReorder, onDelete, onClose }) {
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState("");
  const [drag, setDrag] = useState(null);
  const [overName, setOverName] = useState("");

  const groups = [
    { key: "accounts", title: "Cuentas", items: accounts.filter((account) => account.type !== "tarjeta_credito"), empty: "Aún no tienes cuentas." },
    { key: "cards", title: "Tarjetas de crédito", items: accounts.filter((account) => account.type === "tarjeta_credito"), empty: "Aún no tienes tarjetas." }
  ];

  async function submitCreate(event) {
    const created = await onCreate(event);
    if (created) setCreating(false);
  }

  function moveWithinGroup(names, name, direction) {
    const index = names.indexOf(name);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= names.length) return;
    const next = [...names];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
  }

  function dropOn(group, targetName) {
    const names = group.items.map((account) => account.name);
    if (drag && drag.group === group.key && drag.name !== targetName) {
      const next = names.filter((name) => name !== drag.name);
      next.splice(names.indexOf(targetName), 0, drag.name);
      onReorder(next);
    }
    setDrag(null);
    setOverName("");
  }

  function statusOf(account) {
    if (account.archived) return { label: "Archivada", className: "archived" };
    if (hasMovements(account.name)) return { label: "Con movimientos", className: "has-movements" };
    return { label: "Sin movimientos", className: "" };
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel account-admin-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
        <header className="modal-header">
          <div>
            <h2 id="account-modal-title">Cuentas y tarjetas</h2>
            <p>Elige dónde registras tus movimientos y en qué orden se ven.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <details className="account-help">
          <summary>¿Cómo funciona?</summary>
          <p>Las cuentas suman ingresos, egresos y transferencias. Las tarjetas registran compras y se pagan con el flujo Pago Tarjeta. Archivar oculta una cuenta en los meses donde no tiene movimientos, así conservas su historial. Para ordenar usa las flechas{" "}o, en computador, arrastra desde el asa.</p>
        </details>

        {creating ? (
          <form className="account-create-card" onSubmit={submitCreate}>
            <strong>Nueva cuenta o tarjeta</strong>
            <label className="account-field">
              Nombre
              <input value={accountDraft.name} onChange={(event) => onDraftChange({ ...accountDraft, name: event.target.value })} placeholder="Ej: Cuenta viaje" required autoFocus />
            </label>
            <div className="account-field">
              Tipo
              <TypeSwitch name="new-account-type" value={accountDraft.type} onChange={(type) => onDraftChange({ ...accountDraft, type })} />
            </div>
            <div className="account-field">
              Color
              <ColorPicker value={accountDraft.color} onChange={(color) => onDraftChange({ ...accountDraft, color })} presets={colorOptions} />
            </div>
            <div className="account-edit-actions">
              <button type="submit" className="primary-action">
                <Plus size={18} />
                Crear
              </button>
              <button type="button" className="ghost-action" onClick={() => setCreating(false)}>Cancelar</button>
            </div>
          </form>
        ) : (
          <button type="button" className="primary-action account-new-button" onClick={() => setCreating(true)}>
            <Plus size={18} />
            Nueva cuenta o tarjeta
          </button>
        )}

        {groups.map((group) => {
          const names = group.items.map((account) => account.name);
          return (
            <section className="account-group" key={group.key}>
              <h3>
                {group.title}
                <span>{group.items.length}</span>
              </h3>
              {!group.items.length && <p className="account-group-empty">{group.empty}</p>}
              <div className="account-group-list">
                {group.items.map((account, index) => {
                  const status = statusOf(account);
                  const isExpanded = expanded === account.name;
                  const canDelete = !account.locked && !hasMovements(account.name);
                  return (
                    <article
                      className={["account-admin-item", isExpanded ? "expanded" : "", account.archived ? "archived" : "", drag?.name === account.name ? "dragging" : "", overName === account.name && drag?.name !== account.name ? "drag-over" : ""].filter(Boolean).join(" ")}
                      key={account.name}
                      style={{ "--account-color": account.color || "#94a3b8" }}
                      onDragOver={(event) => {
                        if (drag && drag.group === group.key) {
                          event.preventDefault();
                          setOverName(account.name);
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        dropOn(group, account.name);
                      }}
                    >
                      <div className="account-admin-summary">
                        <span
                          className="account-drag-handle"
                          draggable
                          title="Arrastra para ordenar"
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", account.name);
                            event.dataTransfer.setDragImage(event.currentTarget.closest(".account-admin-item"), 24, 24);
                            setDrag({ name: account.name, group: group.key });
                          }}
                          onDragEnd={() => {
                            setDrag(null);
                            setOverName("");
                          }}
                        >
                          <GripVertical size={18} />
                        </span>
                        <button type="button" className="account-admin-main" onClick={() => setExpanded(isExpanded ? "" : account.name)} aria-expanded={isExpanded}>
                          <span className="account-swatch" />
                          <span className="account-admin-name">
                            <strong>{account.name}</strong>
                            <small>
                              {account.type === "tarjeta_credito" ? "Tarjeta" : "Cuenta"}
                              <span className={`account-chip ${status.className}`}>{status.label}</span>
                            </small>
                          </span>
                          <Pencil className="account-chevron" size={16} />
                        </button>
                        <div className="account-reorder" aria-label={`Ordenar ${account.name}`}>
                          <button type="button" className="icon-button" onClick={() => moveWithinGroup(names, account.name, -1)} disabled={index === 0} aria-label={`Subir ${account.name}`}>
                            <ChevronUp size={16} />
                          </button>
                          <button type="button" className="icon-button" onClick={() => moveWithinGroup(names, account.name, 1)} disabled={index === group.items.length - 1} aria-label={`Bajar ${account.name}`}>
                            <ChevronDown size={16} />
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <form
                          className="account-admin-edit"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const form = new FormData(event.currentTarget);
                            onUpdate(account, {
                              name: String(form.get("name") || account.name),
                              type: String(form.get("type") || account.type),
                              color: String(form.get("color") || account.color)
                            });
                          }}
                        >
                          <label className="account-field">
                            Nombre
                            <input name="name" defaultValue={account.name} required />
                          </label>
                          <div className="account-field">
                            Tipo
                            <TypeSwitch name="type" defaultValue={account.type === "ahorro" ? "principal" : account.type} disabled={account.locked} />
                          </div>
                          <div className="account-field">
                            Color
                            <ColorPicker defaultValue={account.color || "#e2e8f0"} presets={colorOptions} />
                          </div>
                          <div className="account-edit-actions">
                            <button type="submit" className="primary-action">
                              <Save size={16} />
                              Guardar
                            </button>
                            <button type="button" className="ghost-action" onClick={() => onUpdate(account, { archived: !account.archived })}>
                              {account.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                              {account.archived ? "Restaurar" : "Archivar"}
                            </button>
                            {canDelete && (
                              <button type="button" className="ghost-action danger-action" onClick={() => onDelete(account)}>
                                <Trash2 size={16} />
                                Eliminar
                              </button>
                            )}
                          </div>
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </section>
    </div>
  );
}
