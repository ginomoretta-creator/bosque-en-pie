// Piezas de la marca v2 (design/assets): logo en línea e íconos propios. Sin emoji (#39).
import logoHorizontal from "../../design/assets/logo/horizontal.svg?raw";
import logoSigno from "../../design/assets/logo/signo.svg?raw";
import { STATUS, STATUS_KEY } from "./chain.js";
import { esc } from "./format.js";

const icons = import.meta.glob("../../design/assets/iconos/*.svg", { eager: true, query: "?raw", import: "default" });

/** icon("tree") → <span class="ic">…svg…</span>. Nombres: los archivos de design/assets/iconos/. */
export function icon(name, cls = "") {
  const svg = icons[`../../design/assets/iconos/${name}.svg`];
  if (!svg) return "";
  return `<span class="ic ${cls}" aria-hidden="true">${svg}</span>`;
}

export const logo = (kind = "horizontal") =>
  `<span class="logo logo-${kind}" role="img" aria-label="Bosque en pie">${kind === "signo" ? logoSigno : logoHorizontal}</span>`;

/** Chip de estado de una parcela (status del contrato). */
export const statusChip = (status) =>
  `<span class="chip chip-${STATUS_KEY[status] || "none"}"><i></i>${esc(STATUS[status] || "—")}</span>`;

/** Enlace al explorer si la red tiene; si no, el hash corto en mono. */
export function txLink(url, text) {
  return url
    ? `<a class="mono tx" href="${esc(url)}" target="_blank" rel="noopener">${esc(text)} ↗</a>`
    : `<span class="mono tx">${esc(text)}</span>`;
}

const MES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * Doce cuadros, uno por mes: pagado, en revisión, corte, nubes, sin informe.
 * Con `folders` (las carpetas de reports/ de la parcela), cada mes con datos es un link a su informe.
 */
const MES_LARGO = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const LEYENDA = [
  ["ok", "en pie · pagó la cuota"],
  ["cloud", "nubes · ni paga ni corta"],
  ["review", "lectura mala · en revisión"],
  ["cut", "segunda lectura mala · corte"],
  ["off", "pagos cortados"],
  ["empty", "sin informe todavía"],
];

export function monthStrip(p, { labels = true, folders = null } = {}) {
  const year = p.reports.length
    ? new Date(p.reports[0].tObs * 1000).getUTCFullYear()
    : Number(Object.keys(folders || {})[0]?.slice(0, 4)) || 2025;
  const byMonth = new Map();
  for (const r of p.reports) {
    const d = new Date(r.tObs * 1000);
    if (d.getUTCFullYear() === year) byMonth.set(d.getUTCMonth(), r);
  }
  const cells = MES.map((m, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const r = byMonth.get(i);
    const f = folders?.[key];
    let cls = "empty";
    let title = "sin informe";
    if (r) {
      if (r.standing) (cls = "ok"), (title = "en pie · pagó");
      else if (r.status === 3) (cls = "cut"), (title = "segunda lectura mala · pagos cortados");
      else (cls = "review"), (title = "lectura mala · en revisión");
    } else if (f?.skip) (cls = "cloud"), (title = "sin informe · nubes");
    else if (p.status === 3) (cls = "off"), (title = "pagos cortados");
    const inner = `<i></i>${labels ? `<span>${m}</span>` : ""}`;
    const label = `${MES_LARGO[i]} ${year}: ${title}`;
    return folders && (r || f)
      ? `<li class="m m-${cls}"><a href="#/parcela/${p.id}/${key}" title="${label}" aria-label="${label}">${inner}</a></li>`
      : `<li class="m m-${cls}" title="${label}">${inner}</li>`;
  });
  const inYear = (t) => new Date(t * 1000).getUTCFullYear() === year;
  const paid = p.reports.filter((r) => r.standing && inYear(r.tObs)).length;
  // Informes de otro año (por ejemplo el que se manda en vivo en la demo): van aparte, debajo de la tira.
  const fmt = (key) => { const [y, mm] = key.split("-"); return `${MES_LARGO[Number(mm) - 1].toLowerCase()} ${y}`; };
  const later = new Map();
  for (const r of p.reports) if (!inYear(r.tObs)) later.set(new Date(r.tObs * 1000).toISOString().slice(0, 7), r);
  for (const k of Object.keys(folders || {})) if (!k.startsWith(`${year}-`) && !later.has(k) && folders[k].report) later.set(k, null);
  const extra = [...later.keys()].sort().map((k) => {
    const r = later.get(k);
    const t = !r ? "listo para enviar en vivo" : r.standing ? "en pie · pagó la cuota" : r.status === 3 ? "corte" : "lectura mala · en revisión";
    const cls = !r ? "empty" : r.standing ? "ok" : r.status === 3 ? "cut" : "review";
    return `<li class="m-${cls}"><i></i><a href="#/parcela/${p.id}/${k}">${fmt(k)}</a> · ${t}</li>`;
  }).join("");
  const used = [...new Set(cells.map((c) => c.match(/m-(\w+)/)[1]))];
  const legend = `<ul class="mlegend">${LEYENDA.filter(([k]) => used.includes(k)).map(([k, t]) => `<li class="m-${k}"><i></i>${t}</li>`).join("")}</ul>`;
  return { html: `<ol class="months">${cells.join("")}</ol>`, year, paid, legend, extra: extra ? `<ul class="mlegend mlater">${extra}</ul>` : "" };
}
