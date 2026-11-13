import "./styles.css";
import { captureKeyFromHash } from "./wallet.js";
import { NET, NETWORK, deployment, explorerAddress, store } from "./chain.js";
import { currentPath, match, route } from "./router.js";
import { esc, short } from "./format.js";
import { logo } from "./ui.js";
import { inicio } from "./pages/inicio.js";
import { parcela } from "./pages/parcela.js";
import { actividad } from "./pages/actividad.js";
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
    <p class="foot-attr mono-sm">Contiene datos Copernicus Sentinel modificados, 2024 y 2025</p>
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
  lastPath = path;
}

window.addEventListener("hashchange", () => render(true));
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-scroll]");
  if (!a) return;
  e.preventDefault();
  document.getElementById(a.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
});

store.subscribe(() => render());
render(true);
store.start();
