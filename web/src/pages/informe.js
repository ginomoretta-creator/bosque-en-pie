// Informe del mes (#25, pantalla 06 del mock): imagen del mes, pérdida, firmas, pago y evidencia.
// Cruza el informe aplicado en el contrato con su carpeta reports/<P>/<AAAA-MM>/.
import { explorerAddress, explorerTx } from "../chain.js";
import { MONTHS, avax, day, esc, pct, short } from "../format.js";
import { REPORTS_DIR, letterOf, monthKey, reports } from "../reports.js";
import { icon, statusChip, txLink } from "../ui.js";

const longMonth = (key) => {
  const [y, m] = key.split("-");
  const name = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][Number(m) - 1];
  return `${name} ${y}`;
};

const isoDay = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

function signers(r, verifiers) {
  return verifiers
    .map((addr, i) => {
      const ok = (r.signersMask >> i) & 1;
      const url = explorerAddress(addr);
      const a = url ? `<a class="mono" href="${esc(url)}" target="_blank" rel="noopener">${short(addr)}</a>` : `<span class="mono">${short(addr)}</span>`;
      return `<li class="sig ${ok ? "sig-ok" : "sig-no"}"><span class="mono-sm">${ok ? "✓" : "—"} Verif. ${i + 1}</span>${a}</li>`;
    })
    .join("");
}

function evidenceBlock(f, r) {
  if (!f?.evidenceRaw) return "";
  const matches = r && f.evidenceHash.toLowerCase() === r.evidenceHash.toLowerCase();
  const ev = f.evidence || {};
  const verdict = !r
    ? `<p class="muted">Este mes todavía no tiene informe en el contrato, así que no hay hash para comparar.</p>`
    : matches
      ? `<div class="verify verify-ok">${icon("shield")}<div><strong>Evidencia verificada</strong><p>Esta página calculó el keccak256 de <span class="mono">evidence.json</span> y coincide con el hash que firmaron los verificadores y guardó el contrato.</p></div></div>`
      : `<div class="verify verify-bad">${icon("warn")}<div><strong>La evidencia no coincide</strong><p>El hash de <span class="mono">evidence.json</span> no es el que guardó el contrato.</p></div></div>`;
  return `
  <div class="card">
    <p class="eyebrow">Evidencia · cualquiera puede rehacer la cuenta</p>
    ${verdict}
    <div class="rows rows-flat">
      <div><span>Hash en el contrato</span><span class="mono-sm">${r ? short(r.evidenceHash, 10, 8) : "—"}</span></div>
      <div><span>Hash del archivo</span><span class="mono-sm">${short(f.evidenceHash, 10, 8)}</span></div>
      <div><span>Imagen del mes</span><span>${ev.imagen?.fuente ? `<a href="${esc(ev.imagen.fuente)}" target="_blank" rel="noopener">${esc(ev.imagen.id)} ↗</a>` : "—"}</span></div>
      <div><span>Imagen base</span><span>${ev.imagen_base?.fuente ? `<a href="${esc(ev.imagen_base.fuente)}" target="_blank" rel="noopener">${esc(ev.imagen_base.id)} ↗</a>` : "—"}</span></div>
      <div><span>Algoritmo</span><span class="mono-sm">${esc(ev.algoritmo || "—")}</span></div>
      <div><span>Archivo</span><a href="${esc(f.evidenceUrl)}" target="_blank" rel="noopener">evidence.json en GitHub ↗</a></div>
    </div>
  </div>`;
}

export function informe({ id, mes }, s) {
  const p = s.parcels.find((x) => x.id === Number(id));
  if (!p) return `<section class="page narrow"><h1 class="h1">Informe</h1><p class="muted">${s.loading ? "Leyendo el contrato…" : "No existe esa parcela."}</p><a class="btn" href="#/">Volver</a></section>`;

  const letter = letterOf(s.deployment, p.id);
  const f = reports[letter]?.[mes] || null;
  const r = p.reports.find((x) => (f?.report ? x.evidenceHash.toLowerCase() === f.report.evidenceHash.toLowerCase() : false)) || p.reports.find((x) => monthKey(x.tObs) === mes) || null;
  const ev = f?.evidence || f?.skip; // los meses con nubes traen los mismos datos en skip.json
  const nVer = s.deployment.verifiers.length;

  // Meses vecinos con datos, para navegar.
  const keys = [...new Set([...Object.keys(reports[letter] || {}), ...p.reports.map((x) => monthKey(x.tObs))])].sort();
  const i = keys.indexOf(mes);
  const prev = i > 0 ? keys[i - 1] : null;
  const next = i >= 0 && i < keys.length - 1 ? keys[i + 1] : null;

  const baseYear = (ev?.imagen_base?.fecha || "").slice(0, 4) || "el año anterior";
  const cover = r ? r.coverBps : ev?.resultado?.cover_bps;
  const valid = r ? r.validBps : ev?.resultado?.valid_bps;
  const state = r ? r.status : null;
  const tone = r ? (r.standing ? "standing" : r.status === 3 ? "cleared" : "review") : f?.skip ? "cloud" : p.status === 3 ? "cleared" : "none";

  let notice = "";
  if (f?.skip) notice = `<div class="notice notice-ambar">${icon("satellite")}<div><strong>Sin informe este mes: nubes.</strong><p>${esc((f.skip.motivo || "Parte visible por debajo del 60 %.").replace(/(\d)\.(\d)/g, "$1,$2"))} No paga ni corta: se espera al mes siguiente.</p></div></div>`;
  else if (!r && f && p.status === 3) notice = `<div class="notice">${icon("axe")}<div><strong>No se envió al contrato.</strong><p>La parcela ya estaba desmontada: después del corte no se mandan más informes. La imagen queda como registro.</p></div></div>`;
  else if (!r && f?.report) notice = `<div class="notice notice-ambar">${icon("satellite")}<div><strong>Listo para enviar.</strong><p>El oráculo ya calculó este informe con la imagen real, pero todavía no está en el contrato. Cuando lo firmen y se envíe, aparece acá con su transacción y, si sigue en pie, paga la cuota.</p></div></div>`;
  else if (r && !r.standing && r.status === 2) notice = `<div class="notice notice-ambar">${icon("warn")}<div><strong>Primera lectura mala: no paga ni corta.</strong><p>Si la próxima también da mal, la parcela queda desmontada.</p></div></div>`;
  else if (r && r.status === 3) notice = `<div class="notice notice-terra">${icon("axe")}<div><strong>Segunda lectura mala seguida: pagos cortados.</strong><p>El saldo vuelve a los donantes o queda para restaurar. Nunca va al dueño ni al operador.</p></div></div>`;

  const imgs = f?.rgb
    ? `<div class="sat">
        <figure><img src="${esc(f.rgb)}" alt="Imagen Sentinel-2 en color real de ${esc(p.name)}, ${esc(longMonth(mes))}" loading="lazy"><figcaption class="mono-sm">Color real · ${isoDay(ev?.imagen?.fecha)}</figcaption></figure>
        ${f.perdida ? `<figure><img src="${esc(f.perdida)}" alt="Mapa de pérdida de monte de ${esc(p.name)}, ${esc(longMonth(mes))}" loading="lazy"><figcaption class="mono-sm">Pérdida contra ${isoDay(ev?.imagen_base?.fecha)} · <i class="sw sw-v"></i>monte <i class="sw sw-t"></i>perdido</figcaption></figure>` : ""}
      </div>`
    : `<p class="muted">No hay imágenes de este mes en <span class="mono">${esc(REPORTS_DIR)}/</span>.</p>`;

  return `
  <section class="page">
    <a class="back" href="#/parcela/${p.id}">← ${esc(p.name)}</a>
    <div class="phead">
      <h1 class="h1">${esc(longMonth(mes))}</h1>
      ${state !== null ? statusChip(state) : f?.skip ? `<span class="chip">Nubes</span>` : ""}
    </div>

    <div class="pmain pmain-wide">
      <div class="month-top tone-${tone}">
        ${imgs}
        ${
          f?.skip
            ? `<div class="month-num">
          <div class="big">${valid !== undefined ? `${pct(valid)}<small>%</small>` : "—"}</div>
          <p>de la parcela se ve sin nubes · hace falta 60 % para que haya informe</p>
        </div>`
            : `<div class="month-num">
          <div class="big">${cover !== undefined ? `${pct(cover)}<small>%</small>` : "—"}</div>
          <p>monte en pie contra el mismo mes de ${esc(baseYear)} · el umbral es ${pct(p.thresholdBps)} %</p>
          <p class="mono-sm">Parte visible ${valid !== undefined ? `${pct(valid)} %` : "—"} · mínimo 60 %</p>
        </div>`
        }
      </div>

      ${notice}

      ${
        r
          ? `<div class="card">
        <p class="eyebrow">Firmaron ${r.signers} de ${nVer} · alcanza con ${s.deployment.params?.quorum ?? 2}</p>
        <ul class="sigs">${signers(r, s.deployment.verifiers)}</ul>
        <div class="rows rows-flat">
          <div><span>Fecha de la imagen</span><span>${day(r.tObs)}</span></div>
          <div><span>Pagó</span><b class="num">${r.paid > 0n ? `${avax(r.paid)} AVAX` : "nada"}</b></div>
          <div><span>Transacción</span>${txLink(explorerTx(r.tx), short(r.tx))}</div>
        </div>
      </div>`
          : ""
      }

      ${evidenceBlock(f, r)}

      <nav class="month-nav">
        ${prev ? `<a class="btn" href="#/parcela/${p.id}/${prev}">← ${esc(longMonth(prev))}</a>` : "<span></span>"}
        ${next ? `<a class="btn" href="#/parcela/${p.id}/${next}">${esc(longMonth(next))} →</a>` : ""}
      </nav>
    </div>
  </section>`;
}
