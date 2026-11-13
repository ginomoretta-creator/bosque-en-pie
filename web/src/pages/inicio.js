// Inicio: portada y una tarjeta por parcela con datos leídos del contrato.
import { NET } from "../chain.js";
import { avax, esc, int, month, pct } from "../format.js";
import { drawMap } from "../map.js";
import { go } from "../router.js";
import { icon, monthStrip, statusChip } from "../ui.js";
import { describe } from "./actividad.js";

function parcelCard(p) {
  const strip = monthStrip(p, { labels: false });
  const cover = p.lastReport ? `${pct(p.lastReport.coverBps)}<small>%</small>` : "—";
  return `
  <a class="pcard pcard-${p.status}" href="#/parcela/${p.id}">
    <div class="pcard-h">
      <h3>${esc(p.name)}</h3>
      ${statusChip(p.status)}
    </div>
    <div class="pcard-cover">${cover}</div>
    <p class="pcard-sub">${p.lastReport ? `del monte de la base sigue en pie · ${month(p.lastReport.tObs)}` : "todavía sin informes"}</p>
    ${strip.html}
    <dl class="pcard-facts">
      <div><dt>${p.status === 3 ? "Saldo al corte" : "En el pozo"}</dt><dd>${avax(p.status === 3 ? p.refundPool + p.restorePool : p.balance)} AVAX</dd></div>
      <div><dt>Cuota</dt><dd>${avax(p.fee)}</dd></div>
      <div><dt>Superficie</dt><dd>${int(p.hectares)} ha</dd></div>
    </dl>
  </a>`;
}

/** Hace cuánto, en criollo: «hace 3 min», «hace 2 h», «hace 5 días». */
function ago(ts) {
  const d = Math.max(0, Date.now() / 1000 - Number(ts));
  if (d < 60) return "recién";
  if (d < 3600) return `hace ${Math.floor(d / 60)} min`;
  if (d < 86400) return `hace ${Math.floor(d / 3600)} h`;
  const n = Math.floor(d / 86400);
  return `hace ${n} ${n === 1 ? "día" : "días"}`;
}

/** Tarjeta «En vivo»: los últimos movimientos del contrato. Un aporte nuevo aparece acá a los pocos segundos. */
function liveCard(s) {
  const byTx = new Map();
  for (const e of s.events) byTx.set(e.transactionHash, [...(byTx.get(e.transactionHash) || []), e]);
  const items = [];
  for (const e of [...s.events].reverse()) {
    const d = describe(e, byTx.get(e.transactionHash));
    if (d) items.push(`<li>${icon(d.ic)}<div><p>${d.text}</p><p class="muted mono-sm">${ago(e.timestamp)}</p></div></li>`);
    if (items.length === 2) break;
  }
  return `
  <a class="pcard pcard-live" href="#/actividad">
    <div class="pcard-h"><h3>En vivo</h3><span class="live-dot"><i></i>${s.lastBlock !== null ? `bloque ${s.lastBlock}` : "conectando"}</span></div>
    <p class="pcard-sub">Lo último en el contrato. Un aporte nuevo aparece acá solo.</p>
    ${items.length ? `<ul class="live-list">${items.join("")}</ul>` : `<p class="muted">Todavía no hay movimientos.</p>`}
    <p class="live-more">Ver toda la actividad →</p>
  </a>`;
}

export function inicio(_params, s) {
  const parcels = s.parcels.length
    ? s.parcels.map(parcelCard).join("") + liveCard(s)
    : `<p class="muted">${s.loading ? "Leyendo el contrato…" : "Todavía no hay parcelas registradas."}</p>`;
  const html = `
  <div class="hero-grid">
  <section class="hero">
    <div class="hero-txt">
      <p class="tag"><i></i>Verificado por Sentinel-2 · en Avalanche</p>
      <h1>Tu plata <mark>cuida</mark> el monte.</h1>
      <p class="lead">Dejás AVAX en un contrato. Cada mes que una imagen satelital confirma que la parcela sigue en pie, el contrato paga a quienes la cuidan. Si aparece un desmonte, los pagos se cortan.</p>
      <div class="hero-cta">
        <a class="btn btn-lima" href="#/" data-scroll="parcelas">Elegir una parcela →</a>
        <a class="btn btn-ghost" href="#/actividad">Ver la actividad</a>
      </div>
    </div>
    <div class="hero-ic">${icon("tree")}</div>
  </section>
  <section class="mapcard" aria-label="Mapa de las parcelas">
    <div id="mapa" class="map"></div>
    <p class="map-cap mono-sm">Chaco salteño · departamento Rivadavia</p>
  </section>
  </div>

  <section class="block" id="parcelas">
    <div class="block-h"><p class="eyebrow">01 / Parcelas</p><span class="muted mono-sm">${esc(NET.label)}</span></div>
    <div class="pgrid">${parcels}</div>
  </section>

  <section class="block steps">
    <article>${icon("coins")}<p class="eyebrow">01 · Aportás</p><h3>Tu AVAX queda en el contrato</h3><p>Elegís una parcela y qué pasa con tu saldo si hay desmonte: vuelve a vos o va a restaurar.</p></article>
    <article>${icon("satellite")}<p class="eyebrow">02 · El satélite mira</p><h3>Una imagen por mes</h3><p>Sentinel-2 compara la parcela con el mismo mes del año anterior. Cualquiera puede rehacer la cuenta.</p></article>
    <article>${icon("sigs")}<p class="eyebrow">03 · Firman 2 de 3</p><h3>Tres verificadores</h3><p>El informe vale con dos firmas de tres. Hacen falta dos lecturas malas seguidas para cortar.</p></article>
    <article>${icon("tree")}<p class="eyebrow">04 · Pago o corte</p><h3>El monte paga a quien lo cuida</h3><p>En pie: cuota para el dueño y el operador. Desmonte: se corta para siempre y nadie cobra por eso.</p></article>
  </section>`;

  return {
    html,
    mount(el) {
      const map = drawMap(el.querySelector("#mapa"), s.parcels, { onSelect: (p) => go(`/parcela/${p.id}`) });
      return () => map.remove();
    },
  };
}
