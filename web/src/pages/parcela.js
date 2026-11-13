// Parcela: estado, monte en pie, doce meses, firmas, pagos y saldo (base de #25).
import { NET, STATUS, explorerAddress, explorerTx } from "../chain.js";
import { avax, day, esc, int, month, pct, short } from "../format.js";
import { folderFor, letterOf, reports } from "../reports.js";
import { icon, monthStrip, statusChip, txLink } from "../ui.js";

const who = (addr) => {
  const url = explorerAddress(addr);
  return url ? `<a class="mono" href="${esc(url)}" target="_blank" rel="noopener">${short(addr)} ↗</a>` : `<span class="mono">${short(addr)}</span>`;
};

export function parcela({ id }, s) {
  const p = s.parcels.find((x) => x.id === Number(id));
  if (!p) return `<section class="page narrow"><h1 class="h1">Parcela ${esc(id)}</h1><p class="muted">${s.loading ? "Leyendo el contrato…" : "No existe en este contrato."}</p><a class="btn" href="#/">Volver</a></section>`;

  const letter = letterOf(s.deployment, p.id);
  const strip = monthStrip(p, { folders: reports[letter] || {} });
  const r = p.lastReport;
  const lastFolder = r ? folderFor(letter, r) : null;
  const bg = lastFolder?.rgb ? ` style="--bg:url('${esc(lastFolder.rgb)}')"` : "";
  const ownerPct = p.ownerShareBps / 100;
  const cleared = p.status === 3;
  const rows = [...p.reports].reverse().map((x) => `
    <tr>
      <td class="nowrap"><a href="#/parcela/${p.id}/${new Date(x.tObs * 1000).toISOString().slice(0, 7)}">${month(x.tObs)}</a><span class="sub muted mono-sm">imagen del ${day(x.tObs)}</span></td>
      <td class="num">${pct(x.coverBps)} %</td>
      <td class="num">${pct(x.validBps)} %</td>
      <td class="num">${x.signers} de ${s.deployment.verifiers.length}</td>
      <td>${statusChip(x.status)}</td>
      <td class="num">${x.paid > 0n ? avax(x.paid) : "—"}</td>
      <td>${txLink(explorerTx(x.tx), short(x.tx))}</td>
    </tr>`).join("");

  return `
  <section class="page">
    <a class="back" href="#/">← Parcelas</a>
    <div class="phead">
      <h1 class="h1">${esc(p.name)}</h1>
      ${statusChip(p.status)}
    </div>

    <div class="pmain">
      <div class="pcover pcover-${p.status}${bg ? " has-bg" : ""}"${bg}>
        <p class="mono-sm">${r ? `Sentinel-2 · ${day(r.tObs)}` : "Sin informes todavía"} · ${int(p.hectares)} ha</p>
        <div class="big">${r ? `${pct(r.coverBps)}<small>%</small>` : "—"}</div>
        <p>del monte de la base sigue en pie · el umbral es ${pct(p.thresholdBps)} %</p>
        <span class="pcover-ic">${icon(cleared ? "stump" : p.status === 2 ? "satellite" : "tree")}</span>
      </div>

      ${cleared ? `<div class="notice notice-terra">${icon("axe")}<div><strong>Dos lecturas malas seguidas. Pagos cortados.</strong><p>El saldo nunca va al dueño ni al operador: vuelve a los donantes o queda para restaurar.</p></div></div>` : ""}
      ${p.status === 2 ? `<div class="notice notice-ambar">${icon("warn")}<div><strong>Primera lectura mala: no paga ni corta.</strong><p>Si la próxima también da mal, la parcela queda desmontada.</p></div></div>` : ""}

      <div class="card">
        <div class="card-h"><p class="eyebrow">Doce cuotas · ${strip.year}</p><span class="pill">${strip.paid} de 12</span></div>
        ${strip.html}
        <p class="muted hint">Tocá un mes para ver la imagen satelital y el informe.</p>
      </div>

      <div class="duo">
        <div class="card stat">${icon("coins")}<div class="stat-n">${avax(cleared ? p.refundPool + p.restorePool : p.balance)} AVAX</div><p class="muted">${cleared ? "saldo al corte" : "en el pozo"} · cuota ${avax(p.fee)}</p></div>
        <div class="card stat">${icon("sigs")}<div class="stat-n">${r ? `${r.signers} de ${s.deployment.verifiers.length}` : "—"}</div><p class="muted">firmas del último informe</p></div>
      </div>

      <div class="card rows">
        <div><span>Dueño de prueba · no desmontar</span><span>${who(p.owner)} · <b class="num">${ownerPct} %</b></span></div>
        <div><span>Operador de prueba · cortafuegos</span><span>${who(p.operator)} · <b class="num">${100 - ownerPct} %</b></span></div>
        <div><span>Ya pagó a quienes cuidan</span><b class="num">${avax(p.totalPaid)} AVAX</b></div>
        <div><span>Aportado en total</span><b class="num">${avax(p.totalDonated)} AVAX</b></div>
        ${cleared ? `<div><span>Vuelve a los donantes</span><b class="num">${avax(p.refundPool)} AVAX</b></div><div><span>Fondo de restauración</span><b class="num">${avax(p.restorePool)} AVAX</b></div>` : ""}
      </div>

      ${cleared ? `<a class="btn btn-dark btn-block" href="#/mi-aporte">Ver mi parte</a>` : `<a class="btn btn-dark btn-block" href="#/aportar/${p.id}">Aportar a esta parcela</a>`}
    </div>

    <div class="block">
      <div class="block-h"><p class="eyebrow">Informes aplicados</p><span class="muted mono-sm">${esc(NET.label)} · ${esc(STATUS[p.status])}</span></div>
      ${rows ? `<div class="tablewrap"><table class="table"><thead><tr><th>Mes</th><th class="num">Monte en pie</th><th class="num">Visible</th><th class="num">Firmas</th><th>Quedó</th><th class="num">Pagó</th><th>Transacción</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="muted">Todavía no hay informes para esta parcela.</p>`}
    </div>
  </section>`;
}
