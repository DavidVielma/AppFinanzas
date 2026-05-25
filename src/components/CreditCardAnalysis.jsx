import { FileSearch, Loader2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency, monthLabels } from "../lib/finance";
import { extractPdfText, parseFalabellaStatement } from "../lib/tcAnalysis";

const TC_ANALYSIS_STORAGE_KEY = "finance-tc-analysis-import";

function createImportId() {
  return `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getPeriodFromAnalysis(analysis) {
  const parts = String(analysis?.billingDate || "").split("/");
  const month = Number(parts[1]) || new Date().getMonth() + 1;
  const year = Number(parts[2]) || new Date().getFullYear();
  return { month, year };
}

function buildImportRecord({ analysis, fileName, houseExpenseIds = [], id = createImportId(), name = "" }) {
  const period = getPeriodFromAnalysis(analysis);
  const importedAt = analysis?.importMeta?.importedAt || new Date().toISOString();
  const cleanName = name || String(fileName || analysis?.importMeta?.fileName || "Estado de cuenta").replace(/\.pdf$/i, "");

  return {
    id,
    name: cleanName,
    month: period.month,
    year: period.year,
    fileName: fileName || analysis?.importMeta?.fileName || cleanName,
    createdAt: importedAt,
    updatedAt: new Date().toISOString(),
    analysis: {
      ...analysis,
      importMeta: {
        ...(analysis?.importMeta || {}),
        fileName: fileName || analysis?.importMeta?.fileName || cleanName,
        importedAt
      }
    },
    houseExpenseIds
  };
}

function loadSavedImports() {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(TC_ANALYSIS_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);

    if (Array.isArray(parsed?.imports)) {
      return {
        imports: parsed.imports,
        activeImportId: parsed.activeImportId || parsed.imports[0]?.id || ""
      };
    }

    if (parsed?.analysis) {
      const legacyImport = buildImportRecord({
        analysis: parsed.analysis,
        houseExpenseIds: parsed.houseExpenseIds || []
      });
      return {
        imports: [legacyImport],
        activeImportId: legacyImport.id
      };
    }

    return null;
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return "-";
  const [day, month, year] = String(value).split("/");
  return day && month && year ? `${day}-${month}-${year}` : value;
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function movementMatchesSearch(movement, query) {
  if (!query) return true;
  return normalizeSearchText([
    movement.description,
    movement.location,
    movement.section,
    movement.userCode,
    movement.userLabel,
    movement.date,
    movement.amount
  ].join(" ")).includes(query);
}

function summarizeMovements(movements, key, getLabel) {
  const groups = new Map();

  movements.forEach((movement) => {
    const groupKey = movement[key] || "Sin clasificar";
    const current = groups.get(groupKey) || {
      key: groupKey,
      label: getLabel(groupKey, movement),
      count: 0,
      total: 0
    };

    current.count += 1;
    current.total += movement.amount;
    groups.set(groupKey, current);
  });

  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

export function CreditCardAnalysis({ accounts = [], defaultYear, defaultMonth, onCreateUserSummaryMovements, focusRequest }) {
  const savedState = useMemo(() => loadSavedImports(), []);
  const [imports, setImports] = useState(() => savedState?.imports || []);
  const [activeImportId, setActiveImportId] = useState("");
  const [status, setStatus] = useState(() => (savedState?.imports?.length ? "done" : "idle"));
  const [message, setMessage] = useState(() => (savedState?.imports?.length ? "Importaciones guardadas cargadas correctamente." : ""));
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const activeImport = useMemo(
    () => imports.find((item) => item.id === activeImportId) || null,
    [activeImportId, imports]
  );
  const analysis = activeImport?.analysis || null;
  const houseExpenseIds = activeImport?.houseExpenseIds || [];
  const creditCardAccounts = accounts.filter((account) => account.type === "tarjeta_credito");
  const [syncDraft, setSyncDraft] = useState(() => ({
    account: "",
    month: defaultMonth || new Date().getMonth() + 1,
    year: defaultYear || new Date().getFullYear()
  }));
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = new Set([currentYear - 1, currentYear, currentYear + 1]);
    imports.forEach((item) => years.add(Number(item.year) || currentYear));
    return Array.from(years).sort((a, b) => b - a);
  }, [imports]);

  const searchQuery = normalizeSearchText(searchTerm);

  const filteredMovements = useMemo(() => {
    if (!analysis?.movements) return [];
    return analysis.movements.filter((movement) => {
      const matchesUser = selectedUser ? movement.userCode === selectedUser : true;
      const matchesSection = selectedSection ? movement.section === selectedSection : true;
      const matchesSearch = movementMatchesSearch(movement, searchQuery);
      return matchesUser && matchesSection && matchesSearch;
    });
  }, [analysis, searchQuery, selectedSection, selectedUser]);

  const userSummary = useMemo(() => {
    if (!analysis?.movements) return [];
    const sectionMovements = analysis.movements.filter((movement) => {
      const matchesSection = selectedSection ? movement.section === selectedSection : true;
      return matchesSection && movementMatchesSearch(movement, searchQuery);
    });
    return summarizeMovements(sectionMovements, "userCode", (key, movement) => movement.userLabel || key);
  }, [analysis, searchQuery, selectedSection]);

  const fullUserSummary = useMemo(() => {
    if (!analysis?.movements) return [];
    return summarizeMovements(analysis.movements, "userCode", (key, movement) => movement.userLabel || key);
  }, [analysis]);

  const sectionSummary = useMemo(() => {
    if (!analysis?.movements) return [];
    const userMovements = analysis.movements.filter((movement) => {
      const matchesUser = selectedUser ? movement.userCode === selectedUser : true;
      return matchesUser && movementMatchesSearch(movement, searchQuery);
    });
    return summarizeMovements(userMovements, "section", (key) => key);
  }, [analysis, searchQuery, selectedUser]);

  const filteredTotal = filteredMovements.reduce((sum, movement) => sum + movement.amount, 0);
  const houseMovements = useMemo(() => {
    if (!analysis?.movements) return [];
    const selectedIds = new Set(houseExpenseIds);
    return analysis.movements.filter((movement) => selectedIds.has(movement.id));
  }, [analysis, houseExpenseIds]);
  const houseTotal = houseMovements.reduce((sum, movement) => sum + movement.amount, 0);

  useEffect(() => {
    if (!focusRequest || !imports.length) return;
    const requestedImportName = normalizeSearchText(focusRequest.importName);
    const requestedUser = normalizeSearchText(focusRequest.userLabel);
    const matchedImport = imports.find((item) => {
      const names = [item.name, item.fileName, item.analysis?.importMeta?.fileName].map(normalizeSearchText);
      return names.includes(requestedImportName);
    });

    if (!matchedImport) {
      setMessage(`No encontre la importacion TC "${focusRequest.importName}".`);
      return;
    }

    const matchedUser = (matchedImport.analysis?.movements || []).find((movement) =>
      normalizeSearchText(movement.userLabel) === requestedUser ||
      normalizeSearchText(movement.userCode) === requestedUser
    );

    setActiveImportId(matchedImport.id);
    setSelectedSection("");
    setSearchTerm("");
    setSelectedUser(matchedUser?.userCode || "");
    setMessage(`Detalle TC abierto para ${focusRequest.userLabel}.`);
  }, [focusRequest, imports]);

  useEffect(() => {
    if (!syncDraft.account && creditCardAccounts[0]?.name) {
      setSyncDraft((current) => ({ ...current, account: creditCardAccounts[0].name }));
    }
  }, [creditCardAccounts, syncDraft.account]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        TC_ANALYSIS_STORAGE_KEY,
        JSON.stringify({
          imports,
          activeImportId,
          savedAt: new Date().toISOString()
        })
      );
    } catch {
      setMessage("El analisis se completo, pero el navegador no pudo guardar las importaciones.");
    }
  }, [activeImportId, imports]);

  function resetFilters() {
    setSelectedUser("");
    setSelectedSection("");
    setSearchTerm("");
  }

  function updateImport(importId, changes) {
    setImports((current) =>
      current.map((item) =>
        item.id === importId
          ? { ...item, ...changes, updatedAt: new Date().toISOString() }
          : item
      )
    );
  }

  function selectImport(importId) {
    setActiveImportId(importId);
    resetFilters();
  }

  function deleteImport(importId) {
    setImports((current) => {
      const next = current.filter((item) => item.id !== importId);
      if (activeImport?.id === importId) {
        setActiveImportId("");
        resetFilters();
      }
      return next;
    });
  }

  function setActiveHouseExpenseIds(nextIds) {
    if (!activeImport) return;
    updateImport(activeImport.id, { houseExpenseIds: nextIds });
  }

  async function syncUserSummariesToMovements() {
    if (!activeImport || !onCreateUserSummaryMovements) return;
    const account = syncDraft.account || creditCardAccounts[0]?.name || "";
    if (!account) {
      setMessage("Crea o selecciona una tarjeta de credito para sincronizar el resumen.");
      return;
    }

    try {
      const result = await onCreateUserSummaryMovements({
        importRecord: activeImport,
        account,
        year: Number(syncDraft.year),
        month: Number(syncDraft.month),
        userSummaries: fullUserSummary
      });
      updateImport(activeImport.id, {
        syncMeta: {
          account,
          year: Number(syncDraft.year),
          month: Number(syncDraft.month),
          syncedAt: new Date().toISOString()
        }
      });
      setMessage(`Resumen sincronizado: ${result.created} creados, ${result.updated} actualizados.`);
    } catch (error) {
      setMessage(error?.message || "No fue posible sincronizar el resumen con movimientos.");
    }
  }

  function toggleHouseExpense(movementId) {
    const nextIds = houseExpenseIds.includes(movementId)
      ? houseExpenseIds.filter((id) => id !== movementId)
      : [...houseExpenseIds, movementId];
    setActiveHouseExpenseIds(nextIds);
  }

  async function analyzeFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("loading");
    setMessage("");
    resetFilters();

    try {
      const text = await extractPdfText(file);
      const result = parseFalabellaStatement(text);
      const nextAnalysis = {
        ...result,
        importMeta: {
          fileName: file.name,
          importedAt: new Date().toISOString()
        },
        sourceText: text
      };
      const nextImport = buildImportRecord({ analysis: nextAnalysis, fileName: file.name });
      setImports((current) => [nextImport, ...current]);
      setActiveImportId("");
      setStatus("done");
      setMessage(`${file.name} analizado y guardado correctamente. Abre la importacion desde la lista para ver el detalle.`);
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || "No fue posible analizar el PDF.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <section className="tc-analysis-view">
      <div className="dashboard-panel tc-upload-panel">
        <div className="section-heading">
          <div>
            <h2>Análisis TC</h2>
            <p>Sube un estado de cuenta PDF de Banco Falabella para separar movimientos por usuario.</p>
            {activeImport?.analysis?.importMeta && (
              <small className="tc-import-meta">
                Detalle abierto: {activeImport.name || activeImport.analysis.importMeta.fileName} - {monthLabels[(Number(activeImport.month) || 1) - 1]} {activeImport.year}
              </small>
            )}
          </div>
          <div className="tc-upload-actions">
            <label className="primary-action tc-upload-button">
              {status === "loading" ? <Loader2 size={18} className="spin-icon" /> : <UploadCloud size={18} />}
              Cargar PDF
              <input type="file" accept="application/pdf" onChange={analyzeFile} disabled={status === "loading"} />
            </label>
            {analysis && (
              <button type="button" className="ghost-action" onClick={() => setActiveImportId("")}>
                Volver a importaciones
              </button>
            )}
          </div>
        </div>
        {message && <div className={`inline-message ${status === "done" ? "success" : ""}`}>{message}</div>}
      </div>

      {imports.length > 0 && !analysis && (
        <div className="dashboard-panel tc-import-manager">
          <div className="section-heading compact-heading">
            <div>
              <h2>Importaciones guardadas</h2>
              <p>{imports.length} estados de cuenta disponibles para administrar.</p>
            </div>
          </div>
          <div className="tc-import-list">
            {imports.map((item) => (
              <article className={activeImport?.id === item.id ? "active" : ""} key={item.id}>
                <button type="button" className="tc-import-open" onClick={() => selectImport(item.id)}>
                  <span>{monthLabels[(Number(item.month) || 1) - 1]} {item.year}</span>
                  <strong>{item.name}</strong>
                  <small>{item.fileName} - {item.analysis?.movements?.length || 0} movimientos</small>
                </button>
                <div className="tc-import-fields">
                  <label>
                    Nombre
                    <input value={item.name} onChange={(event) => updateImport(item.id, { name: event.target.value })} />
                  </label>
                  <label>
                    Mes
                    <select value={item.month} onChange={(event) => updateImport(item.id, { month: Number(event.target.value) })}>
                      {monthLabels.map((label, index) => (
                        <option key={label} value={index + 1}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    AÃ±o
                    <select value={item.year} onChange={(event) => updateImport(item.id, { year: Number(event.target.value) })}>
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="tc-import-actions">
                  <button type="button" className="ghost-action" onClick={() => selectImport(item.id)} disabled={activeImport?.id === item.id}>
                    Ver
                  </button>
                  <button type="button" className="ghost-action danger" onClick={() => deleteImport(item.id)}>
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {!analysis && imports.length === 0 && (
        <div className="dashboard-panel tc-empty-panel">
          <FileSearch size={34} />
          <strong>Sin estado de cuenta cargado</strong>
          <span>El análisis queda solo en esta sesión local mientras hacemos pruebas.</span>
        </div>
      )}

      {analysis && (
        <>
          <div className="tc-summary-grid">
            <article className="summary-card">
              <span>Banco</span>
              <strong>{analysis.bank}</strong>
            </article>
            <article className="summary-card">
              <span>Facturación</span>
              <strong>{formatDate(analysis.billingDate)}</strong>
            </article>
            <article className="summary-card">
              <span>Periodo</span>
              <strong>{formatDate(analysis.period.from)} al {formatDate(analysis.period.to)}</strong>
            </article>
            <article className="summary-card">
              <span>Total operaciones</span>
              <strong>{formatCurrency(analysis.reconciliation.operationsTotal)}</strong>
            </article>
          </div>

          <div className="dashboard-panel tc-reconciliation-panel">
            <div className="section-heading compact-heading">
              <div>
                <h2>Conciliación del estado</h2>
                <p>Compara movimientos de la sección 2.1 contra cargos y abonos de la sección 2.3.</p>
              </div>
            </div>
            <div className="tc-reconciliation-grid">
              <div>
                <span>Operaciones 2.1</span>
                <strong>{formatCurrency(analysis.reconciliation.operationsTotal)}</strong>
              </div>
              <div>
                <span>Cargos / abonos 2.3</span>
                <strong className={analysis.reconciliation.adjustmentsTotal < 0 ? "income-text" : "expense-text"}>{formatCurrency(analysis.reconciliation.adjustmentsTotal)}</strong>
              </div>
              <div className="featured">
                <span>Total conciliado</span>
                <strong>{formatCurrency(analysis.reconciliation.reconciledTotal)}</strong>
              </div>
              <div className="featured">
                <span>Total facturado PDF</span>
                <strong>{formatCurrency(analysis.reconciliation.statementTotal)}</strong>
              </div>
              <div>
                <span>Diferencia</span>
                <strong className={Math.abs(analysis.reconciliation.difference) <= 10 ? "income-text" : "expense-text"}>{formatCurrency(analysis.reconciliation.difference)}</strong>
              </div>
              <div>
                <span>Movimientos</span>
                <strong>{analysis.movements.length}</strong>
              </div>
            </div>
            {analysis.adjustments.length > 0 && (
              <div className="tc-adjustment-list">
                {analysis.adjustments.map((adjustment) => (
                  <div key={adjustment.id}>
                    <span>{adjustment.type}</span>
                    <strong>{adjustment.description}</strong>
                    <small>{formatDate(adjustment.date)}</small>
                    <b className={adjustment.amount < 0 ? "income-text" : "expense-text"}>{formatCurrency(adjustment.amount)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dashboard-panel">
            <div className="section-heading compact-heading">
              <div>
                <h2>Resumen por usuario</h2>
                <p>{userSummary.length} usuarios en el filtro actual.</p>
              </div>
            </div>
            <div className="tc-user-summary">
              {userSummary.map((user) => (
                <button type="button" key={user.key} className={selectedUser === user.key ? "active" : ""} onClick={() => setSelectedUser((current) => (current === user.key ? "" : user.key))}>
                  <span>{user.key}</span>
                  <strong>{user.label}</strong>
                  <b>{formatCurrency(user.total)}</b>
                  <small>{user.count} movimientos</small>
                </button>
              ))}
              {!userSummary.length && <p className="empty-row">Sin usuarios para la sección seleccionada.</p>}
            </div>
          </div>

          <div className="dashboard-panel tc-sync-panel">
            <div className="section-heading compact-heading">
              <div>
                <h2>Enviar resumen a movimientos</h2>
                <p>Crea un egreso en la tarjeta seleccionada por cada usuario del estado de cuenta.</p>
              </div>
            </div>
            <div className="tc-sync-grid">
              <label>
                Tarjeta
                <select value={syncDraft.account} onChange={(event) => setSyncDraft((current) => ({ ...current, account: event.target.value }))}>
                  {creditCardAccounts.map((account) => (
                    <option key={account.name} value={account.name}>{account.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Mes
                <select value={syncDraft.month} onChange={(event) => setSyncDraft((current) => ({ ...current, month: Number(event.target.value) }))}>
                  {monthLabels.map((label, index) => (
                    <option key={label} value={index + 1}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                A&ntilde;o
                <input type="number" min="2000" max="2100" step="1" value={syncDraft.year} onChange={(event) => setSyncDraft((current) => ({ ...current, year: Number(event.target.value) }))} />
              </label>
              <button type="button" className="primary-action" onClick={syncUserSummariesToMovements} disabled={!fullUserSummary.length || !creditCardAccounts.length}>
                Sincronizar resumen
              </button>
            </div>
            <div className="tc-sync-preview">
              {fullUserSummary.map((user) => (
                <span key={user.key}>{user.key} - {formatCurrency(-Math.abs(user.total))}</span>
              ))}
            </div>
            {activeImport?.syncMeta && (
              <small className="tc-import-meta">
                Ultima sincronizacion: {activeImport.syncMeta.account} - {monthLabels[(Number(activeImport.syncMeta.month) || 1) - 1]} {activeImport.syncMeta.year}
              </small>
            )}
          </div>

          <div className="dashboard-panel">
            <div className="section-heading compact-heading">
              <div>
                <h2>Movimientos detectados</h2>
                <p>{filteredMovements.length} movimientos, {formatCurrency(filteredTotal)} en la vista actual.</p>
              </div>
            </div>
            <div className="tc-filter-row">
              <label className="tc-search-field">
                Buscar
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Ej: Copec, Smart fit, Airbnb" />
              </label>
              <label>
                Usuario
                <select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
                  <option value="">Todos</option>
                  {userSummary.map((user) => (
                    <option key={user.key} value={user.key}>{user.key} - {user.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Sección
                <select value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)}>
                  <option value="">Todas</option>
                  {sectionSummary.map((section) => (
                    <option key={section.key} value={section.key}>{section.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="tc-section-summary">
              {sectionSummary.map((section) => (
                <button type="button" key={section.key} className={selectedSection === section.key ? "active" : ""} onClick={() => setSelectedSection((current) => (current === section.key ? "" : section.key))}>
                  <span>{section.label}</span>
                  <strong>{formatCurrency(section.total)}</strong>
                  <small>{section.count}</small>
                </button>
              ))}
              {!sectionSummary.length && <p className="empty-row">Sin secciones para el usuario seleccionado.</p>}
            </div>
            <div className="tc-house-summary">
              <div>
                <span>Gastos Casa</span>
                <strong>{formatCurrency(houseTotal)}</strong>
                <small>{houseMovements.length} movimientos seleccionados</small>
              </div>
              <button type="button" className="ghost-action" onClick={() => setActiveHouseExpenseIds([])} disabled={!houseExpenseIds.length}>
                Limpiar seleccion
              </button>
            </div>
            <div className="table-wrap tc-movement-table">
              <table>
                <colgroup>
                  <col className="tc-col-house" />
                  <col className="tc-col-date" />
                  <col className="tc-col-user" />
                  <col className="tc-col-section" />
                  <col className="tc-col-commerce" />
                  <col className="tc-col-location" />
                  <col className="tc-col-amount" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="tc-check-col">Casa</th>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Sección</th>
                    <th>Comercio</th>
                    <th>Ubicación</th>
                    <th className="amount-col">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="tc-check-col">
                        <input
                          type="checkbox"
                          checked={houseExpenseIds.includes(movement.id)}
                          onChange={() => toggleHouseExpense(movement.id)}
                          aria-label={`Marcar ${movement.description} como gasto de casa`}
                        />
                      </td>
                      <td>{formatDate(movement.date)}</td>
                      <td>{movement.userCode} - {movement.userLabel}</td>
                      <td>{movement.section}</td>
                      <td>{movement.description}</td>
                      <td>{movement.location}</td>
                      <td className={`amount-col ${movement.amount < 0 ? "income-text" : "expense-text"}`}>{formatCurrency(movement.amount)}</td>
                    </tr>
                  ))}
                  {!filteredMovements.length && (
                    <tr>
                      <td colSpan="7" className="empty-row">Sin movimientos para los filtros seleccionados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="tc-mobile-movement-list">
              {filteredMovements.map((movement) => (
                <article className="tc-mobile-movement-card" key={`${movement.id}-mobile`}>
                  <header>
                    <div>
                      <strong>{movement.description}</strong>
                      <span>{movement.userCode} - {movement.userLabel}</span>
                    </div>
                    <b className={movement.amount < 0 ? "income-text" : "expense-text"}>{formatCurrency(movement.amount)}</b>
                  </header>
                  <div className="tc-mobile-movement-meta">
                    <span>{formatDate(movement.date)}</span>
                    <span>{movement.section}</span>
                    <span>{movement.location}</span>
                  </div>
                  <label className="tc-house-check">
                    <input
                      type="checkbox"
                      checked={houseExpenseIds.includes(movement.id)}
                      onChange={() => toggleHouseExpense(movement.id)}
                    />
                    Gasto Casa
                  </label>
                </article>
              ))}
              {!filteredMovements.length && <p className="empty-row">Sin movimientos para los filtros seleccionados.</p>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
