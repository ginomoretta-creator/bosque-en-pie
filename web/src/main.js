import "./styles.css";
import { captureKeyFromHash } from "./wallet.js";
import { NET, NETWORK, deployment, explorerAddress, explorerTx, store } from "./chain.js";
import { currentPath, match, route } from "./router.js";
import { esc, short } from "./format.js";
import { icon, logo, txLink } from "./ui.js";
import { inicio } from "./pages/inicio.js";
import { parcela } from "./pages/parcela.js";
import { actividad, describe } from "./pages/actividad.js";
import { informe } from "./pages/informe.js";
import "./aportar/index.js"; // carril 4

// La clave del QR se saca antes de que el router lea el fragmento.
captureKeyFromHash();

route("/", inicio);
route("/parcela/:id", parcela);
route("/parcela/:id/:mes", informe);
route("/actividad", actividad);

const NAV = [
  ["/", "Parcelas"],
  ["/actividad", "Actividad"],
  ["/mi-aporte", "Mi aporte"],
];

const app = document.getElementById("app");
const contractUrl = explorerAddress(deployment?.address);

app.innerHTML = `
  <header class="top">
    <a class="top-logo" href="#/">${logo()}</a>
    <nav class="top-nav">${NAV.map(([p, t]) => `<a href="#${p}" data-path="${p}">${t}</a>`).join("")}</nav>
    <a class="btn btn-dark btn-sm" href="#/aportar">Aportar</a>
  </header>
  <div class="netbar"><span class="netpill net-${NETWORK}"><i></i>${esc(NET.label)} · no es plata real</span></div>
  <div id="status" role="status" aria-live="polite"></div>
  <main id="view"></main>
  <div id="toasts" class="toasts" aria-live="polite"></div>
  <footer class="foot">
    <div class="foot-cols">
      <div><strong>Bosque en pie</strong><p>Pago por conservar monte, verificado por satélite.<br>Competencia Argentina Space · Salta</p></div>
      <div><strong>Contrato</strong><p>${
        deployment
          ? contractUrl
            ? `<a href="${esc(contractUrl)}" target="_blank" rel="noopener">${short(deployment.address)} ↗</a>`
            : `<span class="mono">${short(deployment.address)}</span>`
          : "sin desplegar"
      }<br>${esc(NET.label)}</p></div>
      <div><strong>Código</strong><p><a href="https://github.com/ginomoretta-creator/bosque-en-pie" target="_blank" rel="noopener">GitHub ↗</a></p></div>
    </div>
    <p class="foot-attr mono-sm">Contiene datos Copernicus Sentinel modificados, 2024, 2025 y 2026</p>
  </footer>`;

/** Aviso de conexión en palabras simples; el detalle técnico queda plegado. */
function statusNotice(s) {
  if (!s.error) return "";
  if (!deployment) return `<div class="notice notice-terra"><div><strong>Todavía no hay contrato en ${esc(NET.label)}</strong><p>${esc(s.error)}</p></div></div>`;
  const stale = s.lastBlock !== null;
  const when = s.updatedAt ? s.updatedAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : null;
  return `<div class="notice notice-terra"><div>
    <strong>${stale ? `Se cortó la conexión con ${esc(NET.label)}` : `Conectando con ${esc(NET.label)}…`}</strong>
    <p>${stale ? `Lo que ves es la última lectura${when ? ` (${when})` : ""}.` : "La red de prueba tarda en responder."} Reintentamos solos cada pocos segundos.</p>
    <details class="mono-sm"><summary>Detalle técnico</summary>${esc(s.error)}</details>
  </div></div>`;
}

const view = document.getElementById("view");
const statusEl = document.getElementById("status");
let lastSig = null;
let lastPath = null;
let hadData = false;
let cleanup = null;

function render(force = false) {
  const s = store.state;
  const path = currentPath();
  const m = match(path);
  const sig = `${path}|${s.version}|${s.loading}|${s.error}`;
  if (!force && sig === lastSig) return;
  statusEl.innerHTML = statusNotice(s);
  // Pantallas con formulario (live: false): se pintan al entrar y con la primera lectura, no con cada bloque.
  if (!force && path === lastPath && m && !m.route.live && hadData) return;
  lastSig = sig;
  const firstData = !hadData && s.lastBlock !== null;
  hadData = s.lastBlock !== null;
  if (cleanup) cleanup();
  cleanup = null;
  const out = m ? m.route.render(m.params, s) : `<section class="page narrow"><h1 class="h1">No encontramos esa página</h1><a class="btn" href="#/">Volver</a></section>`;
  view.innerHTML = typeof out === "string" ? out : out.html;
  if (out?.mount) cleanup = out.mount(view) || null;

  for (const a of document.querySelectorAll(".top-nav a")) {
    const p = a.dataset.path;
    a.classList.toggle("on", p === "/" ? path === "/" || path.startsWith("/parcela") : path.startsWith(p));
  }
  if (path !== lastPath) window.scrollTo(0, 0);
  if (path !== lastPath || firstData) enter();
  lastPath = path;
}

// ------------------------------------------------------------------ movimiento
// Solo al entrar a una pantalla (no con cada bloque nuevo) y nunca con «reducir movimiento».
const calm = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
let enterTimer = null;

function enter() {
  if (calm()) return;
  view.classList.remove("enter");
  void view.offsetWidth;
  view.classList.add("enter");
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => view.classList.remove("enter"), 1600);
  for (const el of view.querySelectorAll(".big, .pcard-cover")) countUp(el);
}

/** «100,0» sube desde 0 con el mismo formato (coma decimal); el resto del contenido (el % chico) no se toca. */
function countUp(el) {
  const node = el.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  const m = node.textContent.trim().match(/^(\d{1,3}(?:\.\d{3})*),(\d)$/);
  if (!m) return;
  const target = Number(m[1].replaceAll(".", "") + "." + m[2]);
  const final = node.textContent;
  const t0 = performance.now();
  const dur = 900;
  const fmt = (v) => v.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const step = (now) => {
    if (!node.isConnected) return;
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    node.textContent = k < 1 ? fmt(target * e) : final;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ------------------------------------------------------------------ en vivo
// Cuando llega un evento nuevo del contrato (por ejemplo, el aporte del jurado con el QR), se avisa en pantalla.
const toasts = document.getElementById("toasts");
const evKey = (e) => `${e.transactionHash}:${e.logIndex}`;
let seen = null;

function toast(d, e) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `${icon(d.ic)}
    <div class="toast-body"><p class="toast-k mono-sm"><i></i>En vivo · recién en el contrato</p><p>${d.text}</p>
    <p class="toast-tx">${txLink(explorerTx(e.transactionHash), "ver la transacción")}</p></div>
    <button type="button" class="toast-x" aria-label="Cerrar">×</button>`;
  el.querySelector(".toast-x").addEventListener("click", () => close());
  const close = () => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 300);
  };
  toasts.prepend(el);
  while (toasts.children.length > 3) toasts.lastElementChild.remove();
  setTimeout(close, 10_000);
}

function watchLive(s) {
  if (s.lastBlock === null) return;
  if (!seen) {
    seen = new Set(s.events.map(evKey));
    return;
  }
  const fresh = s.events.filter((e) => !seen.has(evKey(e)));
  if (!fresh.length) return;
  for (const e of fresh) seen.add(evKey(e));
  const byTx = new Map();
  for (const e of s.events) byTx.set(e.transactionHash, [...(byTx.get(e.transactionHash) || []), e]);
  for (const e of fresh) {
    const d = describe(e, byTx.get(e.transactionHash));
    if (d) toast(d, e);
  }
}

window.addEventListener("hashchange", () => render(true));
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-scroll]");
  if (!a) return;
  e.preventDefault();
  document.getElementById(a.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
});

// Solo en desarrollo: __olvidar(n) hace como si los últimos n eventos fueran nuevos, para probar los avisos.
if (import.meta.env.DEV) {
  window.__olvidar = (n = 1) => {
    for (const e of store.state.events.slice(-n)) seen?.delete(evKey(e));
    watchLive(store.state);
  };
}

store.subscribe((s) => {
  render();
  watchLive(s);
});
render(true);
store.start();
