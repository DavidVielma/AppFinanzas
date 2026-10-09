import { isMobileLayout } from "./layout.js";

// Animacion de salida de los modales en movil. React desmonta el modal al cerrarlo (cada
// modal se cierra desde muchos lugares), asi que en vez de retrasar cada cierre se deja
// una copia visual del modal que baja y se desvanece, y luego se elimina. La copia no
// recibe toques ni la leen los lectores de pantalla.
const EXIT_DURATION_MS = 260;
const panelScroll = new WeakMap();

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function playExit(backdrop) {
  const ghost = backdrop.cloneNode(true);
  ghost.classList.add("is-closing");
  ghost.setAttribute("aria-hidden", "true");
  ghost.removeAttribute("role");
  ghost.inert = true;
  document.body.appendChild(ghost);

  // El panel clonado parte con el mismo desplazamiento interno que tenia el original.
  const panel = ghost.querySelector(".modal-panel");
  const originalPanel = backdrop.querySelector(".modal-panel");
  if (panel && originalPanel && panelScroll.has(originalPanel)) panel.scrollTop = panelScroll.get(originalPanel);

  const remove = () => ghost.remove();
  ghost.addEventListener("animationend", (event) => { if (event.target === ghost) remove(); });
  window.setTimeout(remove, EXIT_DURATION_MS + 120);
}

export function installModalExitAnimation() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return;

  // Guarda el desplazamiento de cada panel: un nodo ya desmontado lo pierde.
  document.addEventListener("scroll", (event) => {
    if (event.target instanceof Element && event.target.matches(".modal-panel")) panelScroll.set(event.target, event.target.scrollTop);
  }, true);

  const observer = new MutationObserver((mutations) => {
    if (!isMobileLayout() || prefersReducedMotion()) return;
    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        if (!(node instanceof HTMLElement) || node.classList.contains("is-closing")) continue;
        const backdrops = node.matches(".modal-backdrop") ? [node] : node.querySelectorAll(".modal-backdrop");
        backdrops.forEach(playExit);
      }
    }
  });
  observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
}
