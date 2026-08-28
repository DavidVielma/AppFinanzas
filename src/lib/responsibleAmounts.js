export function parseResponsibleAmounts(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  const raw = String(value || "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function getResponsibleAmount(movement, responsible, responsibleCount = 1) {
  const amounts = parseResponsibleAmounts(movement?.responsible_amounts);
  const matchingKey = Object.keys(amounts).find((name) => name.toLocaleLowerCase("es") === String(responsible || "").toLocaleLowerCase("es"));
  const customAmount = matchingKey ? Number(amounts[matchingKey]) : NaN;
  if (Number.isFinite(customAmount) && customAmount >= 0) return customAmount;
  return Math.abs(Number(movement?.original_amount ?? movement?.amount ?? 0)) / Math.max(1, responsibleCount);
}
