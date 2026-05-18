import { useEffect, useMemo, useState } from "react";
import { Camera, ClipboardCopy, ClipboardPaste, Download, FileText, LayoutDashboard, Link, ListChecks, LogOut, Plus, RefreshCcw, User, UploadCloud, X, Zap } from "lucide-react";
import { AccountBalances } from "./components/AccountBalances";
import { AccountEvolutionChart } from "./components/AccountEvolutionChart";
import { AccountLedgerSections } from "./components/AccountLedgerSections";
import { AnnualFlowChart } from "./components/AnnualFlowChart";
import { AnnualSummaryView } from "./components/AnnualSummaryView";
import { AuthPanel } from "./components/AuthPanel";
import { CategoryBreakdown } from "./components/CategoryBreakdown";
import { CategoryPieChart } from "./components/CategoryPieChart";
import { ColorPicker } from "./components/ColorPicker";
import { CreditCardManager } from "./components/CreditCardManager";
import { CreditCardMonthlyChart } from "./components/CreditCardMonthlyChart";
import { MonthlyGrid } from "./components/MonthlyGrid";
import { MovementForm } from "./components/MovementForm";
import { PasswordChangeForm } from "./components/PasswordChangeForm";
import { PasswordResetPanel } from "./components/PasswordResetPanel";
import { SummaryCards } from "./components/SummaryCards";
import {
  calculateAccountBalances,
  calculateAccountLedger,
  calculateCreditCardPaymentTotals,
  calculateSummary,
  defaultAccounts,
  formatCurrency,
  getCurrentPeriod,
  getTypeFromAmount,
  isCreditCardAccount,
  isSummaryMovement,
  monthLabels,
  normalizeCategory,
  resolveDynamicPayments
} from "./lib/finance";
import { seedMovements } from "./lib/sampleData";
import { hasSupabaseConfig, supabase } from "./lib/supabase";

const initialPeriod = getCurrentPeriod();

const emptyDraft = {
  flow: "Movimiento",
  type: "Egreso",
  account: "Principal",
  target_account: "",
  category: "Sin definir",
  description: "",
  amount: "",
  status: "Proyectado",
  responsible: "",
  installment_mode: "none",
  installment_count: "1"
};

const movementStatuses = ["Confirmado", "Proyectado", "Pendiente"];

const accountColorOptions = [
  { label: "Gris", value: "#e2e8f0" },
  { label: "Verde", value: "#cfe9d8" },
  { label: "Azul", value: "#d7e7ff" },
  { label: "Amarillo", value: "#fde68a" },
  { label: "Rojo", value: "#ffd6d6" },
  { label: "Morado", value: "#e9d5ff" },
  { label: "Cian", value: "#cceff2" },
  { label: "Naranja", value: "#fed7aa" }
];

function buildLocalId() {
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getMovementSortValue(movement) {
  return Number(movement.sort_order) || Date.parse(movement.created_at || "") || 0;
}

function getMovementSortFieldForAccount(movement, account) {
  return movement.flow === "Transferencia" && movement.target_account === account ? "target_sort_order" : "sort_order";
}

function getMovementSortValueForAccount(movement, account) {
  const field = getMovementSortFieldForAccount(movement, account);
  return Number(movement[field]) || getMovementSortValue(movement);
}

function sortMovementsByAccountOrder(a, b) {
  return (
    (a.account || "Principal").localeCompare(b.account || "Principal") ||
    getMovementSortValue(a) - getMovementSortValue(b) ||
    String(a.id).localeCompare(String(b.id))
  );
}

function accountHasMovements(accountName, movements) {
  return movements.some((movement) => movement.account === accountName || movement.target_account === accountName);
}

function accountHasMovementsInPeriod(accountName, movements, year, month) {
  return movements.some(
    (movement) =>
      Number(movement.year) === Number(year) &&
      Number(movement.month) === Number(month) &&
      (movement.account === accountName || movement.target_account === accountName)
  );
}

function getVisibleAccountsForPeriod(accounts, movements, year, month) {
  return accounts.filter((account) => !account.archived || accountHasMovementsInPeriod(account.name, movements, year, month));
}

function isBaseAccount(account) {
  return account.name === "Principal" || account.name === "Ahorro";
}

function addMonthsToPeriod(year, month, offset) {
  const zeroBased = Number(month) - 1 + offset;
  return {
    year: Number(year) + Math.floor(zeroBased / 12),
    month: (zeroBased % 12) + 1
  };
}

function getDefaultResponsible(session) {
  return session?.user?.user_metadata?.username || session?.user?.email?.split("@")[0] || "Yo";
}

function normalizeResponsibleName(name, defaultResponsible) {
  const value = String(name || "").trim();
  if (!value || value.toLowerCase() === "yo") {
    return defaultResponsible;
  }
  return value;
}

function parseResponsibleNames(value, defaultResponsible) {
  const raw = String(value || "").trim();
  if (!raw) return [defaultResponsible];

  let names = [];
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      names = JSON.parse(raw);
    } catch {
      names = [];
    }
  }

  if (!names.length) {
    names = raw.split(",");
  }

  return Array.from(new Set(names.map((name) => normalizeResponsibleName(name, defaultResponsible)).filter(Boolean)));
}

function serializeResponsibleNames(value, defaultResponsible) {
  const names = Array.isArray(value) ? value : parseResponsibleNames(value, defaultResponsible);
  return Array.from(new Set(names.map((name) => normalizeResponsibleName(name, defaultResponsible)).filter(Boolean))).join(", ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hasPasswordRecoveryParams() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return search.get("reset-password") === "1" || search.get("type") === "recovery" || hash.get("type") === "recovery";
}

function getQuickMovementParams() {
  const search = new URLSearchParams(window.location.search);
  const amount = search.get("monto") ?? search.get("amount");

  if (amount === null || amount === "") {
    return null;
  }

  const parsedAmount = Number(String(amount).replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(parsedAmount)) {
    return null;
  }

  const rawStatus = search.get("status") || search.get("estado") || "";
  const normalizedStatus = movementStatuses.find((status) => status.toLowerCase() === rawStatus.trim().toLowerCase()) || null;

  return {
    amount: parsedAmount,
    description: search.get("descripcion") || search.get("description") || "",
    year: Number(search.get("year")) || null,
    month: Number(search.get("month")) || null,
    status: normalizedStatus
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function compressAvatarFile(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const needsCompression = file.size > 900 * 1024;

  if (!needsCompression) {
    return originalDataUrl;
  }

  const image = await loadImage(originalDataUrl);
  const maxSize = 640;
  const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.82);
}

export function App() {
  const [session, setSession] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [accounts, setAccounts] = useState(defaultAccounts);
  const [responsibles, setResponsibles] = useState([]);
  const [responsibleDraft, setResponsibleDraft] = useState("");
  const [filters, setFilters] = useState({ search: "", account: "", responsible: "", type: "", category: "", status: "", flow: "" });
  const [accountDraft, setAccountDraft] = useState({ name: "", type: "principal", color: "#e2e8f0" });
  const [cardDraft, setCardDraft] = useState({ name: "", color: "#cfe9d8" });
  const [movements, setMovements] = useState([]);
  const [selectedYear, setSelectedYear] = useState(initialPeriod.year);
  const [selectedMonth, setSelectedMonth] = useState(initialPeriod.month);
  const [activeView, setActiveView] = useState("movements");
  const [dashboardCategoryScope, setDashboardCategoryScope] = useState("month");
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copiedMonth, setCopiedMonth] = useState(null);
  const [copyAccountSelection, setCopyAccountSelection] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dashboardFiltersOpen, setDashboardFiltersOpen] = useState(false);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(hasPasswordRecoveryParams);
  const [quickLinkHandled, setQuickLinkHandled] = useState(false);
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const isRemote = hasSupabaseConfig && session && !demoMode;

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (hasPasswordRecoveryParams()) {
        setPasswordRecoveryMode(true);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecoveryMode(true);
      }
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setSession(nextSession);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (demoMode || !hasSupabaseConfig) {
      const local = localStorage.getItem("finance-demo-movements");
      const localAccounts = localStorage.getItem("finance-demo-accounts");
      const localResponsibles = localStorage.getItem("finance-demo-responsibles");
      setAccounts((localAccounts ? JSON.parse(localAccounts) : defaultAccounts).map((account) => ({ ...account, archived: Boolean(account.archived), locked: isBaseAccount(account) })));
      setResponsibles(localResponsibles ? JSON.parse(localResponsibles) : [{ name: getDefaultResponsible(session) }]);
      setMovements(local ? JSON.parse(local) : seedMovements.map((item) => ({ ...item, id: buildLocalId() })));
      return;
    }

    if (session) {
      loadMovements();
      loadAccounts();
      loadResponsibles();
      loadProfile();
    }
  }, [session, demoMode]);

  useEffect(() => {
    if (demoMode || !hasSupabaseConfig) {
      localStorage.setItem("finance-demo-movements", JSON.stringify(movements));
      localStorage.setItem("finance-demo-accounts", JSON.stringify(accounts));
      localStorage.setItem("finance-demo-responsibles", JSON.stringify(responsibles));
    }
  }, [accounts, movements, responsibles, demoMode]);

  useEffect(() => {
    if (hasSupabaseConfig && session && !demoMode) {
      return;
    }

    const key = session?.user?.id || session?.user?.email || "demo";
    setAvatarUrl(localStorage.getItem(`finance-avatar-${key}`) || "");
  }, [demoMode, session]);

  useEffect(() => {
    if (quickLinkHandled || loading || passwordRecoveryMode || (!session && !demoMode)) {
      return;
    }

    const quickParams = getQuickMovementParams();
    if (!quickParams) {
      setQuickLinkHandled(true);
      return;
    }

    if (quickParams.year) {
      setSelectedYear(quickParams.year);
    }
    if (quickParams.month >= 1 && quickParams.month <= 12) {
      setSelectedMonth(quickParams.month);
    }

    openNewMovementModal({
      amount: quickParams.amount,
      description: quickParams.description,
      status: quickParams.status
    });
    setActiveView("movements");
    setQuickLinkHandled(true);
  }, [demoMode, loading, passwordRecoveryMode, quickLinkHandled, session]);

  useEffect(() => {
    if (!notice) return undefined;

    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function loadMovements({ showLoading = false } = {}) {
    if (showLoading) {
      setLoading(true);
    }
    const { data, error } = await supabase
      .from("movements")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: true })
      .order("created_at", { ascending: true });

    if (showLoading) {
      setLoading(false);
    }

    if (error) {
      setNotice(error.message);
      return;
    }

    setMovements(data || []);
  }

  async function loadAccounts() {
    const { data, error } = await supabase.from("accounts").select("*").order("created_at", { ascending: true });

    if (error) {
      setNotice(error.message);
      setAccounts(defaultAccounts);
      return;
    }

    if (!data?.length) {
      await supabase.from("accounts").insert(defaultAccounts.map(({ locked, ...account }) => ({ ...account, archived: false })));
      setAccounts(defaultAccounts);
      return;
    }

    setAccounts(data.map((account) => ({ ...account, archived: Boolean(account.archived), locked: isBaseAccount(account) })));
  }

  async function loadResponsibles() {
    const fallback = getDefaultResponsible(session);
    const { data, error } = await supabase.from("responsibles").select("*").order("created_at", { ascending: true });

    if (error) {
      setNotice(error.message);
      setResponsibles([{ name: fallback }]);
      return;
    }

    if (!data?.length) {
      const { data: created } = await supabase.from("responsibles").insert({ name: fallback }).select();
      setResponsibles(created?.length ? created : [{ name: fallback }]);
      return;
    }

    setResponsibles(data);
  }

  async function loadProfile() {
    if (!session?.user?.id) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("username, full_name, avatar_base64")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      setNotice(error.message);
      return;
    }

    setProfile(data || null);
    setAvatarUrl(data?.avatar_base64 || "");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const dynamicPaymentAmount = draft.flow === "Pago Tarjeta" ? cardPaymentTotals[draft.target_account] || 0 : null;
    const fallbackAmount = Number(draft.amount) || 0;
    const isInstallmentPurchase = !editingId && draft.flow === "Movimiento" && draft.installment_mode !== "none";
    const installmentCount = Math.max(1, Number.parseInt(draft.installment_count, 10) || 1);
    const installmentAmount = isInstallmentPurchase && draft.installment_mode === "total"
      ? Math.abs(fallbackAmount) / installmentCount
      : Math.abs(fallbackAmount);
    const signedAmount = isInstallmentPurchase
      ? -installmentAmount
      : draft.flow === "Movimiento"
      ? fallbackAmount
      : -Math.abs(dynamicPaymentAmount ?? fallbackAmount);

    if (draft.flow === "Pago Tarjeta" && !dynamicPaymentAmount) {
      setNotice("La tarjeta seleccionada no tiene saldo pendiente para pagar.");
      return;
    }

    if (isInstallmentPurchase && (!fallbackAmount || installmentCount < 2)) {
      setNotice("Ingresa un monto y al menos 2 cuotas.");
      return;
    }

    const type = getTypeFromAmount(signedAmount);
    const basePayload = {
      flow: draft.flow,
      type,
      account: draft.account,
      target_account: draft.target_account || null,
      category: normalizeCategory(draft.category, type),
      amount: signedAmount,
      status: draft.status,
      responsible: serializeResponsibleNames(draft.responsible, responsibles[0]?.name || getDefaultResponsible(session))
    };
    const payload = {
      ...basePayload,
      description: draft.description,
      sort_order: editingId ? draft.sort_order : Date.now(),
      year: Number(selectedYear),
      month: Number(selectedMonth)
    };
    const payloads = isInstallmentPurchase
      ? Array.from({ length: installmentCount }, (_, index) => {
          const period = addMonthsToPeriod(selectedYear, selectedMonth, index);
          return {
            ...basePayload,
            description: `${draft.description} (${index + 1}/${installmentCount})`,
            sort_order: Date.now() + index,
            year: period.year,
            month: period.month
          };
        })
      : [payload];

    if (isRemote) {
      const request = editingId
        ? supabase.from("movements").update(payload).eq("id", editingId).select().single()
        : supabase.from("movements").insert(payloads).select();
      const { data, error } = await request;

      if (error) {
        setNotice(error.message);
        return;
      }

      setMovements((current) => (editingId ? current.map((item) => (item.id === editingId ? data : item)) : [...current, ...(data || [])]));
    } else {
      setMovements((current) => {
        const now = new Date().toISOString();
        const nextRows = payloads.map((item) => ({ ...item, id: editingId || buildLocalId(), created_at: now, updated_at: now }));
        return editingId ? current.map((item) => (item.id === editingId ? nextRows[0] : item)) : [...current, ...nextRows];
      });
    }

    setDraft(emptyDraft);
    setEditingId(null);
    setMovementModalOpen(false);
    setNotice(editingId ? "Movimiento actualizado." : isInstallmentPurchase ? `Compra dividida en ${installmentCount} cuotas.` : "Movimiento agregado.");
  }

  function editMovement(movement) {
    setEditingId(movement.id);
    setSelectedYear(movement.year);
    setSelectedMonth(movement.month);
    setDraft({
      type: movement.type,
      flow: movement.flow || "Movimiento",
      account: movement.account || "Principal",
      target_account: movement.target_account || "",
      category: movement.category,
      description: movement.description,
      amount: movement.amount,
      status: movement.status,
      responsible: movement.responsible || responsibles[0]?.name || getDefaultResponsible(session),
      sort_order: movement.sort_order,
      installment_mode: "none",
      installment_count: "1"
    });
    setMovementModalOpen(true);
  }

  async function deleteMovement(id) {
    if (isRemote) {
      const { error } = await supabase.from("movements").delete().eq("id", id);
      if (error) {
        setNotice(error.message);
        return;
      }
    }

    setMovements((current) => current.filter((item) => item.id !== id));
    setNotice("Movimiento eliminado.");
  }

  async function updateMovementStatus(movement, status) {
    if (isRemote) {
      const { error } = await supabase.from("movements").update({ status }).eq("id", movement.id);
      if (error) {
        setNotice(error.message);
        return;
      }
    }

    setMovements((current) => current.map((item) => (item.id === movement.id ? { ...item, status } : item)));
    setNotice("Estado actualizado.");
  }

  async function syncRemoteData() {
    if (!isRemote) return;

    await loadMovements({ showLoading: true });
    await Promise.all([loadAccounts(), loadResponsibles(), loadProfile()]);
    setNotice("Datos sincronizados.");
  }

  async function moveMovement(movement, direction) {
    const account = movement.display_account || movement.account || "Principal";
    const movementId = movement.source_movement?.id || movement.id;
    const sameAccountRows = movements
      .filter((item) => {
        const samePeriod = Number(item.year) === Number(movement.year) && Number(item.month) === Number(movement.month);
        const belongsToAccount = (item.account || "Principal") === account || (item.flow === "Transferencia" && item.target_account === account);
        return samePeriod && belongsToAccount;
      })
      .sort((a, b) => getMovementSortValueForAccount(a, account) - getMovementSortValueForAccount(b, account) || String(a.id).localeCompare(String(b.id)));
    const index = sameAccountRows.findIndex((item) => item.id === movementId);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= sameAccountRows.length) {
      return;
    }

    const reorderedRows = [...sameAccountRows];
    const [movedRow] = reorderedRows.splice(index, 1);
    reorderedRows.splice(nextIndex, 0, movedRow);
    const baseOrder = Date.now();
    const orderUpdates = reorderedRows.map((item, itemIndex) => ({
      id: item.id,
      field: getMovementSortFieldForAccount(item, account),
      value: baseOrder + itemIndex
    }));

    setMovements((current) =>
      current.map((item) => {
        const update = orderUpdates.find((candidate) => candidate.id === item.id);
        return update ? { ...item, [update.field]: update.value } : item;
      })
    );

    if (isRemote) {
      const results = await Promise.all(
        orderUpdates.map((update) => supabase.from("movements").update({ [update.field]: update.value }).eq("id", update.id))
      );
      const error = results.find((result) => result.error)?.error;

      if (error) {
        setNotice(error.message);
        loadMovements();
        return;
      }
    }
  }

  function openCopyModal() {
    const activeAccounts = accounts.filter((account) => monthMovements.some((movement) => movement.account === account.name || movement.target_account === account.name));
    setCopyAccountSelection(
      activeAccounts.reduce((selection, account) => {
        selection[account.name] = true;
        return selection;
      }, {})
    );
    setCopyModalOpen(true);
  }

  function copyMonthMovements(event) {
    event.preventDefault();
    const selectedAccounts = new Set(Object.entries(copyAccountSelection).filter(([, selected]) => selected).map(([account]) => account));
    const copyRows = monthMovements.filter((movement) => selectedAccounts.has(movement.account) || selectedAccounts.has(movement.target_account));

    if (copyRows.length === 0) {
      setNotice("Selecciona al menos una cuenta con movimientos para copiar.");
      return;
    }

    setCopiedMonth({
      year: Number(selectedYear),
      month: Number(selectedMonth),
      accounts: Array.from(selectedAccounts),
      movements: copyRows.map(({ id, user_id, created_at, updated_at, sort_order, ...movement }) => movement)
    });
    setCopyModalOpen(false);
    setNotice(`Copiados ${copyRows.length} movimientos de ${monthLabels[selectedMonth - 1]} ${selectedYear}.`);
  }

  async function pasteMonthMovements() {
    if (!copiedMonth?.movements?.length) {
      setNotice("Primero copia los movimientos de un mes.");
      return;
    }

    const baseOrder = Date.now();
    const payload = copiedMonth.movements.map((movement, index) => ({
      ...movement,
      sort_order: baseOrder + index,
      year: Number(selectedYear),
      month: Number(selectedMonth)
    }));

    if (isRemote) {
      const { data, error } = await supabase.from("movements").insert(payload).select();

      if (error) {
        setNotice(error.message);
        return;
      }

      setMovements((current) => [...current, ...(data || [])]);
    } else {
      const now = new Date().toISOString();
      setMovements((current) => [
        ...current,
        ...payload.map((movement) => ({
          ...movement,
          id: buildLocalId(),
          created_at: now,
          updated_at: now
        }))
      ]);
    }

    setNotice(`Pegados ${payload.length} movimientos en ${monthLabels[selectedMonth - 1]} ${selectedYear}.`);
  }

  function quickAddForAccount(account) {
    setEditingId(null);
    setDraft({
      ...emptyDraft,
      account: account.name,
      responsible: responsibles[0]?.name || getDefaultResponsible(session),
      category: "Sin definir",
      description: account.type === "tarjeta_credito" ? `Compra ${account.name}` : ""
    });
    setMovementModalOpen(true);
  }

  function quickPayCreditCard(account, total) {
    const amount = Number(total) || 0;

    if (!amount) {
      setNotice("La tarjeta no tiene saldo pendiente para pagar.");
      return;
    }

    setEditingId(null);
    setDraft({
      ...emptyDraft,
      flow: "Pago Tarjeta",
      account: "Principal",
      target_account: account.name,
      category: "Pago Tarjeta",
      description: `Pago total ${account.name}`,
      amount: -amount,
      status: "Confirmado",
      responsible: responsibles[0]?.name || getDefaultResponsible(session)
    });
    setMovementModalOpen(true);
  }

  function openNewMovementModal(prefill = {}) {
    setEditingId(null);
    setDraft({
      ...emptyDraft,
      amount: prefill.amount ?? "",
      description: prefill.description ?? "",
      status: prefill.status || emptyDraft.status,
      responsible: responsibles[0]?.name || currentResponsible || getDefaultResponsible(session)
    });
    setMovementModalOpen(true);
  }

  function copyAutomationLink() {
    const url = `${window.location.origin}${window.location.pathname}?monto=10000`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }

    setNotice("Link de automatizacion copiado. Cambia el monto en la URL segun necesites.");
  }

  function closeMovementModal() {
    setMovementModalOpen(false);
    setEditingId(null);
    setDraft(emptyDraft);
  }

  async function createAccount(event) {
    event.preventDefault();
    const name = accountDraft.name.trim();

    if (!name) {
      setNotice("Ingresa un nombre para la cuenta.");
      return;
    }

    if (accounts.some((account) => account.name.toLowerCase() === name.toLowerCase())) {
      setNotice("Ya existe una cuenta o tarjeta con ese nombre.");
      return;
    }

    const nextAccount = { name, type: accountDraft.type, color: accountDraft.color, archived: false };

    if (isRemote) {
      const { data, error } = await supabase.from("accounts").insert(nextAccount).select().single();
      if (error) {
        setNotice(error.message);
        return;
      }
      setAccounts((current) => [...current, data]);
    } else {
      setAccounts((current) => [...current, nextAccount]);
    }

    setAccountDraft({ name: "", type: "principal", color: "#e2e8f0" });
    setNotice("Cuenta creada.");
  }

  async function updateAccount(account, patch) {
    const nextName = patch.name?.trim() || account.name;
    const renamed = nextName !== account.name;

    if (renamed && accounts.some((item) => item.name.toLowerCase() === nextName.toLowerCase() && item.name !== account.name)) {
      setNotice("Ya existe una cuenta o tarjeta con ese nombre.");
      return;
    }

    const payload = { ...patch, name: nextName };

    if (isRemote && account.id) {
      const { data, error } = await supabase.from("accounts").update(payload).eq("id", account.id).select().single();
      if (error) {
        setNotice(error.message);
        return;
      }

      if (renamed) {
        const [accountUpdate, targetUpdate] = await Promise.all([
          supabase.from("movements").update({ account: nextName }).eq("account", account.name),
          supabase.from("movements").update({ target_account: nextName }).eq("target_account", account.name)
        ]);
        const movementError = accountUpdate.error || targetUpdate.error;
        if (movementError) {
          setNotice(movementError.message);
          loadAccounts();
          loadMovements();
          return;
        }
      }

      setAccounts((current) => current.map((item) => (item.name === account.name ? { ...item, ...data, archived: Boolean(data.archived) } : item)));
    } else {
      setAccounts((current) => current.map((item) => (item.name === account.name ? { ...item, ...payload } : item)));
    }

    if (renamed) {
      setMovements((current) =>
        current.map((movement) => ({
          ...movement,
          account: movement.account === account.name ? nextName : movement.account,
          target_account: movement.target_account === account.name ? nextName : movement.target_account
        }))
      );
    }

    setNotice("Cuenta actualizada.");
  }

  async function deleteAccount(account) {
    if (account.locked) {
      setNotice("Esta cuenta base no se puede eliminar.");
      return;
    }

    if (accountHasMovements(account.name, movements)) {
      setNotice("No se puede eliminar una cuenta con movimientos. Puedes renombrarla o archivar la tarjeta.");
      return;
    }

    if (isRemote && account.id) {
      const { error } = await supabase.from("accounts").delete().eq("id", account.id);
      if (error) {
        setNotice(error.message);
        return;
      }
    }

    setAccounts((current) => current.filter((item) => item.name !== account.name));
    setNotice("Cuenta eliminada.");
  }

  async function createCreditCard(event) {
    event.preventDefault();
    const name = cardDraft.name.trim();

    if (!name) {
      setNotice("Ingresa un nombre para la tarjeta.");
      return;
    }

    if (accounts.some((account) => account.name.toLowerCase() === name.toLowerCase())) {
      setNotice("Ya existe una cuenta o tarjeta con ese nombre.");
      return;
    }

    const nextCard = { name, type: "tarjeta_credito", color: cardDraft.color, archived: false };

    if (isRemote) {
      const { data, error } = await supabase.from("accounts").insert(nextCard).select().single();
      if (error) {
        setNotice(error.message);
        return;
      }
      setAccounts((current) => [...current, data]);
    } else {
      setAccounts((current) => [...current, nextCard]);
    }

    setCardDraft({ name: "", color: "#cfe9d8" });
    setNotice("Tarjeta creada.");
  }

  async function deleteCreditCard(card) {
    const hasMovements = movements.some((movement) => movement.account === card.name || movement.target_account === card.name);

    if (hasMovements) {
      await updateAccount(card, { archived: true });
      setNotice("Tarjeta archivada. Se seguira mostrando solo en meses con movimientos.");
      return;
    }

    if (isRemote && card.id) {
      const { error } = await supabase.from("accounts").delete().eq("id", card.id);
      if (error) {
        setNotice(error.message);
        return;
      }
    }

    setAccounts((current) => current.filter((account) => account.name !== card.name));
    setNotice("Tarjeta eliminada.");
  }

  async function createResponsible(event) {
    event.preventDefault();
    const name = responsibleDraft.trim();
    if (!name) return;
    if (responsibles.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      setNotice("Ese responsable ya existe.");
      return;
    }

    if (isRemote) {
      const { data, error } = await supabase.from("responsibles").insert({ name }).select().single();
      if (error) {
        setNotice(error.message);
        return;
      }
      setResponsibles((current) => [...current, data]);
    } else {
      setResponsibles((current) => [...current, { name }]);
    }

    setResponsibleDraft("");
    setNotice("Responsable agregado.");
  }

  async function deleteResponsible(responsible) {
    const defaultResponsible = getDefaultResponsible(session);
    if (movements.some((movement) => parseResponsibleNames(movement.responsible, defaultResponsible).includes(responsible.name))) {
      setNotice("No se puede eliminar un responsable usado en movimientos.");
      return;
    }

    if (isRemote && responsible.id) {
      const { error } = await supabase.from("responsibles").delete().eq("id", responsible.id);
      if (error) {
        setNotice(error.message);
        return;
      }
    }

    setResponsibles((current) => current.filter((item) => item.name !== responsible.name));
  }

  async function signOut() {
    if (hasSupabaseConfig && session) {
      await supabase.auth.signOut();
    }
    setDemoMode(false);
    setPasswordRecoveryMode(false);
    setProfile(null);
    setAvatarUrl("");
    setSession(null);
  }

  function updateAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    compressAvatarFile(file).then(async (nextAvatar) => {

      if (isRemote) {
        const { data, error } = await supabase
          .from("profiles")
          .update({ avatar_base64: nextAvatar })
          .eq("id", session.user.id)
          .select("username, full_name, avatar_base64")
          .single();

        if (error) {
          setNotice(error.message);
          event.target.value = "";
          return;
        }

        setProfile(data);
      } else {
        const key = session?.user?.id || session?.user?.email || "demo";
        localStorage.setItem(`finance-avatar-${key}`, nextAvatar);
      }

      setAvatarUrl(nextAvatar);
      setNotice("Foto de perfil actualizada.");
      event.target.value = "";
    }).catch(() => {
      setNotice("No se pudo procesar la imagen. Prueba con otro archivo.");
      event.target.value = "";
    });
  }

  async function finishPasswordRecovery() {
    if (hasSupabaseConfig) {
      await supabase.auth.signOut();
    }
    setPasswordRecoveryMode(false);
    setSession(null);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function exportCsv() {
    const headers = ["year", "month", "description", "flow", "account", "target_account", "type", "category", "status", "responsible", "amount"];
    const rows = movements.map((item) => headers.map((key) => JSON.stringify(item[key] ?? "")).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `finanzas-${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const monthName = monthLabels[selectedMonth - 1];
    const ledger = calculateAccountLedger(resolvedMovements, Number(selectedYear), Number(selectedMonth), accounts);
    const monthSummary = summary.monthly.find((item) => item.month === Number(selectedMonth));
    const accountRows = accounts
      .map((account) => `
        <tr>
          <td>${escapeHtml(account.name)}</td>
          <td>${escapeHtml(account.type === "tarjeta_credito" ? "Tarjeta" : account.type === "ahorro" ? "Ahorro" : "Principal")}</td>
          <td>${formatCurrency(ledger.opening[account.name] || 0)}</td>
          <td>${formatCurrency(ledger.monthNet[account.name] || 0)}</td>
          <td>${formatCurrency(ledger.closing[account.name] || 0)}</td>
        </tr>
      `)
      .join("");
    const movementRows = monthMovements
      .map((movement) => `
        <tr>
          <td>${escapeHtml(movement.description)}</td>
          <td>${escapeHtml(movement.account || "Principal")}${movement.target_account ? ` -> ${escapeHtml(movement.target_account)}` : ""}</td>
          <td>${escapeHtml(movement.flow || "Movimiento")}</td>
          <td>${escapeHtml(movement.responsible || "Yo")}</td>
          <td>${escapeHtml(movement.category)}</td>
          <td>${escapeHtml(movement.status)}</td>
          <td>${formatCurrency(movement.amount)}</td>
        </tr>
      `)
      .join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Resumen ${escapeHtml(monthName)} ${selectedYear}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #172033; margin: 32px; }
            h1 { margin: 0 0 6px; font-size: 24px; }
            h2 { margin: 24px 0 10px; font-size: 16px; }
            .muted { color: #697789; margin: 0 0 18px; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
            .box { border: 1px solid #dce3ec; border-radius: 8px; padding: 12px; }
            .box span { display: block; color: #697789; font-size: 12px; font-weight: 700; }
            .box strong { display: block; margin-top: 6px; font-size: 18px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th, td { border-bottom: 1px solid #edf1f5; padding: 10px 8px; text-align: left; }
            th { color: #5a6b80; font-size: 12px; }
            .balances td:nth-child(n+3), .balances th:nth-child(n+3) { text-align: right; }
            .movements td:last-child, .movements th:last-child { text-align: right; }
            .print-actions { margin: 0 0 18px; }
            button { border: 1px solid #d4dde8; border-radius: 6px; background: #173d6d; color: #fff; font-weight: 700; padding: 10px 14px; }
            @media print { body { margin: 18mm; } .print-actions { display: none; } }
          </style>
        </head>
        <body>
          <div class="print-actions">
            <button type="button" onclick="window.print()">Imprimir / guardar PDF</button>
          </div>
          <h1>Resumen financiero mensual</h1>
          <p class="muted">${escapeHtml(monthName)} ${selectedYear}</p>
          <section class="summary">
            <div class="box"><span>Ingresos</span><strong>${formatCurrency(monthSummary?.income || 0)}</strong></div>
            <div class="box"><span>Egresos</span><strong>${formatCurrency(monthSummary?.expenses || 0)}</strong></div>
            <div class="box"><span>Balance</span><strong>${formatCurrency(monthSummary?.balance || 0)}</strong></div>
            <div class="box"><span>Proyectado</span><strong>${formatCurrency(monthSummary?.projected || 0)}</strong></div>
          </section>
          <h2>Balances de cuentas</h2>
          <table class="balances">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Tipo</th>
                <th>Inicial</th>
                <th>Movimiento mes</th>
                <th>Final</th>
              </tr>
            </thead>
            <tbody>${accountRows}</tbody>
          </table>
          <h2>Detalle de movimientos</h2>
          <table class="movements">
            <thead>
              <tr>
                <th>Descripcion</th>
                <th>Cuenta</th>
                <th>Operacion</th>
                <th>Responsable</th>
                <th>Categoria</th>
                <th>Estado</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>${movementRows || `<tr><td colspan="7">Sin movimientos para este mes.</td></tr>`}</tbody>
          </table>
        </body>
      </html>
    `;

    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const printWindow = window.open(url, "_blank");
    if (!printWindow) {
      URL.revokeObjectURL(url);
      setNotice("El navegador bloqueo la ventana de PDF. Permite ventanas emergentes para exportar.");
      return;
    }

    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  const yearOptions = useMemo(() => {
    const years = new Set([
      initialPeriod.year - 2,
      initialPeriod.year - 1,
      initialPeriod.year,
      initialPeriod.year + 1,
      initialPeriod.year + 2,
      selectedYear,
      ...movements.map((item) => item.year)
    ]);
    return Array.from(years).sort((a, b) => b - a);
  }, [movements, selectedYear]);

  const resolvedMovements = useMemo(
    () => resolveDynamicPayments(movements, accounts).map((movement) => ({ ...movement, category: normalizeCategory(movement.category, movement.type) })),
    [accounts, movements]
  );
  const summary = useMemo(() => calculateSummary(resolvedMovements, Number(selectedYear), accounts), [accounts, resolvedMovements, selectedYear]);
  const monthMovements = resolvedMovements
    .filter((item) => item.year === Number(selectedYear) && item.month === Number(selectedMonth))
    .sort(sortMovementsByAccountOrder);
  const visibleAccounts = useMemo(
    () => getVisibleAccountsForPeriod(accounts, resolvedMovements, Number(selectedYear), Number(selectedMonth)),
    [accounts, resolvedMovements, selectedMonth, selectedYear]
  );
  const currentResponsible = profile?.username || getDefaultResponsible(session);
  function matchesMovementFilters(movement) {
    const search = filters.search.trim().toLowerCase();
    const movementResponsibles = parseResponsibleNames(movement.responsible, currentResponsible);
    const movementResponsibleText = movementResponsibles.join(" ");
    return (
      (!search || `${movement.description} ${movement.category} ${movement.account} ${movement.target_account || ""} ${movementResponsibleText}`.toLowerCase().includes(search)) &&
      (!filters.account || (movement.display_account || movement.account) === filters.account) &&
      (!filters.responsible || movementResponsibles.includes(filters.responsible)) &&
      (!filters.type || movement.type === filters.type) &&
      (!filters.category || movement.category === filters.category) &&
      (!filters.status || movement.status === filters.status) &&
      (!filters.flow || movement.flow === filters.flow)
    );
  }
  const filteredMonthMovements = monthMovements.filter(matchesMovementFilters);
  const monthOperatingMovements = filteredMonthMovements.filter((item) => isSummaryMovement(item, accounts));
  const monthCategoryMovements = filteredMonthMovements.filter((item) => !item.source_movement);
  const filteredYearMovements = resolvedMovements
    .filter((item) => Number(item.year) === Number(selectedYear))
    .filter(matchesMovementFilters);
  const dashboardCategoryMovements = (dashboardCategoryScope === "year" ? filteredYearMovements : filteredMonthMovements).filter((item) => !item.source_movement);
  const filterOptions = {
    accounts: visibleAccounts.map((account) => account.name),
    responsibles: Array.from(new Set([currentResponsible, ...responsibles.map((responsible) => normalizeResponsibleName(responsible.name, currentResponsible)), ...monthMovements.flatMap((movement) => parseResponsibleNames(movement.responsible, currentResponsible))])).sort(),
    categories: Array.from(new Set(monthMovements.map((movement) => movement.category))).sort(),
    types: ["Ingreso", "Egreso"],
    statuses: ["Confirmado", "Proyectado", "Pendiente"],
    flows: ["Movimiento", "Transferencia", "Pago Tarjeta"]
  };
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const selectedMonthSummary = summary.monthly.find((item) => item.month === Number(selectedMonth));
  const accountBalances = useMemo(() => calculateAccountBalances(resolvedMovements, accounts), [accounts, resolvedMovements]);
  const cardPaymentTotals = useMemo(() => {
    const totalsByPeriod = calculateCreditCardPaymentTotals(movements, accounts);
    const totals = {};

    accounts.filter((account) => isCreditCardAccount(account.name, accounts)).forEach((account) => {
      totals[account.name] = totalsByPeriod[`${Number(selectedYear)}-${Number(selectedMonth)}-${account.name}`] || 0;
    });

    return totals;
  }, [accounts, movements, selectedMonth, selectedYear]);
  const selectableAccounts = accounts.filter((account) => !account.archived);

  if (loading) {
    return <div className="loading">Cargando finanzas...</div>;
  }

  if (passwordRecoveryMode) {
    return <PasswordResetPanel session={session} onDone={finishPasswordRecovery} />;
  }

  if (!session && !demoMode) {
    return <AuthPanel />;
  }

  const navItems = [
    { id: "movements", label: "Movimientos", icon: ListChecks },
    { id: "annual-summary", label: "Resumen Anual", icon: FileText },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "profile", label: "Perfil", icon: User },
    { id: "signout", label: "Salir", icon: LogOut, action: signOut }
  ];

  return (
    <main className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <strong>Finanzas</strong>
          <span>Control familiar</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button type="button" className={`${activeView === item.id ? "active" : ""} ${item.action ? "mobile-only-nav" : ""}`} key={item.id} onClick={() => (item.action ? item.action() : setActiveView(item.id))}>
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <label className="avatar-picker" title="Agregar foto">
            {avatarUrl ? <img src={avatarUrl} alt={currentResponsible} /> : <User size={22} />}
            <span>
              <Camera size={13} />
            </span>
            <input type="file" accept="image/*" onChange={updateAvatar} />
          </label>
          <div>
            <strong>{currentResponsible}</strong>
            <small>{session?.user?.email || "Sesion local"}</small>
          </div>
          <button type="button" className="sidebar-signout" onClick={signOut}>
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </aside>

      <button type="button" className="quick-action-button" onClick={() => openNewMovementModal()} aria-label="Registrar movimiento rapido">
        <Zap size={20} />
        <span>Movimiento</span>
      </button>

      {isRemote && (
        <button type="button" className="sync-action-button" onClick={syncRemoteData} aria-label="Sincronizar datos">
          <RefreshCcw size={20} />
          <span>Sincronizar</span>
        </button>
      )}

      {notice && (
        <div className="toast-notice" role="status" aria-live="polite">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Cerrar mensaje">
            <X size={16} />
          </button>
        </div>
      )}

      <section className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Panel financiero</span>
          <h1>Gestión financiera personal</h1>
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-text" onClick={exportCsv}>
            <Download size={18} />
            CSV
          </button>
          <button type="button" className="icon-text" onClick={exportPdf}>
            <FileText size={18} />
            PDF
          </button>
          <button type="button" className="icon-text" onClick={copyAutomationLink}>
            <Link size={18} />
            Link rapido
          </button>
          {isRemote && (
            <button type="button" className="icon-text" onClick={syncRemoteData}>
              <RefreshCcw size={18} />
              Sincronizar
            </button>
          )}
        </div>
      </header>

      {!isRemote && (
        <section className="setup-banner">
          <UploadCloud size={20} />
          <span>Modo demo local activo. Al configurar Supabase, los usuarios y movimientos se guardaran en la nube.</span>
        </section>
      )}

      {activeView !== "profile" && activeView !== "annual-summary" && (
        <>
      <section className="controls-row">
        <label>
          Año
          <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mes
          <select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))}>
            {monthLabels.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
        </label>
        <div className="copy-actions">
          <button type="button" className="icon-text" onClick={openCopyModal}>
            <ClipboardCopy size={18} />
            Copiar mes
          </button>
          <button type="button" className="icon-text" onClick={pasteMonthMovements} disabled={!copiedMonth?.movements?.length}>
            <ClipboardPaste size={18} />
            Pegar
          </button>
        </div>
      </section>

      <SummaryCards summary={summary} selectedMonth={selectedMonth} />
      <MonthlyGrid summary={summary} selectedMonth={selectedMonth} onSelectMonth={setSelectedMonth} />
        </>
      )}

      {activeView === "movements" && (
      <section className="work-area">
        <div className="ledger-panel">
          <div className="section-heading">
            <div>
              <h2>Detalle mensual</h2>
              <p>{monthLabels[selectedMonth - 1]} {selectedYear}</p>
            </div>
            <button type="button" className="primary-action" onClick={openNewMovementModal}>
              <Plus size={18} />
              Agregar movimiento
            </button>
          </div>
          <section className={`filter-panel ${filtersOpen ? "open" : ""}`}>
            <div className="filter-heading">
              <div>
                <h3>Filtros</h3>
                <span>Filtro aplicado a las filas visibles</span>
              </div>
              <div className="filter-actions">
                <button type="button" className="ghost-action filter-toggle" onClick={() => setFiltersOpen((current) => !current)}>
                  {filtersOpen ? "Ocultar" : "Mostrar"}
                </button>
                <button type="button" className="ghost-action" onClick={() => setFilters({ search: "", account: "", responsible: "", type: "", category: "", status: "", flow: "" })} disabled={!hasActiveFilters}>
                  Limpiar
                </button>
              </div>
            </div>
            <div className="filter-grid">
              <label>
                Buscar
                <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Descripcion, categoria, cuenta..." />
              </label>
              <label>
                Cuenta
                <select value={filters.account} onChange={(event) => setFilters((current) => ({ ...current, account: event.target.value }))}>
                  <option value="">Todas</option>
                  {filterOptions.accounts.map((account) => (
                    <option key={account}>{account}</option>
                  ))}
                </select>
              </label>
              <label>
                Responsable
                <select value={filters.responsible} onChange={(event) => setFilters((current) => ({ ...current, responsible: event.target.value }))}>
                  <option value="">Todos</option>
                  {filterOptions.responsibles.map((responsible) => (
                    <option key={responsible} value={responsible}>{responsible === currentResponsible ? "Yo" : responsible}</option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
                  <option value="">Todos</option>
                  {filterOptions.types.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Categoria
                <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
                  <option value="">Todas</option>
                  {filterOptions.categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>
                Estado
                <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="">Todos</option>
                  {filterOptions.statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                Operacion
                <select value={filters.flow} onChange={(event) => setFilters((current) => ({ ...current, flow: event.target.value }))}>
                  <option value="">Todas</option>
                  {filterOptions.flows.map((flow) => (
                    <option key={flow}>{flow}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <AccountLedgerSections accounts={visibleAccounts} cardPaymentTotals={cardPaymentTotals} movements={monthMovements} allMovements={monthMovements} currentResponsible={currentResponsible} filterMovement={matchesMovementFilters} onEdit={editMovement} onDelete={deleteMovement} onStatusChange={updateMovementStatus} onMove={moveMovement} onQuickAdd={quickAddForAccount} onQuickPay={quickPayCreditCard} />
        </div>

        <aside className="side-panel">
          <AccountBalances accounts={visibleAccounts} movements={resolvedMovements} year={Number(selectedYear)} month={Number(selectedMonth)} />
          <CreditCardManager accounts={visibleAccounts} cardPaymentTotals={cardPaymentTotals} draft={cardDraft} onDraftChange={setCardDraft} onCreate={createCreditCard} onDelete={deleteCreditCard} />
          <CategoryBreakdown movements={monthCategoryMovements} />
          <section className="balance-list">
            <h2>Resumen anual</h2>
            <div><span>Ingresos</span><strong>{formatCurrency(summary.annualIncome)}</strong></div>
            <div><span>Egresos</span><strong>{formatCurrency(summary.annualExpenses)}</strong></div>
            <div><span>Balance</span><strong>{formatCurrency(summary.annualBalance)}</strong></div>
          </section>
        </aside>
      </section>
      )}

      {activeView === "annual-summary" && (
        <>
          <section className="annual-controls">
            <label>
              Año
              <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))}>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <AnnualSummaryView accounts={accounts} movements={resolvedMovements} year={Number(selectedYear)} summary={summary} />
        </>
      )}

      {activeView === "dashboard" && (
        <section className="dashboard-view">
          <section className={`filter-panel ${dashboardFiltersOpen ? "open" : ""}`}>
            <div className="filter-heading">
              <div>
                <h3>Filtros</h3>
                <span>Filtro aplicado a los indicadores y graficas</span>
              </div>
              <div className="filter-actions">
                <button type="button" className="ghost-action filter-toggle" onClick={() => setDashboardFiltersOpen((current) => !current)}>
                  {dashboardFiltersOpen ? "Ocultar" : "Mostrar"}
                </button>
                <button type="button" className="ghost-action" onClick={() => setFilters({ search: "", account: "", responsible: "", type: "", category: "", status: "", flow: "" })} disabled={!hasActiveFilters}>
                  Limpiar
                </button>
              </div>
            </div>
            <div className="filter-grid">
              <label>
                Buscar
                <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Descripcion, categoria, cuenta..." />
              </label>
              <label>
                Cuenta
                <select value={filters.account} onChange={(event) => setFilters((current) => ({ ...current, account: event.target.value }))}>
                  <option value="">Todas</option>
                  {filterOptions.accounts.map((account) => (
                    <option key={account}>{account}</option>
                  ))}
                </select>
              </label>
              <label>
                Responsable
                <select value={filters.responsible} onChange={(event) => setFilters((current) => ({ ...current, responsible: event.target.value }))}>
                  <option value="">Todos</option>
                  {filterOptions.responsibles.map((responsible) => (
                    <option key={responsible} value={responsible}>{responsible === currentResponsible ? "Yo" : responsible}</option>
                  ))}
                </select>
              </label>
              <label>
                Tipo
                <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
                  <option value="">Todos</option>
                  {filterOptions.types.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Categoria
                <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
                  <option value="">Todas</option>
                  {filterOptions.categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>
                Estado
                <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="">Todos</option>
                  {filterOptions.statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                Operacion
                <select value={filters.flow} onChange={(event) => setFilters((current) => ({ ...current, flow: event.target.value }))}>
                  <option value="">Todas</option>
                  {filterOptions.flows.map((flow) => (
                    <option key={flow}>{flow}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <div className="dashboard-panel">
            <h2>Dashboard mensual</h2>
            <div className="dashboard-kpis">
              <div><span>Ingresos</span><strong>{formatCurrency(selectedMonthSummary?.income || 0)}</strong></div>
              <div><span>Egresos</span><strong>{formatCurrency(selectedMonthSummary?.expenses || 0)}</strong></div>
              <div><span>Balance</span><strong>{formatCurrency(selectedMonthSummary?.balance || 0)}</strong></div>
              <div><span>Movimientos</span><strong>{filteredMonthMovements.length}</strong></div>
            </div>
          </div>
          <div className="dashboard-panel dashboard-split">
            <div>
              <div className="dashboard-scope-toggle">
                <span>Categorias</span>
                <div className="segmented compact-segmented">
                  <button type="button" className={dashboardCategoryScope === "month" ? "active" : ""} onClick={() => setDashboardCategoryScope("month")}>
                    Mes
                  </button>
                  <button type="button" className={dashboardCategoryScope === "year" ? "active" : ""} onClick={() => setDashboardCategoryScope("year")}>
                    Año
                  </button>
                </div>
              </div>
              <CategoryBreakdown movements={dashboardCategoryMovements} />
            </div>
            <CategoryPieChart movements={dashboardCategoryMovements} scopeLabel={dashboardCategoryScope === "year" ? `Año ${selectedYear}` : monthLabels[selectedMonth - 1]} />
          </div>
          <AccountEvolutionChart accounts={visibleAccounts} movements={resolvedMovements} year={Number(selectedYear)} accountFilter={filters.account} />
          <div className="dashboard-chart-pair">
            <CreditCardMonthlyChart accounts={visibleAccounts} movements={resolvedMovements} year={Number(selectedYear)} />
            <AnnualFlowChart summary={summary} />
          </div>
        </section>
      )}

      {activeView === "profile" && (
        <section className="dashboard-view">
          <div className="dashboard-panel profile-panel">
            <h2>Perfil</h2>
            <div className="profile-avatar-row">
              <label className="profile-avatar-picker">
                {avatarUrl ? <img src={avatarUrl} alt={currentResponsible} /> : <User size={34} />}
                <input type="file" accept="image/*" onChange={updateAvatar} />
              </label>
              <div>
                <strong>{currentResponsible}</strong>
                <span>Foto guardada en tu perfil de Supabase como base64.</span>
              </div>
            </div>
            <div className="profile-grid">
              <span>Estado</span><strong>{isRemote ? "Sincronizado en la nube" : "Demo local"}</strong>
              <span>Email</span><strong>{session?.user?.email || "Sin sesion remota"}</strong>
              <span>Usuario</span><strong>{profile?.username || session?.user?.user_metadata?.username || "No definido"}</strong>
              <span>Link rapido</span><strong>{`${window.location.origin}${window.location.pathname}?monto=10000`}</strong>
            </div>
            <PasswordChangeForm session={session} isRemote={isRemote} />
          </div>
          <div className="dashboard-panel profile-panel">
            <h2>Cuentas y tarjetas</h2>
            <form className="account-admin-form" onSubmit={createAccount}>
              <label>
                Nombre
                <input value={accountDraft.name} onChange={(event) => setAccountDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ej: Cuenta viaje" required />
              </label>
              <label>
                Tipo
                <select value={accountDraft.type} onChange={(event) => setAccountDraft((current) => ({ ...current, type: event.target.value }))}>
                  <option value="principal">Principal</option>
                  <option value="tarjeta_credito">Tarjeta</option>
                </select>
              </label>
              <label>
                Color
                <ColorPicker value={accountDraft.color} onChange={(color) => setAccountDraft((current) => ({ ...current, color }))} presets={accountColorOptions} />
              </label>
              <button type="submit" className="primary-action">
                <Plus size={18} />
                Crear cuenta
              </button>
            </form>
            <div className="account-admin-list">
              {accounts.map((account) => {
                const hasMovements = accountHasMovements(account.name, movements);
                return (
                  <form
                    className="account-admin-row"
                    key={account.name}
                    style={{ backgroundColor: account.color || "#ffffff" }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      updateAccount(account, {
                        name: String(form.get("name") || account.name),
                        type: String(form.get("type") || account.type),
                        color: String(form.get("color") || account.color)
                      });
                    }}
                  >
                    <input name="name" defaultValue={account.name} />
                    <select name="type" defaultValue={account.type === "ahorro" ? "principal" : account.type}>
                      <option value="principal">Principal</option>
                      <option value="tarjeta_credito">Tarjeta</option>
                    </select>
                    <ColorPicker defaultValue={account.color || "#e2e8f0"} compact />
                    <span className="account-status">{account.archived ? "Archivada" : hasMovements ? "Con movimientos" : "Sin movimientos"}</span>
                    <button type="submit" className="ghost-action">Guardar</button>
                    {account.type === "tarjeta_credito" && (
                      <button type="button" className="ghost-action" onClick={() => updateAccount(account, { archived: !account.archived })}>
                        {account.archived ? "Restaurar" : "Archivar"}
                      </button>
                    )}
                    {!account.locked && !hasMovements && (
                      <button type="button" className="icon-button danger" onClick={() => deleteAccount(account)} aria-label={`Eliminar ${account.name}`}>
                        <X size={16} />
                      </button>
                    )}
                  </form>
                );
              })}
            </div>
          </div>
          <div className="dashboard-panel profile-panel">
            <h2>Responsables</h2>
            <form className="responsible-form" onSubmit={createResponsible}>
              <input value={responsibleDraft} onChange={(event) => setResponsibleDraft(event.target.value)} placeholder="Ej: David, Krish, Casa" />
              <button type="submit" className="primary-action">
                <Plus size={18} />
                Agregar
              </button>
            </form>
            <div className="responsible-list">
              {responsibles.filter((responsible) => normalizeResponsibleName(responsible.name, currentResponsible) !== currentResponsible).map((responsible) => (
                <div key={responsible.name}>
                  <span>{responsible.name}</span>
                  <button type="button" className="icon-button danger" onClick={() => deleteResponsible(responsible)} aria-label={`Eliminar ${responsible.name}`}>
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {movementModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="movement-modal-title">
            <header className="modal-header">
              <div>
                <h2 id="movement-modal-title">{editingId ? "Editar movimiento" : "Agregar movimiento"}</h2>
                <p>{monthLabels[selectedMonth - 1]} {selectedYear}</p>
              </div>
              <button type="button" className="icon-button" onClick={closeMovementModal} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>
            <MovementForm accounts={selectableAccounts} cardPaymentTotals={cardPaymentTotals} responsibles={responsibles} currentResponsible={currentResponsible} draft={draft} onChange={setDraft} onSubmit={handleSubmit} editingId={editingId} />
          </section>
        </div>
      )}

      {copyModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel copy-modal" role="dialog" aria-modal="true" aria-labelledby="copy-modal-title">
            <header className="modal-header">
              <div>
                <h2 id="copy-modal-title">Copiar movimientos</h2>
                <p>{monthLabels[selectedMonth - 1]} {selectedYear}</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setCopyModalOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>
            <form onSubmit={copyMonthMovements}>
              <div className="copy-account-list">
                {accounts
                  .filter((account) => monthMovements.some((movement) => movement.account === account.name || movement.target_account === account.name))
                  .map((account) => {
                    const count = monthMovements.filter((movement) => movement.account === account.name || movement.target_account === account.name).length;
                    return (
                      <label className="account-copy-option" key={account.name}>
                        <input
                          type="checkbox"
                          checked={Boolean(copyAccountSelection[account.name])}
                          onChange={(event) => setCopyAccountSelection((current) => ({ ...current, [account.name]: event.target.checked }))}
                        />
                        <span>
                          {account.name}
                          <small>{count} movimientos</small>
                        </span>
                      </label>
                    );
                  })}
              </div>
              <button type="submit" className="primary-action form-action">
                <ClipboardCopy size={18} />
                Copiar seleccion
              </button>
            </form>
          </section>
        </div>
      )}
      </section>
    </main>
  );
}
