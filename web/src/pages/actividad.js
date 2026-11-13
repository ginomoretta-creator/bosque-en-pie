// Actividad: todos los eventos del contrato, del más nuevo al más viejo, con link al explorer.
import { CHOICE, NET, STATUS, WITHDRAW_KIND, explorerTx, parcelName } from "../chain.js";
import { avax, dateTime, esc, month, pct, short } from "../format.js";
import { icon, statusChip, txLink } from "../ui.js";

export function describe(e, inTx) {
  const a = e.args;
  const name = esc(parcelName(a.parcelId));
  switch (e.eventName) {
    case "ParcelRegistered":
      return { ic: "pin", text: `${name} registrada · ${a.hectares} ha · cuota ${avax(a.fee)} AVAX` };
    case "Donated":
      return { ic: "coins", text: `Aporte de <b>${avax(a.amount)} AVAX</b> a ${name} · si hay desmonte: ${CHOICE[a.choice].toLowerCase()}` };
    case "ReportSubmitted":
      // Con challengeWindow = 0 el informe se aplica en la misma transacción: se muestra solo el aplicado.
      if (inTx.some((x) => x.eventName === "ReportApplied")) return null;
      return { ic: "satellite", text: `Informe recibido para ${name} · ${month(a.report.tObs)} · queda pendiente` };
    case "ReportApplied": {
      const pay = inTx.find((x) => x.eventName === "Paid");
      return {
        ic: a.standing ? "tree" : "warn",
        text: `Informe ${month(a.report.tObs)} de ${name} · monte en pie <b>${pct(a.report.coverBps)} %</b>${
          pay ? ` · pagó ${avax(pay.args.ownerAmount)} al dueño y ${avax(pay.args.operatorAmount)} al operador` : " · no paga"
        }`,
        chip: statusChip(Number(a.status)),
      };
    }
    case "Paid":
      if (inTx.some((x) => x.eventName === "ReportApplied")) return null; // va en la fila del informe
      return { ic: "coin", text: `${name}: ${avax(a.ownerAmount)} al dueño y ${avax(a.operatorAmount)} al operador` };
    case "StatusChanged":
      if (inTx.some((x) => x.eventName === "ReportApplied")) return null; // el chip del informe ya lo dice
      return { ic: Number(a.status) === 3 ? "axe" : "satellite", text: `${name} pasó a <b>${esc(STATUS[Number(a.status)]).toLowerCase()}</b>` };
    case "ReportChallenged":
      return { ic: "shield", text: `Informe de ${name} impugnado por <span class="mono">${short(a.by)}</span>` };
    case "ChallengeResolved":
      return { ic: "shield", text: `El curador ${a.accepted ? "aceptó" : "rechazó"} el informe impugnado de ${name}` };
    case "TransferSingle": {
      // Certificados de monte en pie (ERC-1155): id = parcela, 1 unidad = 1 hectárea-mes.
      const zero = /^0x0+$/;
      const cert = `${a.value} ha-mes de ${esc(parcelName(a.id))}`;
      if (zero.test(a.from)) return { ic: "medal", text: `Certificados de monte en pie: <b>${cert}</b> para <span class="mono">${short(a.to)}</span>` };
      if (zero.test(a.to)) return null; // lo cuenta CertificatesRetired
      return { ic: "medal", text: `Pasaron ${cert} de <span class="mono">${short(a.from)}</span> a <span class="mono">${short(a.to)}</span>` };
    }
    case "CertificatesRetired":
      return { ic: "medal", text: `<span class="mono">${short(a.account)}</span> retiró a su nombre ${a.amount} ha-mes de ${name}` };
    case "ApprovalForAll":
    case "TransferBatch":
      return null;
    case "Withdrawn":
      return { ic: "coins", text: `Retiro de ${avax(a.amount)} AVAX (${WITHDRAW_KIND[a.kind]}) de ${name}` };
    default:
      return { ic: "pin", text: esc(e.eventName) };
  }
}

export function actividad(_params, s) {
  const byTx = new Map();
  for (const e of s.events) byTx.set(e.transactionHash, [...(byTx.get(e.transactionHash) || []), e]);

  const rows = [...s.events]
    .reverse()
    .map((e) => {
      const d = describe(e, byTx.get(e.transactionHash));
      if (!d) return "";
      return `<li class="ev">
        ${icon(d.ic)}
        <div class="ev-body"><p>${d.text}</p><p class="muted mono-sm">${dateTime(e.timestamp)} · bloque ${e.blockNumber}</p></div>
        <div class="ev-side">${d.chip || ""}${txLink(explorerTx(e.transactionHash), short(e.transactionHash))}</div>
      </li>`;
    })
    .join("");

  return `
  <section class="page">
    <div class="block-h"><div><p class="eyebrow">Actividad</p><h1 class="h1">Lo que pasó en el contrato</h1></div>
    <span class="muted mono-sm">${esc(NET.label)} · ${s.events.length} eventos${s.lastBlock !== null ? ` · bloque ${s.lastBlock}` : ""}</span></div>
    <p class="muted hint">Para la demo, los doce informes de 2025 se aplicaron juntos en el contrato. Un aporte nuevo aparece arriba a los pocos segundos.</p>
    ${rows ? `<ol class="evlist">${rows}</ol>` : `<p class="muted">${s.loading ? "Leyendo eventos…" : "Todavía no hay eventos."}</p>`}
  </section>`;
}
