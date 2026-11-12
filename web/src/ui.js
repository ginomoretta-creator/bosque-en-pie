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

/** Doce cuadros, uno por mes del año de los informes: pagado, en revisión, corte, sin informe. */
export function monthStrip(p, { labels = true } = {}) {
  const year = p.reports.length ? new Date(p.reports[0].tObs * 1000).getUTCFullYear() : 2025;
  const byMonth = new Map();
  for (const r of p.reports) {
    const d = new Date(r.tObs * 1000);
    if (d.getUTCFullYear() === year) byMonth.set(d.getUTCMonth(), r);
  }
  const cells = MES.map((m, i) => {
    const r = byMonth.get(i);
    let cls = "empty";
    let title = "sin informe";
    if (r) {
      if (r.standing) (cls = "ok"), (title = "en pie · pagó");
      else if (r.status === 3) (cls = "cut"), (title = "segunda lectura mala · pagos cortados");
      else (cls = "review"), (title = "lectura mala · en revisión");
    } else if (p.status === 3) cls = "off";
    return `<li class="m m-${cls}" title="${MES[i]} ${year}: ${title}"><i></i>${labels ? `<span>${m}</span>` : ""}</li>`;
  });
  const paid = p.reports.filter((r) => r.standing).length;
  return { html: `<ol class="months">${cells.join("")}</ol>`, year, paid };
}
