// Mi aporte (#27): lo aportado en cada parcela, la opción elegida, lo que ya llegó a quienes cuidan
// y el botón de recuperar cuando corresponde (devolución, restauración vencida o sobrante).
import { CHOICE, WITHDRAW_KIND, explorerTx, parcelName, store } from "../chain.js";
import { avax, dateTime, day, esc, int, short } from "../format.js";
import { icon, statusChip, txLink } from "../ui.js";
import { account, bindLogin, fillBalance, loginScreen, txDone, walletBar, withBusy } from "./comun.js";
import { read, send } from "./billetera.js";

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** Lo que el contrato le debe a esta cuenta en cada parcela (misma cuenta que withdraw*). */
export async function myPosition(s, addr) {
  const timeout = BigInt(await read("restorationTimeout"));
  const now = BigInt(Math.floor(Date.now() / 1000));
  return Promise.all(
    s.parcels.map(async (p) => {
      const id = BigInt(p.id);
      const [refund, restore, refundClaimed, restoreClaimed, leftoverClaimed, pending, certs, retired] = await Promise.all([
        read("refundStake", [id, addr]),
        read("restoreStake", [id, addr]),
        read("refundClaimed", [id, addr]),
        read("restoreClaimed", [id, addr]),
        read("leftoverClaimed", [id, addr]),
        read("pendingCertificates", [id, addr]),
        read("balanceOf", [addr, id]),
        read("certRetiredBy", [id, addr]),
      ]);
      const stake = refund + restore;
      const totalStake = p.totalRefundStake + p.totalRestoreStake;
      const cleared = p.status === 3;
      const closed = p.status === 4;
      const owed = [];
      if (cleared && refund > 0n) {
        owed.push({ kind: 0, fn: "withdrawRefund", amount: (p.refundPool * refund) / p.totalRefundStake, done: refundClaimed, ready: true });
      }
      if (cleared && restore > 0n) {
        const opens = p.endedAt + timeout;
        owed.push({ kind: 1, fn: "withdrawRestoration", amount: (p.restorePool * restore) / p.totalRestoreStake, done: restoreClaimed, ready: now >= opens, opens });
      }
      if (closed && stake > 0n) {
        owed.push({ kind: 2, fn: "withdrawLeftover", amount: (p.leftoverPool * stake) / totalStake, done: leftoverClaimed, ready: true });
      }
      return {
        p,
        refund,
        restore,
        stake,
        // Parte de lo que ya se pagó, en proporción al aporte (exacta si todos aportaron antes de los pagos).
        paidShare: totalStake > 0n ? (p.totalPaid * stake) / totalStake : 0n,
        owed,
        pending,
        certs,
        retired,
      };
    }),
  );
}

function card(x) {
  const { p } = x;
  const paidPct = x.stake > 0n ? Math.min(100, Number((x.paidShare * 1000n) / x.stake) / 10) : 0;
  const cleared = p.status === 3;
  const choice = x.refund > 0n && x.restore > 0n ? "parte vuelve a vos y parte va a restaurar" : x.refund > 0n ? "vuelve a vos si hay desmonte" : "va a restaurar si hay desmonte";
  const owedRows = x.owed
    .map((o) => {
      const what = WITHDRAW_KIND[o.kind];
      if (o.done) return `<div><span>Ya recuperaste (${what})</span><b class="num">${avax(o.amount, 4)}</b></div>`;
      if (!o.ready) return `<div><span>Fondo de restauración · se puede retirar desde el ${day(Number(o.opens))} si no se usa</span><b class="num">${avax(o.amount, 4)}</b></div>`;
      return `<div class="owe"><span><b>Para recuperar · ${what}</b></span><b class="num">${avax(o.amount, 4)}</b></div>`;
    })
    .join("");
  const actions = x.owed
    .filter((o) => o.ready && !o.done && o.amount > 0n)
    .map((o) => `<button class="btn btn-lima btn-block" type="button" data-retirar="${o.fn}" data-id="${p.id}">Recuperar ${avax(o.amount, 4)} AVAX · ${WITHDRAW_KIND[o.kind]}</button>`)
    .join("");
  return `<div class="card mine">
    <div class="card-h"><a class="pick-n" href="#/parcela/${p.id}">${esc(p.name)}</a>${statusChip(p.status)}</div>
    <div class="bar" aria-hidden="true"><i class="bar-ok" style="width:${paidPct}%"></i>${cleared ? `<i class="bar-cut" style="width:${100 - paidPct}%"></i>` : ""}</div>
    <div class="rows rows-flat">
      <div><span>Aportaste · ${choice}</span><b class="num">${avax(x.stake, 4)}</b></div>
      <div><span>Llegó a quienes cuidan · tu parte</span><b class="num">≈ ${avax(x.paidShare, 4)}</b></div>
      ${owedRows}
    </div>
    ${actions}
  </div>`;
}

function myEvents(s, addr) {
  const rows = s.events
    .filter((e) => {
      const a = e.args;
      if (e.eventName === "Donated" || e.eventName === "Withdrawn") return same(a.donor, addr);
      if (e.eventName === "TransferSingle") return same(a.to, addr) || same(a.from, addr);
      if (e.eventName === "CertificatesRetired") return same(a.account, addr);
      return false;
    })
    .reverse()
    .map((e) => {
      const a = e.args;
      let t = "";
      if (e.eventName === "Donated") t = `Aportaste ${avax(a.amount, 4)} AVAX a ${esc(parcelName(a.parcelId))} · ${CHOICE[a.choice].toLowerCase()}`;
      else if (e.eventName === "Withdrawn") t = `Recuperaste ${avax(a.amount, 4)} AVAX (${WITHDRAW_KIND[a.kind]}) de ${esc(parcelName(a.parcelId))}`;
      else if (e.eventName === "CertificatesRetired") t = `Retiraste a tu nombre ${int(a.amount)} ha-mes de ${esc(parcelName(a.parcelId))}`;
      else if (/^0x0+$/.test(a.from)) t = `Acuñaste ${int(a.value)} ha-mes de ${esc(parcelName(a.id))}`;
      else if (/^0x0+$/.test(a.to)) return ""; // lo cuenta CertificatesRetired
      else if (same(a.from, addr)) t = `Pasaste ${int(a.value)} ha-mes de ${esc(parcelName(a.id))} a <span class="mono">${short(a.to)}</span>`;
      else t = `Recibiste ${int(a.value)} ha-mes de ${esc(parcelName(a.id))} de <span class="mono">${short(a.from)}</span>`;
      return `<li class="ev">${icon(e.eventName === "Donated" || e.eventName === "Withdrawn" ? "coins" : "medal")}
        <div class="ev-body"><p>${t}</p><p class="muted mono-sm">${dateTime(e.timestamp)} · bloque ${e.blockNumber}</p></div>
        <div class="ev-side">${txLink(explorerTx(e.transactionHash), short(e.transactionHash))}</div></li>`;
    })
    .join("");
  return rows ? `<ol class="evlist">${rows}</ol>` : `<p class="muted">Todavía no hay movimientos de esta billetera.</p>`;
}

export function miAporte(_params, s) {
  const acc = account();
  if (!acc) {
    return { html: loginScreen("Mi aporte"), mount: (el) => bindLogin(el, () => window.dispatchEvent(new HashChangeEvent("hashchange"))) };
  }
  return {
    html: `<section class="page narrow">
      ${walletBar(acc)}
      <div data-mio><p class="muted">Leyendo tu aporte en el contrato…</p></div>
      <div data-out></div>
      <div class="block"><div class="block-h"><p class="eyebrow">Tu actividad</p></div><div data-ev></div></div>
    </section>`,
    mount: (el) => mount(el, acc),
  };
}

function mount(el, acc) {
  const off = bindLogin(el, () => window.dispatchEvent(new HashChangeEvent("hashchange")));
  const box = el.querySelector("[data-mio]");
  const out = el.querySelector("[data-out]");
  const evBox = el.querySelector("[data-ev]");
  let busy = false;
  let version = -1;

  async function load() {
    const s = store.state;
    if (!s.parcels.length) return;
    version = s.version;
    evBox.innerHTML = myEvents(s, acc.address);
    fillBalance(el, acc);
    try {
      const pos = await myPosition(s, acc.address);
      const mine = pos.filter((x) => x.stake > 0n);
      const certTotal = pos.reduce((a, x) => a + x.certs + x.pending, 0n);
      box.innerHTML = mine.length
        ? `<h1 class="h1">${mine.length === 1 ? `Aportaste en la ${esc(mine[0].p.name)}.` : `Aportaste en ${mine.length} parcelas.`}</h1>
           ${mine.map(card).join("")}
           <a class="notice notice-verde notice-link" href="#/certificados">${icon("medal")}<div><strong>Certificados de monte en pie</strong>
             <p>${int(certTotal)} ha-mes financiadas con tu aporte · ver →</p></div></a>`
        : `<h1 class="h1">Todavía no aportaste.</h1><p class="muted">Con esta billetera no hay aportes en ninguna parcela.</p>
           <a class="btn btn-dark btn-block" href="#/aportar">Aportar a una parcela</a>`;
    } catch (e) {
      console.error(e);
      box.innerHTML = `<div class="notice notice-terra">${icon("warn")}<div><strong>No se pudo leer tu aporte.</strong><p>${esc(e.shortMessage || e.message)}</p></div></div>`;
    }
  }

  const onClick = async (e) => {
    const b = e.target.closest("[data-retirar]");
    if (!b || busy) return;
    busy = true;
    const r = await withBusy(b, out, "Recuperando…", () => send(b.dataset.retirar, [BigInt(b.dataset.id)]));
    busy = false;
    if (r) {
      out.innerHTML = txDone("Listo: el AVAX volvió a tu billetera de prueba.", r);
      await store.refresh();
      load();
    }
  };
  el.addEventListener("click", onClick);
  const unsub = store.subscribe((s) => {
    if (!busy && s.version !== version) load();
  });
  load();
  return () => {
    off();
    unsub();
    el.removeEventListener("click", onClick);
  };
}
