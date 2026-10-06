import { Archive, ArchiveRestore, Plus, Trash2, X } from "lucide-react";

export function ResponsibleAdminModal({ responsibles, usageCount, draft, onDraftChange, onCreate, onArchive, onDelete, onClose }) {
  const active = responsibles.filter((responsible) => !responsible.archived);
  const archived = responsibles.filter((responsible) => responsible.archived);

  function renderRow(responsible) {
    const count = usageCount(responsible.name);
    return (
      <div className={`responsible-row ${responsible.archived ? "archived" : ""}`} key={responsible.name}>
        <span className="responsible-row-name">
          <strong>{responsible.name}</strong>
          <small>{count ? `${count} ${count === 1 ? "movimiento" : "movimientos"}` : "Sin movimientos"}</small>
        </span>
        <button type="button" className="ghost-action" onClick={() => onArchive(responsible, !responsible.archived)}>
          {responsible.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          {responsible.archived ? "Restaurar" : "Archivar"}
        </button>
        {!count && (
          <button type="button" className="icon-button danger" onClick={() => onDelete(responsible)} aria-label={`Eliminar ${responsible.name}`}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel responsible-admin-modal" role="dialog" aria-modal="true" aria-labelledby="responsible-modal-title">
        <header className="modal-header">
          <div>
            <h2 id="responsible-modal-title">Responsables</h2>
            <p>Solo los activos aparecen al registrar movimientos. Los archivados conservan su historial.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <form className="responsible-form" onSubmit={onCreate}>
          <input value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder="Ej: David, Krish, Casa" />
          <button type="submit" className="primary-action">
            <Plus size={18} />
            Agregar
          </button>
        </form>
        <section className="account-group">
          <h3>
            Activos
            <span>{active.length}</span>
          </h3>
          {!active.length && <p className="account-group-empty">Aún no tienes responsables activos.</p>}
          <div className="responsible-rows">{active.map(renderRow)}</div>
        </section>
        {archived.length > 0 && (
          <section className="account-group">
            <h3>
              Archivados
              <span>{archived.length}</span>
            </h3>
            <div className="responsible-rows">{archived.map(renderRow)}</div>
          </section>
        )}
      </section>
    </div>
  );
}
