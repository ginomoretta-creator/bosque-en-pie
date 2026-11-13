// Mi aporte (#27): qué aportó la billetera de prueba en cada parcela y qué puede recuperar.
// La clave viene del QR del jurado (#k=0x…, wallet.js): son claves de prueba, sin valor real.
// Lee refundStake/restoreStake/claimed y el struct de la parcela (getParcel vía el store);
// firma withdrawRefund, withdrawRestoration y withdrawLeftover con viem.
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHOICE, NET, abi, client, deployment, explorerTx } from "../chain.js";
import { avax, esc, int, short } from "../format.js";
import { icon, statusChip, txLink } from "../ui.js";
import { judgeKey } from "../wallet.js";

const STATUS_CLEARED = 3; // desmontada
const STATUS_CLOSED = 4;  // compromiso cerrado

const read = (functionName, args) =>
  client.readContract({ address: deployment.address, abi, functionName, args });

/** Lo que la billetera puede retirar de cada parcela según su estado. */
async function loadMyStake(account, parcels) {
  const timeout = Number(await read("restorationTimeout", []));
  const now = Math.floor(Date.now() / 1000);
  const out = [];
  for (const p of parcels) {
    const [refund, restore, refundDone, restoreDone, leftoverDone, certs] = await Promise.all([
      read("refundStake", [BigInt(p.id), account.address]),
      read("restoreStake", [BigInt(p.id), account.address]),
      read("refundClaimed", [BigInt(p.id), account.address]),
      read("restoreClaimed", [BigInt(p.id), account.address]),
      read("leftoverClaimed", [BigInt(p.id), account.address]),
      read("pendingCertificates", [BigInt(p.id), account.address]),
    ]);
    const stake = refund + restore;
    if (stake === 0n && !refundDone && !restoreDone && !leftoverDone) continue;

    // Monto recuperable, con la misma proporción que calcula el contrato.
    const acciones = [];
    if (p.status === STATUS_CLEARED) {
      if (refund > 0n && !refundDone && p.totalRefundStake > 0n) {
        acciones.push({ fn: "withdrawRefund", label: "devolución", amount: (p.refundPool * refund) / p.totalRefundStake });
      }
      const vence = Number(p.endedAt) + timeout;
      if (restore > 0n && !restoreDone && p.totalRestoreStake > 0n) {
        if (now >= vence) {
          acciones.push({ fn: "withdrawRestoration", label: "restauración", amount: (p.restorePool * restore) / p.totalRestoreStake });
        } else {
          acciones.push({ fn: null, label: `restauración bloqueada hasta ${new Date(vence * 1000).toLocaleDateString("es-AR")}` });
        }
      }
    }
    if (p.status === STATUS_CLOSED && stake > 0n && !leftoverDone) {
      const total = p.totalRefundStake + p.totalRestoreStake;
      if (total > 0n) acciones.push({ fn: "withdrawLeftover", label: "sobrante", amount: (p.leftoverPool * stake) / total });
    }

    // Retiros ya hechos por esta billetera en esta parcela (eventos Withdrawn).
    const retiros = []; // se completan con los eventos del store al pintar
    out.push({ p, refund, restore, refundDone, restoreDone, leftoverDone, certs, acciones, retiros });
  }
  return out;
}

function card(mine, retiros) {
  const { p, refund, restore, certs, acciones } = mine;
  const eleccion = refund > 0n && restore > 0n
    ? `parte ${CHOICE[0].toLowerCase()}, parte ${CHOICE[1].toLowerCase()}`
    : CHOICE[refund > 0n ? 0 : 1].toLowerCase();
  const retirosTxt = retiros.length
    ? `<div><span>Ya retiraste</span><span class="num">${retiros
        .map((r) => `${avax(r.args.amount)} (${["devolución", "restauración", "sobrante"][Number(r.args.kind)]})`)
        .join(" + ")} AVAX</span></div>`
    : "";
  const botones = acciones.length
    ? acciones
        .map((a) =>
          a.fn
            ? `<button class="btn btn-lima btn-block" data-fn="${a.fn}" data-parcel="${p.id}">Recuperar ${avax(a.amount)} AVAX · ${a.label}</button>`
            : `<p class="muted">Fondo de ${esc(a.label)}.</p>`,
        )
        .join("")
    : p.status === STATUS_CLEARED || p.status === STATUS_CLOSED
      ? `<p class="muted">No queda nada por recuperar.</p>`
      : `<p class="muted">Sigue en el pozo: paga una cuota por cada mes que el monte está en pie.</p>`;
  const cert = certs > 0n ? `<div><span>Certificados ganados</span><span class="num">${int(certs)} ha-mes</span></div>` : "";

  return `<div class="card">
    <div class="card-h"><strong>${esc(p.name)}</strong>${statusChip(p.status)}</div>
    <div class="rows">
      <div><span>Aportaste</span><span class="num">${avax(refund + restore)} AVAX · ${esc(eleccion)}</span></div>
      ${cert}
      <div><span>El pozo ya pagó a quienes cuidan</span><span class="num">${avax(p.totalPaid)} AVAX · ${int(p.reports.filter((r) => r.standing).length)} cuotas</span></div>
      ${retirosTxt}
    </div>
    ${botones}
    <p class="mono-sm tx-result" data-parcel="${p.id}"></p>
  </div>`;
}

export function miAporte(_params, s) {
  const html = `<section class="page narrow">
    <p class="eyebrow">Mi aporte</p>
    <h1 class="h1">Lo que tu billetera aportó</h1>
    <div id="miaporte"><p class="muted">Leyendo tu billetera y el contrato…</p></div>
  </section>`;

  const mount = (el) => {
    let cancelled = false;
    (async () => {
      const box = el.querySelector("#miaporte");
      const key = judgeKey();
      if (!key) {
        box.innerHTML = `<div class="notice notice-ambar"><div><strong>No hay billetera de prueba cargada</strong>
          <p>Esta pantalla se abre desde el QR de una billetera de prueba del jurado (la clave viaja en el
          <span class="mono">#k=…</span> del enlace y nunca sale del navegador).</p></div></div>
          <p style="margin-top:12px"><a class="btn" href="#/">Ver las parcelas</a></p>`;
        return;
      }
      if (!deployment) {
        box.innerHTML = `<p class="muted">Todavía no hay contrato en ${esc(NET.label)}.</p>`;
        return;
      }
      const account = privateKeyToAccount(key);
      const mine = await loadMyStake(account, s.parcels);
      if (cancelled) return;
      if (!mine.length) {
        box.innerHTML = `<p class="muted">La billetera <span class="mono">${short(account.address)}</span>
          todavía no aportó a ninguna parcela en ${esc(NET.label)}.</p>
          <p><a class="btn" href="#/">Ver las parcelas</a></p>`;
        return;
      }
      const retirosDe = (pid) =>
        s.events.filter(
          (e) => e.eventName === "Withdrawn" && Number(e.args.parcelId) === pid &&
            e.args.donor?.toLowerCase() === account.address.toLowerCase(),
        );
      box.innerHTML =
        `<p class="muted mono-sm">Billetera <span class="mono">${short(account.address)}</span> · ${esc(NET.label)}</p>` +
        mine.map((m) => card(m, retirosDe(m.p.id))).join("");

      // Botones de retiro: firman con la clave de prueba y esperan el recibo.
      const wallet = createWalletClient({ account, chain: NET.chain, transport: http(NET.rpc) });
      for (const btn of box.querySelectorAll("button[data-fn]")) {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          const result = box.querySelector(`.tx-result[data-parcel="${btn.dataset.parcel}"]`);
          result.textContent = "Firmando y enviando…";
          try {
            const hash = await wallet.writeContract({
              address: deployment.address, abi, functionName: btn.dataset.fn,
              args: [BigInt(btn.dataset.parcel)],
            });
            result.innerHTML = `Enviada: ${txLink(explorerTx(hash), short(hash))} · esperando confirmación…`;
            await client.waitForTransactionReceipt({ hash });
            result.innerHTML = `${icon("tree")} Listo: ${txLink(explorerTx(hash), short(hash))}`;
            setTimeout(() => window.location.reload(), 1500); // relee stakes y saldos
          } catch (e) {
            btn.disabled = false;
            result.textContent = `No se pudo retirar: ${e.shortMessage || e.message || e}`;
          }
        });
      }
    })().catch((e) => {
      const box = el.querySelector("#miaporte");
      if (box) box.innerHTML = `<p class="muted">No se pudo leer el contrato: ${esc(e.message || e)}</p>`;
    });
    return () => {
      cancelled = true;
    };
  };
  return { html, mount };
}
