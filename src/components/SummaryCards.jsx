import { ArrowDownCircle, ArrowUpCircle, CalendarDays, Scale } from "lucide-react";
import { formatCurrency } from "../lib/finance";

export function SummaryCards({ summary, selectedMonth }) {
  const month = summary.monthly.find((item) => item.month === selectedMonth);

  const cards = [
    { label: "Ingresos del mes", value: month?.income, icon: ArrowUpCircle, tone: "income" },
    { label: "Egresos del mes", value: month?.expenses, icon: ArrowDownCircle, tone: "expense" },
    { label: "Balance mensual", value: month?.balance, icon: Scale, tone: month?.balance >= 0 ? "income" : "expense" },
    { label: "Balance anual", value: summary.annualBalance, icon: CalendarDays, tone: summary.annualBalance >= 0 ? "income" : "expense" }
  ];

  return (
    <section className="summary-grid">
      {cards.map(({ label, value, icon: Icon, tone }) => (
        <article className="summary-card" key={label}>
          <div className={`summary-icon ${tone}`}>
            <Icon size={20} />
          </div>
          <span>{label}</span>
          <strong>{formatCurrency(value)}</strong>
        </article>
      ))}
    </section>
  );
}
