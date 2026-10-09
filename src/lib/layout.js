// Misma condicion que las media queries moviles de styles.css: pantallas angostas o
// celulares en horizontal (bajos y tactiles).
export const MOBILE_LAYOUT_QUERY = "(max-width: 720px), (max-height: 500px) and (pointer: coarse)";

export function isMobileLayout() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
}
