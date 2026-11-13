// Formatos en español (Argentina): coma decimal, fechas en UTC (las imágenes son de días UTC).
import { formatEther } from "viem";

const nf = (min, max) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: min, maximumFractionDigits: max });

/** wei (bigint) → "0,12" */
export function avax(wei, decimals = 2) {
  const n = Number(formatEther(wei ?? 0n));
  if (n !== 0 && Math.abs(n) < 0.01) return nf(2, 4).format(n);
  return nf(decimals, decimals).format(n);
}

/** 9930 → "99,3" */
export const pct = (bps) => nf(1, 1).format(Number(bps) / 100);

export const int = (n) => nf(0, 0).format(Number(n));

export const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** unix → "jul 2025" */
export function month(unix) {
  const d = new Date(Number(unix) * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** unix → "15 jul 2025" */
export function day(unix) {
  const d = new Date(Number(unix) * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** unix → "12/11 20:31" en hora local del navegador */
export function dateTime(unix) {
  if (!unix) return "";
  return new Date(Number(unix) * 1000).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const short = (hex, a = 6, b = 4) => (hex ? `${hex.slice(0, a)}…${hex.slice(-b)}` : "");

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
