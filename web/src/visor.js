// Visor satelital de la parcela: la imagen real de cada mes, con la marca de pérdida y un «Ver el año»
// que recorre los doce meses. Usa las imágenes de reports/ (rgb.png y perdida.png) que ya publica la web.
import { esc, pct } from "./format.js";
import { statusChip } from "./ui.js";
import { parcelMap } from "./map.js";

const MES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const STEP_MS = 1100;
const TONE = { ok: "#6CC58A", review: "#E2B04A", cut: "#E58A66", off: "#E58A66", cloud: "#F4F2EC", empty: "#F4F2EC", ready: "#6CC58A" };

// Lo que eligió cada quien por parcela (mes y marca de pérdida): sobrevive a los repintados por bloques nuevos.
const memo = new Map();

const monthOf = (unix) => new Date(Number(unix) * 1000).toISOString().slice(0, 7);
const longKey = (key) => {
  const [y, m] = key.split("-");
  return `${MES_LARGO[Number(m) - 1]} ${y}`;
};
const isoDay = (iso) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

/** Un mes del visor: qué dijo el contrato (o el oráculo, si no se envió) y qué imágenes hay. */
function frame(p, key, folder, byMonth) {
  const r = byMonth.get(key);
  let cls = "empty";
  let what = "sin informe todavía";
  let chip = "";
  if (r) {
    if (r.standing) (cls = "ok"), (what = "en pie · pagó la cuota");
    else if (r.status === 3) (cls = "cut"), (what = "segunda lectura mala · pagos cortados");
    else (cls = "review"), (what = "lectura mala · en revisión");
    chip = statusChip(r.status);
  } else if (folder?.skip) (cls = "cloud"), (what = "nubes · no hubo informe");
  else if (p.status === 3) (cls = "off"), (what = "pagos cortados · ya no se envían informes");
  else if (folder?.report) (cls = "ready"), (what = "listo para enviar en vivo");
  const cover = r ? r.coverBps : folder?.report?.coverBps;
  return {
    key,
    cls,
    what,
    chip,
    cover: cover === undefined || folder?.skip ? null : cover,
    date: folder?.evidence?.imagen?.fecha || null,
    rgb: folder?.rgb || null,
    loss: folder?.perdida || null,
  };
}

/**
 * Arma el visor. Devuelve null si la parcela no tiene imágenes en reports/.
 * `year` es el año de la tira de doce meses; los meses de otros años con imagen van al final.
 */
export function visor(p, folders, year, letter) {
  const keys = Object.keys(folders || {}).filter((k) => folders[k].rgb).sort();
  if (!keys.length) return null;
  const byMonth = new Map(p.reports.map((r) => [monthOf(r.tObs), r]));
  const yearKeys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const order = [...yearKeys.filter((k) => folders[k]?.rgb), ...keys.filter((k) => !k.startsWith(`${year}-`))];
  const frames = order.map((k) => frame(p, k, folders[k], byMonth));

  // Por defecto: el último informe aplicado (lo que hoy dice el contrato).
  const applied = frames.filter((f) => byMonth.has(f.key));
  const saved = memo.get(p.id);
  const start = frames.find((f) => f.key === saved?.key) || applied.at(-1) || frames.at(-1);

  const buttons = frames
    .map((f) => {
      const [y, m] = f.key.split("-");
      const lbl = y === String(year) ? MES[Number(m) - 1] : `${MES[Number(m) - 1]}·${y.slice(2)}`;
      return `<li class="m m-${f.cls}"><button type="button" data-k="${f.key}" aria-label="${esc(longKey(f.key))}: ${esc(f.what)}" aria-pressed="false"><i></i><span>${lbl}</span></button></li>`;
    })
    .join("");

  const html = `
    <aside class="visor" data-visor aria-label="Imágenes satelitales de ${esc(p.name)}">
      <div class="visor-h">
        <p class="eyebrow">Lo que vio el satélite</p>
        <span class="mono-sm" data-v-date></span>
      </div>
      <div class="visor-img">
        <div class="visor-map" data-v-map></div>
        <span class="visor-play-ind" data-v-ind aria-hidden="true"></span>
      </div>
      <div class="visor-badge"><b data-v-pct></b><span data-v-what></span></div>
      <ol class="months visor-months" role="list">${buttons}</ol>
      <div class="visor-ctl">
        <button type="button" class="btn btn-lima btn-sm" data-v-play>▶ Ver el año</button>
        <label class="tgl"><input type="checkbox" data-v-loss-tgl${saved?.loss ? " checked" : ""}><span>Marcar pérdida</span></label>
        <a class="visor-link" data-v-link href="#">Ver informe →</a>
      </div>
      <p class="visor-foot mono-sm">Sentinel-2 L2A · color real · 10 m por píxel. Con «Marcar pérdida»: <i class="sw sw-v"></i>monte que sigue <i class="sw sw-t"></i>monte perdido.</p>
    </aside>`;

  function mount(root) {
    const el = root.querySelector("[data-visor]");
    if (!el) return null;
    const sat = parcelMap(el.querySelector("[data-v-map]"), letter);
    const pctEl = el.querySelector("[data-v-pct]");
    const whatEl = el.querySelector("[data-v-what]");
    const dateEl = el.querySelector("[data-v-date]");
    const link = el.querySelector("[data-v-link]");
    const play = el.querySelector("[data-v-play]");
    const tgl = el.querySelector("[data-v-loss-tgl]");
    const box = el.querySelector(".visor-img");
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let i = Math.max(0, frames.indexOf(start));
    let timer = null;

    // Precarga: que el «Ver el año» no parpadee.
    for (const f of frames) for (const src of [f.rgb, f.loss]) if (src) new Image().src = src;

    function show(n, { anim = true } = {}) {
      i = n;
      const f = frames[i];
      sat.show(f.rgb, { alt: `Imagen Sentinel-2 en color real de ${p.name}, ${longKey(f.key)}`, lossUrl: f.loss, lossOn: tgl.checked });
      sat.color(TONE[f.cls] || TONE.empty);
      box.dataset.tone = f.cls;
      el.dataset.tone = f.cls;
      pctEl.textContent = f.cover === null ? (f.cls === "cloud" ? "nubes" : "—") : `${pct(f.cover)} %`;
      whatEl.textContent = `${longKey(f.key)} · ${f.what}`;
      dateEl.textContent = f.date ? `imagen del ${isoDay(f.date)}` : "";
      link.href = `#/parcela/${p.id}/${f.key}`;
      for (const b of el.querySelectorAll("[data-k]")) {
        const on = b.dataset.k === f.key;
        b.setAttribute("aria-pressed", String(on));
        b.parentElement.classList.toggle("on", on);
      }
      memo.set(p.id, { key: f.key, loss: tgl.checked });
    }

    function stop() {
      clearInterval(timer);
      timer = null;
      play.textContent = "▶ Ver el año";
      box.classList.remove("playing");
    }
    function startPlay() {
      const first = 0;
      const last = Math.max(0, frames.findIndex((f) => !f.key.startsWith(`${year}-`)) - 1);
      const end = last > 0 ? last : frames.length - 1;
      show(first);
      play.textContent = "❚❚ Pausa";
      box.classList.add("playing");
      timer = setInterval(() => {
        if (i >= end) return stop();
        show(i + 1);
      }, reduce ? STEP_MS * 1.5 : STEP_MS);
    }

    const onClick = (e) => {
      const b = e.target.closest("[data-k]");
      if (b) {
        stop();
        show(frames.findIndex((f) => f.key === b.dataset.k));
        return;
      }
      if (e.target.closest("[data-v-play]")) timer ? stop() : startPlay();
    };
    const onKey = (e) => {
      if (!e.target.closest("[data-k]")) return;
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      stop();
      const n = Math.min(frames.length - 1, Math.max(0, i + d));
      show(n);
      el.querySelector(`[data-k="${frames[n].key}"]`)?.focus();
    };
    const onTgl = () => show(i, { anim: false });

    el.addEventListener("click", onClick);
    el.addEventListener("keydown", onKey);
    tgl.addEventListener("change", onTgl);
    show(i, { anim: false });

    return () => {
      stop();
      sat.destroy();
      el.removeEventListener("click", onClick);
      el.removeEventListener("keydown", onKey);
      tgl.removeEventListener("change", onTgl);
    };
  }

  return { html, mount };
}
