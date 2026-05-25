import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronDown, ChevronUp, ClipboardCopy, ClipboardPaste, CreditCard, FileText, KeyRound, LayoutDashboard, Link, ListChecks, LogOut, Moon, Plus, RefreshCcw, Sun, User, UploadCloud, X, Zap } from "lucide-react";
import { AccountBalances } from "./components/AccountBalances";
import { AccountEvolutionChart } from "./components/AccountEvolutionChart";
import { AccountLedgerSections } from "./components/AccountLedgerSections";
import { AnnualFlowChart } from "./components/AnnualFlowChart";
import { AnnualSummaryView } from "./components/AnnualSummaryView";
import { AuthPanel } from "./components/AuthPanel";
import { CategoryBreakdown } from "./components/CategoryBreakdown";
import { CategoryPieChart } from "./components/CategoryPieChart";
import { ColorPicker } from "./components/ColorPicker";
import { CreditCardAnalysis } from "./components/CreditCardAnalysis";
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
  incomeCategories,
  isCreditCardAccount,
  isSummaryMovement,
  monthLabels,
  normalizeCategory,
  expenseCategories,
  resolveDynamicPayments
} from "./lib/finance";
import { getAccountColorStyle } from "./lib/colors";
import { seedMovements } from "./lib/sampleData";
import { hasSupabaseConfig, supabase } from "./lib/supabase";

const initialPeriod = getCurrentPeriod();
const quickMovementShortcutUrl = "https://www.icloud.com/shortcuts/45efc6dc3d8847c09c0ccb223d4abf03";

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
  installment_count: "1",
  recurring_frequency: "none",
  recurring_count: "12",
  recurring_edit_scope: "one",
  year: initialPeriod.year,
  month: initialPeriod.month
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

function isCategoryChartMovement(movement) {
  return !movement.source_movement && movement.flow !== "Pago Tarjeta" && movement.category !== "Pago Tarjeta";
}

function getVisibleAccountsForPeriod(accounts, movements, year, month) {
  return accounts.filter((account) => !account.archived || accountHasMovementsInPeriod(account.name, movements, year, month));
}

function isBaseAccount(account) {
  return account.name === "Principal" || account.name === "Ahorro";
}

function getAccountSortValue(account, fallback = 0) {
  const value = Number(account?.sort_order);
  return Number.isFinite(value) ? value : fallback;
}

function getDefaultAccountSortValue(account, index = 0) {
  if (account?.name === "Principal") return 0;
  if (account?.name === "Ahorro") return 1;
  if (account?.type === "tarjeta_credito") return 100 + index;
  return 10 + index;
}

function sortAccounts(accounts) {
  const values = accounts.map((account) => Number(account?.sort_order)).filter(Number.isFinite);
  const hasDistinctSortValues = new Set(values).size > 1;

  return accounts
    .map((account, index) => ({ account, index }))
    .sort((a, b) => {
      const sortA = hasDistinctSortValues ? getAccountSortValue(a.account, getDefaultAccountSortValue(a.account, a.index)) : getDefaultAccountSortValue(a.account, a.index);
      const sortB = hasDistinctSortValues ? getAccountSortValue(b.account, getDefaultAccountSortValue(b.account, b.index)) : getDefaultAccountSortValue(b.account, b.index);
      return sortA - sortB || getDefaultAccountSortValue(a.account, a.index) - getDefaultAccountSortValue(b.account, b.index) || a.index - b.index;
    })
    .map(({ account }, index) => ({ ...account, sort_order: hasDistinctSortValues ? getAccountSortValue(account, index) : index }));
}

function hydrateAccounts(accounts) {
  return sortAccounts(accounts).map((account) => ({
    ...account,
    archived: Boolean(account.archived),
    locked: isBaseAccount(account)
  }));
}

function getNextAccountSortValue(accounts) {
  if (!accounts.length) return 0;
  return Math.max(...accounts.map((account, index) => getAccountSortValue(account, index))) + 1;
}

function addMonthsToPeriod(year, month, offset) {
  const zeroBased = Number(month) - 1 + offset;
  const normalizedMonth = ((zeroBased % 12) + 12) % 12;
  return {
    year: Number(year) + Math.floor(zeroBased / 12),
    month: normalizedMonth + 1
  };
}

function getRecurringMonthStep(frequency) {
  if (frequency === "bimonthly") return 2;
  if (frequency === "quarterly") return 3;
  if (frequency === "yearly") return 12;
  return 1;
}

function getRecurringFrequencyLabel(frequency) {
  if (frequency === "bimonthly") return "cada 2 meses";
  if (frequency === "quarterly") return "trimestral";
  if (frequency === "yearly") return "anual";
  return "mensual";
}

function comparePeriods(aYear, aMonth, bYear, bMonth) {
  return Number(aYear) * 12 + Number(aMonth) - (Number(bYear) * 12 + Number(bMonth));
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

function clearQuickMovementParamsFromUrl() {
  const url = new URL(window.location.href);
  ["monto", "amount", "descripcion", "description", "year", "month", "status", "estado"].forEach((param) => {
    url.searchParams.delete(param);
  });

  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
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
  const [customCategories, setCustomCategories] = useState([]);
  const [categoryDraft, setCategoryDraft] = useState({ name: "", type: "Egreso" });
  const [filters, setFilters] = useState({ search: "", account: "", responsible: "", type: "", category: "", status: "", flow: "" });
  const [accountDraft, setAccountDraft] = useState({ name: "", type: "principal", color: "#e2e8f0" });
  const [cardDraft, setCardDraft] = useState({ name: "", color: "#cfe9d8" });
  const [movements, setMovements] = useState([]);
  const [recurringMovements, setRecurringMovements] = useState([]);
  const [selectedYear, setSelectedYear] = useState(initialPeriod.year);
  const [selectedMonth, setSelectedMonth] = useState(initialPeriod.month);
  const [activeView, setActiveView] = useState("movements");
  const [dashboardCategoryScope, setDashboardCategoryScope] = useState("month");
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copiedMonth, setCopiedMonth] = useState(null);
  const [copyAccountSelection, setCopyAccountSelection] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dashboardFiltersOpen, setDashboardFiltersOpen] = useState(false);
  const [tcAnalysisFocus, setTcAnalysisFocus] = useState(null);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(hasPasswordRecoveryParams);
  const [quickLinkHandled, setQuickLinkHandled] = useState(false);
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [noticeAction, setNoticeAction] = useState(null);
  const movementSwipeRef = useRef(null);

  const isRemote = hasSupabaseConfig && session && !demoMode;

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

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
      const localCategories = localStorage.getItem("finance-demo-categories");
      const localRecurring = localStorage.getItem("finance-demo-recurring-movements");
      setAccounts(hydrateAccounts(localAccounts ? JSON.parse(localAccounts) : defaultAccounts));
      setResponsibles(localResponsibles ? JSON.parse(localResponsibles) : [{ name: getDefaultResponsible(session) }]);
      setCustomCategories(localCategories ? JSON.parse(localCategories) : []);
      setRecurringMovements(localRecurring ? JSON.parse(localRecurring) : []);
      setMovements(local ? JSON.parse(local) : seedMovements.map((item) => ({ ...item, id: buildLocalId() })));
      return;
    }

    if (session) {
      loadMovements();
      loadAccounts();
      loadResponsibles();
      loadCategories();
      loadRecurringMovements();
      loadProfile();
    }
  }, [session, demoMode]);

  useEffect(() => {
    if (demoMode || !hasSupabaseConfig) {
      localStorage.setItem("finance-demo-movements", JSON.stringify(movements));
      localStorage.setItem("finance-demo-accounts", JSON.stringify(accounts));
      localStorage.setItem("finance-demo-responsibles", JSON.stringify(responsibles));
      localStorage.setItem("finance-demo-categories", JSON.stringify(customCategories));
      localStorage.setItem("finance-demo-recurring-movements", JSON.stringify(recurringMovements));
    }
  }, [accounts, customCategories, movements, recurringMovements, responsibles, demoMode]);

  useEffect(() => {
    if (hasSupabaseConfig && session && !demoMode) {
      return;
    }

    const key = session?.user?.id || session?.user?.email || "demo";
    setAvatarUrl(localStorage.getItem(`finance-avatar-${key}`) || "");
    setDarkMode(localStorage.getItem(`finance-theme-${key}`) === "dark");
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
      status: quickParams.status,
      year: quickParams.year || selectedYear,
      month: quickParams.month || selectedMonth
    });
    setActiveView("movements");
    clearQuickMovementParamsFromUrl();
    setQuickLinkHandled(true);
  }, [demoMode, loading, passwordRecoveryMode, quickLinkHandled, session]);

  useEffect(() => {
    if (!notice) return undefined;

    if (!notice.includes("eliminado")) {
      setNoticeAction(null);
    }

    const timer = window.setTimeout(() => {
      setNotice("");
      setNoticeAction(null);
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (activeView === "annual-summary") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [activeView]);

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

  async function loadRecurringMovements() {
    const { data, error } = await supabase
      .from("recurring_movements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code !== "42P01") {
        setNotice(error.message);
      }
      setRecurringMovements([]);
      return;
    }

    setRecurringMovements(data || []);
  }

  async function loadAccounts() {
    const { data, error } = await supabase.from("accounts").select("*").order("created_at", { ascending: true });

    if (error) {
      setNotice(error.message);
      setAccounts(hydrateAccounts(defaultAccounts));
      return;
    }

    if (!data?.length) {
      await supabase.from("accounts").insert(defaultAccounts.map(({ locked, ...account }, index) => ({ ...account, sort_order: index, archived: false })));
      setAccounts(hydrateAccounts(defaultAccounts));
      return;
    }

    setAccounts(hydrateAccounts(data));
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

  async function loadCategories() {
    const { data, error } = await supabase.from("categories").select("*").order("type", { ascending: true }).order("name", { ascending: true });

    if (error) {
      if (error.code !== "42P01") {
        setNotice(error.message);
      }
      setCustomCategories([]);
      return;
    }

    setCustomCategories(data || []);
  }

  async function loadProfile() {
    if (!session?.user?.id) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("username, full_name, avatar_base64, theme_mode")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      setNotice(error.message);
      return;
    }

    setProfile(data || null);
    setAvatarUrl(data?.avatar_base64 || "");
    setDarkMode(data?.theme_mode === "dark");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const dynamicPaymentAmount = draft.flow === "Pago Tarjeta" ? cardPaymentTotals[draft.target_account] || 0 : null;
    const fallbackAmount = Number(draft.amount) || 0;
    const isInstallmentPurchase = !editingId && draft.flow === "Movimiento" && draft.installment_mode !== "none";
    const isRecurringMovement = !editingId && !isInstallmentPurchase && draft.flow !== "Pago Tarjeta" && draft.recurring_frequency !== "none";
    const recurringEditScope = draft.recurring_edit_scope || "one";
    const isRecurringSeriesEdit = Boolean(editingId && draft.recurring_id && recurringEditScope !== "one");
    const installmentCount = Math.max(1, Number.parseInt(draft.installment_count, 10) || 1);
    const recurringCount = Math.max(1, Math.min(120, Number.parseInt(draft.recurring_count, 10) || 1));
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

    if (isRecurringMovement && (!fallbackAmount || recurringCount < 2)) {
      setNotice("Ingresa un monto y al menos 2 repeticiones.");
      return;
    }

    const draftYear = Number(draft.year) || Number(selectedYear);
    const draftMonth = Number(draft.month) || Number(selectedMonth);

    if (draftYear < 2000 || draftYear > 2100 || draftMonth < 1 || draftMonth > 12) {
      setNotice("Selecciona un mes y año validos.");
      return;
    }

    const type = getTypeFromAmount(signedAmount);
    const basePayload = {
      flow: draft.flow,
      type,
      account: draft.account,
      target_account: draft.target_account || null,
      category: normalizeCategory(draft.category, type, categoryOptionsByType[type]),
      amount: signedAmount,
      status: draft.status,
      responsible: serializeResponsibleNames(draft.responsible, responsibles[0]?.name || getDefaultResponsible(session)),
      recurring_modified: Boolean(editingId && draft.recurring_id)
    };
    const payload = {
      ...basePayload,
      description: draft.description,
      sort_order: editingId ? draft.sort_order : Date.now(),
      year: draftYear,
      month: draftMonth
    };
    const seriesPayload = {
      ...basePayload,
      description: draft.description,
      recurring_modified: true
    };
    const payloads = isInstallmentPurchase
      ? Array.from({ length: installmentCount }, (_, index) => {
          const period = addMonthsToPeriod(draftYear, draftMonth, index);
          return {
            ...basePayload,
            description: `${draft.description} (${index + 1}/${installmentCount})`,
            sort_order: Date.now() + index,
            year: period.year,
            month: period.month
          };
        })
      : isRecurringMovement
      ? Array.from({ length: recurringCount }, (_, index) => {
          const period = addMonthsToPeriod(draftYear, draftMonth, index * getRecurringMonthStep(draft.recurring_frequency));
          return {
            ...payload,
            sort_order: Date.now() + index,
            year: period.year,
            month: period.month,
            recurring_occurrence: index + 1
          };
        })
      : [payload];
    const seriesTargetRows = isRecurringSeriesEdit
      ? movements.filter((movement) => {
          if (movement.recurring_id !== draft.recurring_id) return false;
          if (recurringEditScope === "all") return true;

          const draftOccurrence = Number(draft.original_recurring_occurrence || draft.recurring_occurrence);
          const movementOccurrence = Number(movement.recurring_occurrence);

          if (Number.isFinite(draftOccurrence) && draftOccurrence > 0 && Number.isFinite(movementOccurrence) && movementOccurrence > 0) {
            return movementOccurrence >= draftOccurrence;
          }

          return comparePeriods(movement.year, movement.month, draft.original_year || draft.year, draft.original_month || draft.month) >= 0;
        })
      : [];
    const seriesTargetIds = seriesTargetRows.map((movement) => movement.id);

    if (isRecurringSeriesEdit && !seriesTargetIds.length) {
      setNotice("No se encontraron movimientos de esta serie para actualizar.");
      return;
    }

    if (isRemote) {
      let recurringRule = null;

      if (isRecurringMovement) {
        const rulePayload = {
          flow: basePayload.flow,
          type: basePayload.type,
          account: basePayload.account,
          target_account: basePayload.target_account,
          category: basePayload.category,
          amount: basePayload.amount,
          status: basePayload.status,
          responsible: basePayload.responsible,
          description: draft.description,
          start_year: draftYear,
          start_month: draftMonth,
          frequency: draft.recurring_frequency,
          occurrence_count: recurringCount,
          active: true
        };
        const { data: createdRule, error: recurringError } = await supabase.from("recurring_movements").insert(rulePayload).select().single();

        if (recurringError) {
          setNotice(recurringError.message);
          return;
        }

        recurringRule = createdRule;
        setRecurringMovements((current) => [createdRule, ...current]);
      }

      const rowsToSave = recurringRule
        ? payloads.map((item) => ({ ...item, recurring_id: recurringRule.id }))
        : payloads;
      const request = isRecurringSeriesEdit
        ? supabase.from("movements").update(seriesPayload).in("id", seriesTargetIds).select()
        : editingId
        ? supabase.from("movements").update(payload).eq("id", editingId).select().single()
        : supabase.from("movements").insert(rowsToSave).select();
      const { data, error } = await request;

      if (error) {
        setNotice(error.message);
        return;
      }

      setMovements((current) => {
        if (isRecurringSeriesEdit) {
          const updatedRows = new Map((data || []).map((item) => [item.id, item]));
          return current.map((item) => updatedRows.get(item.id) || item);
        }

        return editingId ? current.map((item) => (item.id === editingId ? data : item)) : [...current, ...(data || [])];
      });
    } else {
      const now = new Date().toISOString();
      const recurringId = isRecurringMovement ? buildLocalId() : null;
      const nextRows = payloads.map((item) => ({
        ...item,
        id: editingId || buildLocalId(),
        recurring_id: recurringId || item.recurring_id,
        created_at: now,
        updated_at: now
      }));

      if (isRecurringMovement) {
        setRecurringMovements((currentRecurring) => [
          {
            flow: basePayload.flow,
            type: basePayload.type,
            account: basePayload.account,
            target_account: basePayload.target_account,
            category: basePayload.category,
            amount: basePayload.amount,
            status: basePayload.status,
            responsible: basePayload.responsible,
            id: recurringId,
            description: draft.description,
            start_year: draftYear,
            start_month: draftMonth,
            frequency: draft.recurring_frequency,
            occurrence_count: recurringCount,
            active: true,
            created_at: now,
            updated_at: now
          },
          ...currentRecurring
        ]);
      }

      setMovements((current) => {
        if (isRecurringSeriesEdit) {
          const targetIds = new Set(seriesTargetIds);
          return current.map((item) => (targetIds.has(item.id) ? { ...item, ...seriesPayload, updated_at: now } : item));
        }

        return editingId ? current.map((item) => (item.id === editingId ? nextRows[0] : item)) : [...current, ...nextRows];
      });
    }

    setSelectedYear(draftYear);
    setSelectedMonth(draftMonth);
    setDraft(emptyDraft);
    setEditingId(null);
    setMovementModalOpen(false);
    setNotice(
      editingId
        ? isRecurringSeriesEdit
          ? recurringEditScope === "all"
            ? "Serie recurrente actualizada."
            : "Movimientos recurrentes futuros actualizados."
          : "Movimiento actualizado."
        : isInstallmentPurchase
        ? `Compra dividida en ${installmentCount} cuotas.`
        : isRecurringMovement
        ? `Movimiento recurrente creado ${getRecurringFrequencyLabel(draft.recurring_frequency)} por ${recurringCount} periodos.`
        : "Movimiento agregado."
    );
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
      recurring_id: movement.recurring_id,
      recurring_occurrence: movement.recurring_occurrence,
      original_recurring_occurrence: movement.recurring_occurrence,
      original_year: movement.year,
      original_month: movement.month,
      installment_mode: "none",
      installment_count: "1",
      recurring_frequency: "none",
      recurring_count: "12",
      recurring_edit_scope: "one",
      year: movement.year,
      month: movement.month
    });
    setMovementModalOpen(true);
  }

  function getRecurringMovementScopeRows(movement, scope) {
    if (!movement?.recurring_id || scope === "one") {
      return movement ? [movement] : [];
    }

    return movements.filter((item) => {
      if (item.recurring_id !== movement.recurring_id) return false;
      if (scope === "all") return true;

      const baseOccurrence = Number(movement.recurring_occurrence);
      const itemOccurrence = Number(item.recurring_occurrence);

      if (Number.isFinite(baseOccurrence) && baseOccurrence > 0 && Number.isFinite(itemOccurrence) && itemOccurrence > 0) {
        return itemOccurrence >= baseOccurrence;
      }

      return comparePeriods(item.year, item.month, movement.year, movement.month) >= 0;
    });
  }

  async function deleteMovement(id) {
    const deletedMovement = movements.find((item) => item.id === id);
    if (!deletedMovement) {
      setNotice("Movimiento no encontrado.");
      return;
    }

    if (deletedMovement.recurring_id) {
      setDeleteCandidate(deletedMovement);
      return;
    }

    await deleteMovementScope(deletedMovement, "one");
  }

  async function deleteMovementScope(movement, scope) {
    const rowsToDelete = getRecurringMovementScopeRows(movement, scope);
    const idsToDelete = rowsToDelete.map((item) => item.id);

    if (!idsToDelete.length) {
      setNotice("No se encontraron movimientos para eliminar.");
      setDeleteCandidate(null);
      return;
    }

    if (isRemote) {
      const { error } = await supabase.from("movements").delete().in("id", idsToDelete);
      if (error) {
        setNotice(error.message);
        return;
      }
    }

    setMovements((current) => current.filter((item) => !idsToDelete.includes(item.id)));
    setDeleteCandidate(null);
    setNotice(idsToDelete.length === 1 ? "Movimiento eliminado." : `${idsToDelete.length} movimientos eliminados.`);
    setNoticeAction({
      label: "Deshacer",
      run: () => undoDeleteMovements(rowsToDelete)
    });
  }

  async function undoDeleteMovement(movement) {
    await undoDeleteMovements([movement]);
  }

  async function undoDeleteMovements(deletedRows) {
    setNoticeAction(null);
    const restoredRows = deletedRows.map((movement) => ({ ...movement }));

    if (isRemote) {
      const { data, error } = await supabase.from("movements").insert(restoredRows).select();
      if (error) {
        setNotice(error.message);
        setNoticeAction(null);
        return;
      }

      const restoredIds = new Set((data || []).map((item) => item.id));
      setMovements((current) => [...current.filter((item) => !restoredIds.has(item.id)), ...(data || [])]);
    } else {
      const restoredIds = new Set(restoredRows.map((item) => item.id));
      setMovements((current) => [...current.filter((item) => !restoredIds.has(item.id)), ...restoredRows]);
    }

    setNotice(restoredRows.length === 1 ? "Movimiento restaurado." : "Movimientos restaurados.");
    setNoticeAction(null);
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

    await loadMovements();
    await Promise.all([loadAccounts(), loadResponsibles(), loadProfile()]);
    setNotice("Datos sincronizados.");
  }

  function moveSelectedMonth(offset) {
    const period = addMonthsToPeriod(selectedYear, selectedMonth, offset);
    setSelectedYear(period.year);
    setSelectedMonth(period.month);
  }

  function isInteractiveSwipeTarget(target) {
    return Boolean(target?.closest("button, a, input, select, textarea, label, [role='button']"));
  }

  function handleMovementTouchStart(event) {
    if (window.innerWidth > 720 || isInteractiveSwipeTarget(event.target) || event.touches.length !== 1) {
      movementSwipeRef.current = null;
      return;
    }

    const touch = event.touches[0];
    movementSwipeRef.current = {
      x: touch.clientX,
      y: touch.clientY
    };
  }

  function handleMovementTouchEnd(event) {
    const start = movementSwipeRef.current;
    movementSwipeRef.current = null;

    if (!start || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const isHorizontalSwipe = Math.abs(deltaX) > 70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35;

    if (!isHorizontalSwipe) return;

    moveSelectedMonth(deltaX < 0 ? 1 : -1);
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
      description: account.type === "tarjeta_credito" ? `Compra ${account.name}` : "",
      year: Number(selectedYear),
      month: Number(selectedMonth)
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
      responsible: responsibles[0]?.name || getDefaultResponsible(session),
      year: Number(selectedYear),
      month: Number(selectedMonth)
    });
    setMovementModalOpen(true);
  }

  function openTcDetailFromMovement(link) {
    setTcAnalysisFocus({ ...link, requestedAt: Date.now() });
    setActiveView("tc-analysis");
  }

  async function createTcUserSummaryMovements({ importRecord, account, year, month, userSummaries }) {
    const targetYear = Number(year);
    const targetMonth = Number(month);
    const targetAccount = String(account || "").trim();
    const summaries = (userSummaries || []).filter((user) => Number(user.total) !== 0);

    if (!targetAccount || targetYear < 2000 || targetYear > 2100 || targetMonth < 1 || targetMonth > 12) {
      throw new Error("Selecciona tarjeta, mes y ano validos.");
    }

    if (!summaries.length) {
      throw new Error("No hay resumenes por usuario para sincronizar.");
    }

    const now = new Date().toISOString();
    const importName = importRecord?.name || importRecord?.fileName || "Estado de cuenta TC";
    const rows = summaries.map((user, index) => {
      const amount = -Math.abs(Number(user.total) || 0);
      const type = getTypeFromAmount(amount);
      const description = `TC ${importName} - ${user.label || user.key}`;
      return {
        flow: "Movimiento",
        type,
        account: targetAccount,
        target_account: null,
        category: normalizeCategory("Tarjeta de Credito", type, categoryOptionsByType[type]),
        amount,
        status: "Confirmado",
        responsible: serializeResponsibleNames(user.label || user.key, currentResponsible),
        description,
        sort_order: Date.now() + index,
        year: targetYear,
        month: targetMonth,
        recurring_modified: false
      };
    });

    const existingByDescription = new Map(
      movements
        .filter((movement) =>
          movement.flow === "Movimiento" &&
          movement.account === targetAccount &&
          Number(movement.year) === targetYear &&
          Number(movement.month) === targetMonth
        )
        .map((movement) => [movement.description, movement])
    );
    const rowsToUpdate = rows
      .map((row) => ({ row, existing: existingByDescription.get(row.description) }))
      .filter((item) => item.existing);
    const rowsToInsert = rows.filter((row) => !existingByDescription.has(row.description));

    if (isRemote) {
      const updatedRows = [];
      for (const item of rowsToUpdate) {
        const { data, error } = await supabase.from("movements").update(item.row).eq("id", item.existing.id).select().single();
        if (error) throw new Error(error.message);
        updatedRows.push(data);
      }

      let insertedRows = [];
      if (rowsToInsert.length) {
        const { data, error } = await supabase.from("movements").insert(rowsToInsert).select();
        if (error) throw new Error(error.message);
        insertedRows = data || [];
      }

      setMovements((current) => {
        const updatedMap = new Map(updatedRows.map((row) => [row.id, row]));
        return [...current.map((movement) => updatedMap.get(movement.id) || movement), ...insertedRows];
      });
    } else {
      const updatedRows = rowsToUpdate.map((item) => ({ ...item.existing, ...item.row, updated_at: now }));
      const insertedRows = rowsToInsert.map((row) => ({ ...row, id: buildLocalId(), created_at: now, updated_at: now }));
      const updatedMap = new Map(updatedRows.map((row) => [row.id, row]));
      setMovements((current) => [...current.map((movement) => updatedMap.get(movement.id) || movement), ...insertedRows]);
    }

    setSelectedYear(targetYear);
    setSelectedMonth(targetMonth);
    setNotice(`Resumen TC sincronizado en ${targetAccount}: ${rowsToInsert.length} creados, ${rowsToUpdate.length} actualizados.`);
    return { created: rowsToInsert.length, updated: rowsToUpdate.length };
  }

  function openNewMovementModal(prefill = {}) {
    setEditingId(null);
    setDraft({
      ...emptyDraft,
      amount: prefill.amount ?? "",
      description: prefill.description ?? "",
      status: prefill.status || emptyDraft.status,
      responsible: responsibles[0]?.name || currentResponsible || getDefaultResponsible(session),
      year: prefill.year || Number(selectedYear),
      month: prefill.month || Number(selectedMonth)
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

    const nextAccount = { name, type: accountDraft.type, color: accountDraft.color, archived: false, sort_order: getNextAccountSortValue(accounts) };

    if (isRemote) {
      const { data, error } = await supabase.from("accounts").insert(nextAccount).select().single();
      if (error) {
        setNotice(error.message);
        return;
      }
      setAccounts((current) => hydrateAccounts([...current, data]));
    } else {
      setAccounts((current) => hydrateAccounts([...current, nextAccount]));
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

      setAccounts((current) => hydrateAccounts(current.map((item) => (item.name === account.name ? { ...item, ...data, archived: Boolean(data.archived) } : item))));
    } else {
      setAccounts((current) => hydrateAccounts(current.map((item) => (item.name === account.name ? { ...item, ...payload } : item))));
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

  async function moveAccount(accountName, direction) {
    const orderedAccounts = sortAccounts(accounts);
    const currentIndex = orderedAccounts.findIndex((account) => account.name === accountName);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedAccounts.length) {
      return;
    }

    const currentAccount = orderedAccounts[currentIndex];
    const targetAccount = orderedAccounts[nextIndex];
    const nextCurrent = { ...currentAccount, sort_order: getAccountSortValue(targetAccount, nextIndex) };
    const nextTarget = { ...targetAccount, sort_order: getAccountSortValue(currentAccount, currentIndex) };

    setAccounts((current) =>
      hydrateAccounts(current.map((account) => {
        if (account.name === nextCurrent.name) return nextCurrent;
        if (account.name === nextTarget.name) return nextTarget;
        return account;
      }))
    );

    if (isRemote && currentAccount.id && targetAccount.id) {
      const [currentUpdate, targetUpdate] = await Promise.all([
        supabase.from("accounts").update({ sort_order: nextCurrent.sort_order }).eq("id", currentAccount.id),
        supabase.from("accounts").update({ sort_order: nextTarget.sort_order }).eq("id", targetAccount.id)
      ]);
      const error = currentUpdate.error || targetUpdate.error;
      if (error) {
        setNotice(error.message);
        loadAccounts();
        return;
      }
    }

    setNotice("Orden de cuentas actualizado.");
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

    const nextCard = { name, type: "tarjeta_credito", color: cardDraft.color, archived: false, sort_order: getNextAccountSortValue(accounts) };

    if (isRemote) {
      const { data, error } = await supabase.from("accounts").insert(nextCard).select().single();
      if (error) {
        setNotice(error.message);
        return;
      }
      setAccounts((current) => hydrateAccounts([...current, data]));
    } else {
      setAccounts((current) => hydrateAccounts([...current, nextCard]));
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

  async function createCategory(event) {
    event.preventDefault();
    const name = categoryDraft.name.trim();
    const type = categoryDraft.type;

    if (!name) {
      setNotice("Ingresa un nombre para la categoria.");
      return;
    }

    const existingCategories = categoryOptionsByType[type] || [];
    if (existingCategories.some((category) => category.toLowerCase() === name.toLowerCase())) {
      setNotice("Esa categoria ya existe.");
      return;
    }

    const nextCategory = { name, type };

    if (isRemote) {
      const { data, error } = await supabase.from("categories").insert(nextCategory).select().single();
      if (error) {
        setNotice(error.message);
        return;
      }
      setCustomCategories((current) => [...current, data]);
    } else {
      setCustomCategories((current) => [...current, { ...nextCategory, id: buildLocalId() }]);
    }

    setCategoryDraft({ name: "", type });
    setNotice("Categoria agregada.");
  }

  async function deleteCategory(category) {
    const categoryInUse = movements.some((movement) => movement.category === category.name);
    if (categoryInUse) {
      setNotice("No se puede eliminar una categoria usada en movimientos.");
      return;
    }

    if (isRemote && category.id) {
      const { error } = await supabase.from("categories").delete().eq("id", category.id);
      if (error) {
        setNotice(error.message);
        return;
      }
    }

    setCustomCategories((current) => current.filter((item) => item.id !== category.id));
    setNotice("Categoria eliminada.");
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
    setDarkMode(false);
    setSession(null);
  }

  async function updateThemePreference(enabled) {
    const themeMode = enabled ? "dark" : "light";
    const previousMode = darkMode;
    setDarkMode(enabled);

    if (isRemote && session?.user?.id) {
      const { data, error } = await supabase
        .from("profiles")
        .update({ theme_mode: themeMode })
        .eq("id", session.user.id)
        .select("username, full_name, avatar_base64, theme_mode")
        .single();

      if (error) {
        setDarkMode(previousMode);
        setNotice(error.message);
        return;
      }

      setProfile(data);
    } else {
      const key = session?.user?.id || session?.user?.email || "demo";
      localStorage.setItem(`finance-theme-${key}`, themeMode);
    }

    setNotice(enabled ? "Modo oscuro activado." : "Modo claro activado.");
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
          .select("username, full_name, avatar_base64, theme_mode")
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

  function exportPdf() {
    if (activeView !== "movements" && activeView !== "annual-summary") {
      return;
    }

    const monthName = monthLabels[selectedMonth - 1];
    const ledger = calculateAccountLedger(resolvedMovements, Number(selectedYear), Number(selectedMonth), accounts);
    const monthSummary = summary.monthly.find((item) => item.month === Number(selectedMonth));
    const yearMovements = resolvedMovements.filter((movement) => Number(movement.year) === Number(selectedYear));
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
    const movementsByAccount = accounts
      .map((account) => ({
        account,
        rows: monthMovements.filter((movement) => (movement.account || "Principal") === account.name)
      }))
      .filter(({ rows }) => rows.length);
    const movementSections = movementsByAccount
      .map(({ account, rows }) => {
        const total = rows.reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
        const rowsHtml = rows
          .map((movement) => `
            <tr>
              <td>${escapeHtml(movement.description)}</td>
              <td>${escapeHtml(movement.flow || "Movimiento")}${movement.target_account ? ` -> ${escapeHtml(movement.target_account)}` : ""}</td>
              <td>${escapeHtml(movement.responsible || "Yo")}</td>
              <td>${escapeHtml(movement.category)}</td>
              <td>${escapeHtml(movement.status)}</td>
              <td class="${Number(movement.amount) >= 0 ? "positive" : "negative"}">${formatCurrency(movement.amount)}</td>
            </tr>
          `)
          .join("");

        return `
          <section class="account-movement-group">
            <div class="account-movement-title">
              <h3>${escapeHtml(account.name)}</h3>
              <span class="${total >= 0 ? "positive" : "negative"}">${formatCurrency(total)}</span>
            </div>
            <table class="movements money-table">
              <thead>
                <tr>
                  <th>Descripcion</th>
                  <th>Operacion</th>
                  <th>Responsable</th>
                  <th>Categoria</th>
                  <th>Estado</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </section>
        `;
      })
      .join("");
    const annualRows = summary.monthly
      .map((item) => `
        <tr>
          <td>${escapeHtml(monthLabels[item.month - 1])}</td>
          <td>${formatCurrency(item.income || 0)}</td>
          <td>${formatCurrency(item.expenses || 0)}</td>
          <td class="${(item.balance || 0) >= 0 ? "positive" : "negative"}">${formatCurrency(item.balance || 0)}</td>
          <td>${formatCurrency(item.projected || 0)}</td>
        </tr>
      `)
      .join("");
    const annualCategoryRows = Object.entries(
      yearMovements
        .filter(isCategoryChartMovement)
        .reduce((groups, movement) => {
          const key = movement.category || "Sin categoria";
          groups[key] = (groups[key] || 0) + Number(movement.amount || 0);
          return groups;
        }, {})
    )
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 12)
      .map(([category, amount]) => `
        <tr>
          <td>${escapeHtml(category)}</td>
          <td class="${amount >= 0 ? "positive" : "negative"}">${formatCurrency(amount)}</td>
        </tr>
      `)
      .join("");

    const reportTitle = activeView === "annual-summary" ? `Resumen anual ${selectedYear}` : `Movimientos ${monthName} ${selectedYear}`;
    const reportSubtitle = activeView === "annual-summary"
      ? "Balance mensual, flujo anual y principales categorias."
      : "Balance de cuentas y detalle de movimientos del mes.";
    const reportContent = activeView === "annual-summary"
      ? `
          <section class="summary">
            <div class="box accent"><span>Ingresos</span><strong>${formatCurrency(summary.annualIncome)}</strong></div>
            <div class="box warm"><span>Egresos</span><strong>${formatCurrency(summary.annualExpenses)}</strong></div>
            <div class="box deep"><span>Balance anual</span><strong>${formatCurrency(summary.annualBalance)}</strong></div>
            <div class="box"><span>Movimientos</span><strong>${yearMovements.length}</strong></div>
          </section>
          <h2>Flujo por mes</h2>
          <table class="annual-flow money-table">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Ingresos</th>
                <th>Egresos</th>
                <th>Balance</th>
                <th>Proyectado</th>
              </tr>
            </thead>
            <tbody>${annualRows}</tbody>
          </table>
          <h2>Principales categorias</h2>
          <table class="category-totals money-table compact">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${annualCategoryRows || `<tr><td colspan="2">Sin movimientos categorizados.</td></tr>`}</tbody>
          </table>
        `
      : `
          <section class="summary">
            <div class="box accent"><span>Ingresos</span><strong>${formatCurrency(monthSummary?.income || 0)}</strong></div>
            <div class="box warm"><span>Egresos</span><strong>${formatCurrency(monthSummary?.expenses || 0)}</strong></div>
            <div class="box deep"><span>Balance</span><strong>${formatCurrency(monthSummary?.balance || 0)}</strong></div>
            <div class="box"><span>Proyectado</span><strong>${formatCurrency(monthSummary?.projected || 0)}</strong></div>
          </section>
          <h2>Balances de cuentas</h2>
          <table class="balances money-table">
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
          ${movementSections || `<div class="empty-state">Sin movimientos para este mes.</div>`}
        `;

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(reportTitle)}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Inter, Arial, sans-serif; color: #123033; margin: 0; background: #f4f7f4; font-size: 13px; line-height: 1.35; }
            .page { max-width: 1120px; margin: 0 auto; padding: 28px; }
            .hero { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; padding: 22px; border-radius: 8px; color: #ffffff; background: linear-gradient(135deg, #0d3b3e, #168264 58%, #f0b64d); }
            .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; font-weight: 900; letter-spacing: 0; }
            .brand-mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3); }
            h1 { margin: 0 0 8px; font-size: 25px; }
            h2 { margin: 24px 0 9px; font-size: 15px; color: #0d3b3e; }
            .muted { color: rgba(255,255,255,0.82); margin: 0; font-weight: 700; }
            .stamp { text-align: right; font-size: 12px; font-weight: 900; color: rgba(255,255,255,0.82); }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
            .box { border: 1px solid #dce8df; border-radius: 8px; padding: 12px; background: #ffffff; box-shadow: 0 10px 24px rgba(18,48,51,0.06); }
            .box.accent { border-top: 5px solid #168264; }
            .box.warm { border-top: 5px solid #d9834d; }
            .box.deep { border-top: 5px solid #0d3b3e; }
            .box span { display: block; color: #657873; font-size: 11px; font-weight: 900; text-transform: uppercase; }
            .box strong { display: block; margin-top: 6px; font-size: 16px; color: #123033; }
            .money-table { width: 100%; border-collapse: collapse; margin-top: 8px; overflow: hidden; border-radius: 8px; background: #ffffff; }
            th, td { border-bottom: 1px solid #e7eee9; padding: 8px 7px; text-align: left; vertical-align: top; }
            th { color: #0d3b3e; font-size: 10px; background: #eaf4ef; text-transform: uppercase; }
            tr:nth-child(even) td { background: #fbfdfb; }
            .balances td:nth-child(n+3), .balances th:nth-child(n+3),
            .movements td:last-child, .movements th:last-child,
            .annual-flow td:nth-child(n+2), .annual-flow th:nth-child(n+2),
            .category-totals td:last-child, .category-totals th:last-child { text-align: right; }
            .account-movement-group { margin-top: 14px; break-inside: avoid; page-break-inside: avoid; }
            .account-movement-title { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 9px 10px; border-radius: 8px 8px 0 0; background: #0d3b3e; color: #ffffff; }
            .account-movement-title h3 { margin: 0; font-size: 13px; }
            .account-movement-title span { font-weight: 900; }
            .account-movement-group .money-table { margin-top: 0; border-radius: 0 0 8px 8px; }
            .empty-state { padding: 14px; border: 1px solid #dce8df; border-radius: 8px; background: #ffffff; color: #657873; font-weight: 800; }
            .compact { max-width: 680px; }
            .positive { color: #168264; font-weight: 900; }
            .negative { color: #c4663b; font-weight: 900; }
            .print-actions { margin: 0 0 14px; text-align: right; }
            button { border: 1px solid #0d3b3e; border-radius: 8px; background: #0d3b3e; color: #fff; font-weight: 900; padding: 10px 14px; }
            @page { margin: 18mm 16mm; }
            @media print {
              body { background: #ffffff; font-size: 10.5px; line-height: 1.25; }
              .page { max-width: none; padding: 0; }
              .print-actions { display: none; }
              .hero, .box { box-shadow: none; }
              .hero { padding: 14px 16px; }
              .brand { margin-bottom: 10px; }
              .brand-mark { width: 24px; height: 24px; border-radius: 6px; }
              h1 { font-size: 20px; }
              h2 { margin: 16px 0 6px; font-size: 12px; }
              .summary { gap: 7px; margin: 12px 0; }
              .box { padding: 8px; border-top-width: 4px; }
              .box span { font-size: 8.5px; }
              .box strong { font-size: 12px; }
              th, td { padding: 5px 5px; }
              th { font-size: 8px; }
              .account-movement-group { margin-top: 10px; }
              .account-movement-title { padding: 6px 8px; }
              .account-movement-title h3 { font-size: 10.5px; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="print-actions">
              <button type="button" onclick="window.print()">Imprimir / guardar PDF</button>
            </div>
            <header class="hero">
              <div>
                <div class="brand"><span class="brand-mark">F</span><span>Fluxa</span></div>
                <h1>${escapeHtml(reportTitle)}</h1>
                <p class="muted">${escapeHtml(reportSubtitle)}</p>
              </div>
              <div class="stamp">
                <div>${new Date().toLocaleDateString("es-CL")}</div>
                <div>${escapeHtml(currentResponsible)}</div>
              </div>
            </header>
            ${reportContent}
          </div>
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

  const categoryOptionsByType = useMemo(() => {
    function mergeCategories(defaults, type) {
      const seen = new Set();
      return [
        ...defaults,
        ...customCategories
          .filter((category) => category.type === type)
          .map((category) => category.name)
      ]
        .map((category) => String(category || "").trim())
        .filter(Boolean)
        .filter((category) => {
          const key = category.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => a.localeCompare(b, "es"));
    }

    return {
      Ingreso: mergeCategories(incomeCategories, "Ingreso"),
      Egreso: mergeCategories(expenseCategories, "Egreso")
    };
  }, [customCategories]);

  const resolvedMovements = useMemo(
    () => resolveDynamicPayments(movements, accounts).map((movement) => ({ ...movement, category: normalizeCategory(movement.category, movement.type, categoryOptionsByType[movement.type]) })),
    [accounts, categoryOptionsByType, movements]
  );
  const summary = useMemo(() => calculateSummary(resolvedMovements, Number(selectedYear), accounts), [accounts, resolvedMovements, selectedYear]);
  const accountOrderMap = useMemo(() => new Map(accounts.map((account, index) => [account.name, index])), [accounts]);
  const monthMovements = resolvedMovements
    .filter((item) => item.year === Number(selectedYear) && item.month === Number(selectedMonth))
    .sort(
      (a, b) =>
        (accountOrderMap.get(a.account || "Principal") ?? 999) - (accountOrderMap.get(b.account || "Principal") ?? 999) ||
        sortMovementsByAccountOrder(a, b)
    );
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
  const monthCategoryMovements = filteredMonthMovements.filter(isCategoryChartMovement);
  const filteredYearMovements = resolvedMovements
    .filter((item) => Number(item.year) === Number(selectedYear))
    .filter(matchesMovementFilters);
  const dashboardCategoryMovements = (dashboardCategoryScope === "year" ? filteredYearMovements : filteredMonthMovements).filter(isCategoryChartMovement);
  const filterOptions = {
    accounts: visibleAccounts.map((account) => account.name),
    responsibles: Array.from(new Set([currentResponsible, ...responsibles.map((responsible) => normalizeResponsibleName(responsible.name, currentResponsible)), ...monthMovements.flatMap((movement) => parseResponsibleNames(movement.responsible, currentResponsible))])).sort(),
    categories: Array.from(new Set([...categoryOptionsByType.Ingreso, ...categoryOptionsByType.Egreso, ...monthMovements.map((movement) => movement.category)])).sort(),
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
    { id: "tc-analysis", label: "Análisis TC", icon: CreditCard },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "profile", label: "Perfil", icon: User },
    { id: "signout", label: "Salir", icon: LogOut, action: signOut }
  ];
  const navOrder = ["movements", "annual-summary", "dashboard", "tc-analysis", "profile", "signout"];
  const orderedNavItems = navOrder.map((id) => navItems.find((item) => item.id === id)).filter(Boolean);

  return (
    <main className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <img src="/Fluxa_Blanco.png" alt="" />
          <div>
            <strong>Fluxa</strong>
            <span>Control financiero</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {orderedNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button type="button" className={activeView === item.id ? "active" : ""} key={item.id} onClick={() => (item.action ? item.action() : setActiveView(item.id))}>
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
          {noticeAction && (
            <button type="button" className="toast-action" onClick={noticeAction.run}>
              {noticeAction.label}
            </button>
          )}
          <button type="button" onClick={() => { setNotice(""); setNoticeAction(null); }} aria-label="Cerrar mensaje">
            <X size={16} />
          </button>
        </div>
      )}

      <section className="app-shell">
      <header className="topbar">
        <div className="topbar-title">
          <img src={darkMode ? "/Fluxa_Blanco.png" : "/Fluxa_Verde.png"} alt="" />
          <div>
            <span className="eyebrow">Panel financiero</span>
            <h1>Fluxa</h1>
          </div>
        </div>
        <div className="topbar-actions">
          {(activeView === "movements" || activeView === "annual-summary") && (
            <button type="button" className="icon-text" onClick={exportPdf}>
              <FileText size={18} />
              PDF
            </button>
          )}
          <button type="button" className="icon-text" onClick={copyAutomationLink}>
            <Link size={18} />
            Link rapido
          </button>
        </div>
      </header>

      {!isRemote && (
        <section className="setup-banner">
          <UploadCloud size={20} />
          <span>Modo demo local activo. Al configurar Supabase, los usuarios y movimientos se guardaran en la nube.</span>
        </section>
      )}

      {activeView !== "profile" && activeView !== "annual-summary" && activeView !== "tc-analysis" && (
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
      <section className="work-area" onTouchStart={handleMovementTouchStart} onTouchEnd={handleMovementTouchEnd}>
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
          <AccountLedgerSections accounts={visibleAccounts} cardPaymentTotals={cardPaymentTotals} movements={monthMovements} allMovements={monthMovements} currentResponsible={currentResponsible} filterMovement={matchesMovementFilters} hasActiveFilters={hasActiveFilters} onEdit={editMovement} onDelete={deleteMovement} onStatusChange={updateMovementStatus} onMove={moveMovement} onQuickAdd={quickAddForAccount} onQuickPay={quickPayCreditCard} onOpenTcDetail={openTcDetailFromMovement} />
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

      {activeView === "tc-analysis" && (
        <CreditCardAnalysis
          accounts={accounts}
          defaultYear={Number(selectedYear)}
          defaultMonth={Number(selectedMonth)}
          onCreateUserSummaryMovements={createTcUserSummaryMovements}
          focusRequest={tcAnalysisFocus}
        />
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
              </div>
            </div>
            <div className="profile-grid">
              <span>Estado</span><strong>{isRemote ? "Sincronizado en la nube" : "Demo local"}</strong>
              <span>Email</span><strong>{session?.user?.email || "Sin sesion remota"}</strong>
              <span>Usuario</span><strong>{profile?.username || session?.user?.user_metadata?.username || "No definido"}</strong>
              <span>Link rapido</span><strong>{`${window.location.origin}${window.location.pathname}?monto=10000`}</strong>
            </div>
            <div className="profile-action-grid">
              <button type="button" className="profile-action-card" onClick={() => setPasswordModalOpen(true)}>
                <KeyRound size={20} />
                <span>
                  <strong>Cambiar contraseña</strong>
                  <small>Actualiza tu acceso de forma segura.</small>
                </span>
              </button>
              <a className="profile-action-card" href={quickMovementShortcutUrl} target="_blank" rel="noreferrer">
                <Zap size={20} />
                <span>
                  <strong>Importar atajo rapido</strong>
                  <small>Agrega movimientos desde Atajos de iCloud.</small>
                </span>
              </a>
            </div>
            <div className="theme-setting-row">
              <div>
                <strong>Modo oscuro</strong>
                <span>{darkMode ? "Interfaz oscura activa en tu sesion." : "Interfaz clara activa en tu sesion."}</span>
              </div>
              <button type="button" className={`theme-toggle ${darkMode ? "active" : ""}`} onClick={() => updateThemePreference(!darkMode)} aria-pressed={darkMode}>
                {darkMode ? <Moon size={18} /> : <Sun size={18} />}
                {darkMode ? "Oscuro" : "Claro"}
              </button>
            </div>
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
              {accounts.map((account, index) => {
                const hasMovements = accountHasMovements(account.name, movements);
                return (
                  <form
                    className="account-admin-row"
                    key={account.name}
                    style={getAccountColorStyle(account.color, "#ffffff")}
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
                    <div className="account-order-controls" aria-label={`Ordenar ${account.name}`}>
                      <button type="button" className="icon-button" onClick={() => moveAccount(account.name, -1)} disabled={index === 0} aria-label={`Subir ${account.name}`}>
                        <ChevronUp size={15} />
                      </button>
                      <button type="button" className="icon-button" onClick={() => moveAccount(account.name, 1)} disabled={index === accounts.length - 1} aria-label={`Bajar ${account.name}`}>
                        <ChevronDown size={15} />
                      </button>
                    </div>
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
          <div className="dashboard-panel profile-panel">
            <h2>Categorias</h2>
            <form className="category-admin-form" onSubmit={createCategory}>
              <label>
                Nombre
                <input value={categoryDraft.name} onChange={(event) => setCategoryDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ej: Mascotas, Dividendos" required />
              </label>
              <label>
                Tipo
                <select value={categoryDraft.type} onChange={(event) => setCategoryDraft((current) => ({ ...current, type: event.target.value }))}>
                  <option>Ingreso</option>
                  <option>Egreso</option>
                </select>
              </label>
              <button type="submit" className="primary-action">
                <Plus size={18} />
                Agregar
              </button>
            </form>
            <div className="category-admin-grid">
              {["Ingreso", "Egreso"].map((type) => {
                const defaultList = [...(type === "Ingreso" ? incomeCategories : expenseCategories)].sort((a, b) => a.localeCompare(b, "es"));
                const customList = customCategories.filter((category) => category.type === type).sort((a, b) => a.name.localeCompare(b.name, "es"));
                return (
                  <section className="category-admin-panel" key={type}>
                    <h3>{type}</h3>
                    <div className="category-chip-list">
                      {defaultList.map((category) => (
                        <span className="category-chip default" key={category}>{category}</span>
                      ))}
                      {customList.map((category) => (
                        <span className="category-chip custom" key={category.id || `${category.type}-${category.name}`}>
                          {category.name}
                          <button type="button" onClick={() => deleteCategory(category)} aria-label={`Eliminar categoria ${category.name}`}>
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {passwordModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel password-modal-panel" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
            <header className="modal-header">
              <div>
                <h2 id="password-modal-title">Cambiar contraseña</h2>
                <p>Confirma tu contraseña actual antes de guardar una nueva.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setPasswordModalOpen(false)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>
            <PasswordChangeForm session={session} isRemote={isRemote} showTitle={false} />
          </section>
        </div>
      )}

      {movementModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="movement-modal-title">
            <header className="modal-header">
              <div>
                <h2 id="movement-modal-title">{editingId ? "Editar movimiento" : "Agregar movimiento"}</h2>
                <p>{monthLabels[(Number(draft.month) || Number(selectedMonth)) - 1]} {Number(draft.year) || Number(selectedYear)}</p>
              </div>
              <button type="button" className="icon-button" onClick={closeMovementModal} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>
            <MovementForm accounts={selectableAccounts} cardPaymentTotals={cardPaymentTotals} responsibles={responsibles} currentResponsible={currentResponsible} categoryOptionsByType={categoryOptionsByType} draft={draft} onChange={setDraft} onSubmit={handleSubmit} editingId={editingId} />
          </section>
        </div>
      )}

      {deleteCandidate && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel delete-scope-modal" role="dialog" aria-modal="true" aria-labelledby="delete-scope-title">
            <header className="modal-header">
              <div>
                <h2 id="delete-scope-title">Eliminar movimiento recurrente</h2>
                <p>{deleteCandidate.description}</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setDeleteCandidate(null)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>
            <div className="delete-scope-actions">
              <button type="button" className="ghost-action" onClick={() => deleteMovementScope(deleteCandidate, "one")}>
                Solo este movimiento
                <small>Elimina 1 movimiento.</small>
              </button>
              <button type="button" className="ghost-action" onClick={() => deleteMovementScope(deleteCandidate, "following")}>
                Este y los siguientes
                <small>Elimina {getRecurringMovementScopeRows(deleteCandidate, "following").length} movimientos.</small>
              </button>
              <button type="button" className="ghost-action danger" onClick={() => deleteMovementScope(deleteCandidate, "all")}>
                Toda la serie
                <small>Elimina {getRecurringMovementScopeRows(deleteCandidate, "all").length} movimientos.</small>
              </button>
            </div>
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
