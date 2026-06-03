import { useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  BadgeAlert,
  BadgeDollarSign,
  Baby,
  Banknote,
  Bike,
  BookOpen,
  BriefcaseBusiness,
  BriefcaseMedical,
  Bus,
  Building2,
  Cake,
  Car,
  CircleHelp,
  Coins,
  Coffee,
  CookingPot,
  CreditCard,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Hammer,
  HandCoins,
  Handshake,
  HeartHandshake,
  HeartPulse,
  Home,
  Hospital,
  Landmark,
  Laptop,
  Music,
  Package,
  PawPrint,
  PiggyBank,
  Pizza,
  Plane,
  PlugZap,
  Popcorn,
  ReceiptText,
  RefreshCcw,
  Scissors,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sprout,
  Store,
  Ticket,
  Train,
  TreePalm,
  Check,
  ChevronDown,
  TrendingUp,
  Utensils,
  Wallet,
  WalletCards,
  Wifi,
  Wrench
} from "lucide-react";

const categoryIcons = {
  "Sin definir": CircleHelp,
  Sueldo: Banknote,
  Honorarios: BriefcaseBusiness,
  Bonos: BadgeDollarSign,
  "Ingreso Extra": HandCoins,
  "Balance Anterior": RefreshCcw,
  Inversiones: TrendingUp,
  Reembolso: Coins,
  Regalos: Gift,
  Otros: CircleHelp,
  Ahorro: Wallet,
  Casa: Home,
  Supermercado: ShoppingCart,
  Alimentacion: CookingPot,
  "Servicios Basicos": PlugZap,
  "Arriendo / Dividendo": Landmark,
  Transporte: Bus,
  Combustible: Fuel,
  Salud: HeartPulse,
  Educacion: GraduationCap,
  Mascotas: PawPrint,
  Ropa: Shirt,
  Impuestos: ReceiptText,
  Seguros: ShieldCheck,
  Suscripciones: CreditCard,
  Entretenimiento: Gamepad2,
  Restaurantes: Utensils,
  Viajes: Plane,
  Emergencias: BadgeAlert,
  Transferencia: ArrowRightLeft,
  "Pago Tarjeta": CreditCard,
  "Tarjeta de Credito": CreditCard
};

const iconChoices = [
  { key: "circle-help", label: "General", Icon: CircleHelp },
  { key: "banknote", label: "Dinero", Icon: Banknote },
  { key: "briefcase", label: "Trabajo", Icon: BriefcaseBusiness },
  { key: "hand-coins", label: "Pago", Icon: HandCoins },
  { key: "wallet", label: "Ahorro", Icon: Wallet },
  { key: "piggy-bank", label: "Alcancia", Icon: PiggyBank },
  { key: "wallet-cards", label: "Billetera", Icon: WalletCards },
  { key: "home", label: "Casa", Icon: Home },
  { key: "building", label: "Edificio", Icon: Building2 },
  { key: "house-plug", label: "Hogar", Icon: PlugZap },
  { key: "shopping-cart", label: "Compra", Icon: ShoppingCart },
  { key: "shopping-bag", label: "Bolsa", Icon: ShoppingBag },
  { key: "store", label: "Tienda", Icon: Store },
  { key: "package", label: "Paquete", Icon: Package },
  { key: "cooking-pot", label: "Comida", Icon: CookingPot },
  { key: "utensils", label: "Restaurante", Icon: Utensils },
  { key: "pizza", label: "Pizza", Icon: Pizza },
  { key: "coffee", label: "Cafe", Icon: Coffee },
  { key: "bus", label: "Transporte", Icon: Bus },
  { key: "car", label: "Auto", Icon: Car },
  { key: "bike", label: "Bicicleta", Icon: Bike },
  { key: "train", label: "Tren", Icon: Train },
  { key: "fuel", label: "Combustible", Icon: Fuel },
  { key: "heart-pulse", label: "Salud", Icon: HeartPulse },
  { key: "hospital", label: "Hospital", Icon: Hospital },
  { key: "medical", label: "Medico", Icon: BriefcaseMedical },
  { key: "graduation-cap", label: "Educacion", Icon: GraduationCap },
  { key: "book", label: "Libros", Icon: BookOpen },
  { key: "laptop", label: "Computador", Icon: Laptop },
  { key: "smartphone", label: "Celular", Icon: Smartphone },
  { key: "wifi", label: "Internet", Icon: Wifi },
  { key: "paw-print", label: "Mascotas", Icon: PawPrint },
  { key: "shirt", label: "Ropa", Icon: Shirt },
  { key: "scissors", label: "Belleza", Icon: Scissors },
  { key: "gift", label: "Regalos", Icon: Gift },
  { key: "gamepad", label: "Entretencion", Icon: Gamepad2 },
  { key: "music", label: "Musica", Icon: Music },
  { key: "popcorn", label: "Cine", Icon: Popcorn },
  { key: "ticket", label: "Evento", Icon: Ticket },
  { key: "plane", label: "Viajes", Icon: Plane },
  { key: "tree-palm", label: "Vacaciones", Icon: TreePalm },
  { key: "trending-up", label: "Inversion", Icon: TrendingUp },
  { key: "credit-card", label: "Tarjeta", Icon: CreditCard },
  { key: "receipt", label: "Cuenta", Icon: ReceiptText },
  { key: "shield", label: "Seguro", Icon: ShieldCheck },
  { key: "alert", label: "Urgente", Icon: BadgeAlert },
  { key: "transfer", label: "Transferencia", Icon: ArrowRightLeft },
  { key: "baby", label: "Familia", Icon: Baby },
  { key: "handshake", label: "Acuerdo", Icon: Handshake },
  { key: "heart-handshake", label: "Ayuda", Icon: HeartHandshake },
  { key: "cake", label: "Celebracion", Icon: Cake },
  { key: "sprout", label: "Jardin", Icon: Sprout },
  { key: "hammer", label: "Arreglos", Icon: Hammer },
  { key: "wrench", label: "Mantencion", Icon: Wrench },
  { key: "dumbbell", label: "Deporte", Icon: Dumbbell }
];

const iconChoiceMap = Object.fromEntries(iconChoices.map((choice) => [choice.key, choice]));

const categoryColors = {
  "Sin definir": "#b7791f",
  Sueldo: "#187246",
  Honorarios: "#2563eb",
  Bonos: "#0f766e",
  "Ingreso Extra": "#2f8f5b",
  "Balance Anterior": "#64748b",
  Inversiones: "#155e63",
  Reembolso: "#0891b2",
  Regalos: "#be123c",
  Otros: "#475569",
  Ahorro: "#2f8f5b",
  Casa: "#155e63",
  Supermercado: "#d97745",
  Alimentacion: "#c2410c",
  "Servicios Basicos": "#b45309",
  "Arriendo / Dividendo": "#7c3aed",
  Transporte: "#2f6fb0",
  Combustible: "#b91c1c",
  Salud: "#be123c",
  Educacion: "#2563eb",
  Mascotas: "#0f766e",
  Ropa: "#7c3aed",
  Impuestos: "#475569",
  Seguros: "#0f766e",
  Suscripciones: "#2f6fb0",
  Entretenimiento: "#9333ea",
  Restaurantes: "#c2410c",
  Viajes: "#0284c7",
  Emergencias: "#dc2626",
  Transferencia: "#64748b",
  "Pago Tarjeta": "#7c3aed",
  "Tarjeta de Credito": "#7c3aed"
};

let customCategoryVisuals = {};

export function setCustomCategoryVisuals(categories = []) {
  customCategoryVisuals = Object.fromEntries(
    categories
      .filter((category) => category?.name)
      .map((category) => [
        category.name,
        {
          icon: category.icon || "",
          color: category.color || ""
        }
      ])
  );
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inferCategoryIcon(category) {
  const normalized = normalizeText(category);
  if (normalized.includes("super")) return ShoppingCart;
  if (normalized.includes("comida") || normalized.includes("rest")) return Utensils;
  if (normalized.includes("salud") || normalized.includes("farmacia")) return HeartPulse;
  if (normalized.includes("viaj")) return Plane;
  if (normalized.includes("auto") || normalized.includes("transporte")) return Bus;
  if (normalized.includes("tarjeta")) return CreditCard;
  if (normalized.includes("inver")) return TrendingUp;
  if (normalized.includes("regalo")) return Gift;
  if (normalized.includes("casa") || normalized.includes("hogar")) return Home;
  return CircleHelp;
}

export function getCategoryMeta(category, iconKey = "", colorOverride = "") {
  const name = category || "Sin definir";
  const customMeta = customCategoryVisuals[name] || {};
  const Icon = iconChoiceMap[iconKey || customMeta.icon]?.Icon || categoryIcons[name] || inferCategoryIcon(name);
  return {
    Icon,
    color: colorOverride || customMeta.color || categoryColors[name] || "#475569"
  };
}

export function getCategoryStyle(category, iconKey = "", color = "") {
  return { "--category-color": getCategoryMeta(category, iconKey, color).color };
}

export function CategoryBadge({ category, compact = false, iconKey = "", color = "", iconOnly = false }) {
  const { Icon, color: categoryColor } = getCategoryMeta(category, iconKey, color);
  const name = category || "Sin definir";

  return (
    <span className={`category-badge ${compact ? "compact" : ""} ${iconOnly ? "icon-only" : ""}`} style={{ "--category-color": categoryColor }} title={name}>
      <span className="category-icon">
        <Icon size={compact ? 12 : 14} aria-hidden="true" />
      </span>
      {!iconOnly && <span className="category-name">{name}</span>}
    </span>
  );
}

export function CategoryIconPicker({ value = "", onChange, variant = "button" }) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef(null);
  const selectedKey = value && iconChoiceMap[value] ? value : "circle-help";
  const SelectedIcon = iconChoiceMap[selectedKey].Icon;

  useEffect(() => {
    function handlePointerDown(event) {
      if (!pickerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function selectIcon(key) {
    onChange(key);
    setIsOpen(false);
  }

  const iconGrid = (
    <div className={`category-icon-menu ${variant === "grid" ? "inline" : ""}`} role="radiogroup" aria-label="Icono de categoria">
      {iconChoices.map(({ key, label, Icon }) => (
        <button
          type="button"
          className={selectedKey === key ? "active" : ""}
          key={key}
          onClick={() => selectIcon(key)}
          aria-pressed={selectedKey === key}
          title={label}
        >
              <Icon size={variant === "grid" ? 20 : 16} aria-hidden="true" />
        </button>
      ))}
    </div>
  );

  if (variant === "grid") {
    return <div className="category-icon-picker grid-mode">{iconGrid}</div>;
  }

  return (
    <div className="category-icon-picker" ref={pickerRef}>
      <button type="button" className="category-icon-trigger" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen} aria-label="Cambiar icono">
        <SelectedIcon size={16} aria-hidden="true" />
      </button>
      {isOpen && iconGrid}
    </div>
  );
}

export function CategorySelector({ categories, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef(null);
  const selectedCategory = categories.includes(value) ? value : categories[0] || value || "Sin definir";

  useEffect(() => {
    function handlePointerDown(event) {
      if (!pickerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function selectCategory(category) {
    onChange(category);
    setIsOpen(false);
  }

  return (
    <fieldset className="category-picker" ref={pickerRef}>
      <legend>Categoria</legend>
      <button
        type="button"
        className={`category-select-trigger ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <CategoryBadge category={selectedCategory} />
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="category-option-list" role="listbox" aria-label="Categoria">
          {categories.map((category) => {
            const { color } = getCategoryMeta(category);
            const isActive = category === selectedCategory;
            return (
              <button
                type="button"
                className={`category-option ${isActive ? "active" : ""}`}
                key={category}
                onClick={() => selectCategory(category)}
                role="option"
                aria-selected={isActive}
                style={{ "--category-color": color }}
                title={category}
              >
                <CategoryBadge category={category} />
                {isActive && <Check size={16} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
