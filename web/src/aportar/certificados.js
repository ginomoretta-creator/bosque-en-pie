// Certificados de monte en pie (#28): ERC-1155 del contrato, id = parcela, 1 unidad = 1 hectárea-mes
// que una imagen satelital confirmó en pie con tu aporte pagando la cuota. Acuñar, transferir y retirar.
// Nunca se llaman «bono»: no certifican carbono.
import { isAddress } from "viem";
import { store } from "../chain.js";
import { day, esc, int, month } from "../format.js";
import { icon, statusChip } from "../ui.js";
import { account, bindLogin, fillBalance, loginScreen, txDone, walletBar, withBusy } from "./comun.js";
import { send } from "./billetera.js";
import { myPosition } from "./mi-aporte.js";

const now = () => Math.floor(Date.now() / 1000);

function span(p) {
  const paid = p.reports.filter((r) => r.standing);
  if (!paid.length) return "sin cuotas pagadas todavía";
  const a = month(paid[0].tObs);
  const b = month(paid.at(-1).tObs);
  return a === b ? a : `${a} – ${b}`;
}

function why(p) {
  if (p.status === 3) return "Congelados: la parcela se desmontó. Siguen a tu nombre como registro, pero no se transfieren ni se retiran.";
  if (Number(p.commitEnd) > now()) return `Se pueden transferir; retirarlos recién desde el ${day(Number(p.commitEnd))}, cuando termina el compromiso.`;
  return null;
}

function view(pos) {
  const total = pos.reduce((a, x) => a + x.certs + x.pending, 0n);
  const retired = pos.reduce((a, x) => a + x.retired, 0n);
  const rows = pos
    .filter((x) => x.certs + x.pending + x.retired > 0n)
    .map((x) => {
      const note = why(x.p);
      return `<div class="card cert-row">
        <div class="card-h"><span><b class="pick-n">${esc(x.p.name)}</b><span class="sub muted mono-sm">cuotas pagadas: ${esc(span(x.p))}</span></span>${statusChip(x.p.status)}</div>
        <div class="rows rows-flat">
          <div><span>A tu nombre</span><b class="num">${int(x.certs)} ha-mes</b></div>
          ${x.pending > 0n ? `<div><span>Ganados, sin acuñar</span><b class="num">${int(x.pending)} ha-mes</b></div>` : ""}
          ${x.retired > 0n ? `<div><span>Retirados a tu nombre</span><b class="num">${int(x.retired)} ha-mes</b></div>` : ""}
        </div>
        ${note ? `<p class="muted hint">${esc(note)}</p>` : ""}
        ${x.pending > 0n ? `<button class="btn btn-lima btn-block" type="button" data-acunar="${x.p.id}">Acuñar ${int(x.pending)} ha-mes a mi nombre</button>` : ""}
      </div>`;
    })
    .join("");

  const movable = pos.filter((x) => x.certs > 0n && x.p.status !== 3);
  const options = movable.map((x) => `<option value="${x.p.id}" data-max="${x.certs}">${esc(x.p.name)} · ${int(x.certs)} ha-mes</option>`).join("");
  const actions = movable.length
    ? `<form class="card cert-form" data-cert>
        <p class="eyebrow">Transferir o retirar</p>
        <label class="lbl" for="cparcela">Parcela</label>
        <select id="cparcela" class="input" name="parcela">${options}</select>
        <label class="lbl" for="ccant">Cantidad (ha-mes)</label>
        <input id="ccant" class="input num-in" name="cantidad" inputmode="numeric" autocomplete="off" value="1">
        <label class="lbl" for="cdest">Para transferir: dirección de destino</label>
        <input id="cdest" class="input mono" name="destino" autocomplete="off" spellcheck="false" placeholder="0x…">
        <div class="two">
          <button class="btn btn-block" type="submit" data-accion="transferir">Transferir</button>
          <button class="btn btn-dark btn-block" type="submit" data-accion="retirar">Retirar</button>
        </div>
        <p class="muted hint">Retirar quema el certificado y lo deja registrado a tu nombre, para que nadie más lo use.</p>
      </form>`
    : "";

  return `
    <div class="cert">
      <p class="eyebrow">Tus certificados de monte en pie</p>
      <div class="cert-n">${int(total)} <small>ha-mes</small></div>
      <p>Una ha-mes es una hectárea que una imagen satelital confirmó en pie durante un mes, con tu aporte pagando la cuota.</p>
      ${retired > 0n ? `<p class="mono-sm">Retirados a tu nombre: ${int(retired)} ha-mes</p>` : ""}
    </div>
    ${rows || `<p class="muted">Todavía no tenés certificados: llegan cuando una parcela a la que aportaste cobra su cuota.</p>`}
    ${actions}
    <div class="notice notice-verde">${icon("medal")}<div><strong>Certificado de monte en pie.</strong>
      <p>Cuenta hectáreas-mes de monte en pie, no toneladas de CO₂: no certifica carbono ni compensa emisiones.</p></div></div>`;
}

export function certificados(_params, _s) {
  const acc = account();
  if (!acc) {
    return { html: loginScreen("Certificados de monte en pie"), mount: (el) => bindLogin(el, () => window.dispatchEvent(new HashChangeEvent("hashchange"))) };
  }
  return {
    html: `<section class="page narrow">
      <a class="back" href="#/mi-aporte">← Mi aporte</a>
      ${walletBar(acc)}
      <h1 class="h1">Certificados</h1>
      <div data-certs><p class="muted">Leyendo tus certificados…</p></div>
      <div data-out></div>
    </section>`,
    mount: (el) => mount(el, acc),
  };
}

function mount(el, acc) {
  const off = bindLogin(el, () => window.dispatchEvent(new HashChangeEvent("hashchange")));
  const box = el.querySelector("[data-certs]");
  const out = el.querySelector("[data-out]");
  let busy = false;
  let version = -1;
  let lastAction = "retirar";

  async function load() {
    const s = store.state;
    if (!s.parcels.length) return;
    version = s.version;
    fillBalance(el, acc);
    try {
      box.innerHTML = view(await myPosition(s, acc.address));
    } catch (e) {
      console.error(e);
      box.innerHTML = `<div class="notice notice-terra">${icon("warn")}<div><strong>No se pudieron leer los certificados.</strong><p>${esc(e.shortMessage || e.message)}</p></div></div>`;
    }
  }

  async function run(btn, label, fn, done) {
    if (busy) return;
    busy = true;
    const r = await withBusy(btn, out, label, fn);
    busy = false;
    if (r) {
      out.innerHTML = txDone(done, r);
      await store.refresh();
      load();
    }
  }

  const onClick = (e) => {
    const b = e.target.closest("[data-acunar]");
    if (b) run(b, "Acuñando…", () => send("claimCertificates", [BigInt(b.dataset.acunar)]), "Listo: los certificados quedaron a tu nombre.");
    const a = e.target.closest("[data-accion]");
    if (a) lastAction = a.dataset.accion;
  };
  const onSubmit = (e) => {
    const f = e.target.closest("[data-cert]");
    if (!f) return;
    e.preventDefault();
    const action = e.submitter?.dataset.accion || lastAction;
    const btn = f.querySelector(`[data-accion="${action}"]`);
    const id = BigInt(f.parcela.value);
    const max = BigInt(f.parcela.selectedOptions[0].dataset.max);
    const n = String(f.cantidad.value).trim();
    if (!/^\d+$/.test(n) || BigInt(n) === 0n) return (out.innerHTML = `<p class="err">La cantidad tiene que ser un número entero de ha-mes.</p>`);
    const qty = BigInt(n);
    if (qty > max) return (out.innerHTML = `<p class="err">Tenés ${int(max)} ha-mes de esa parcela.</p>`);
    if (action === "transferir") {
      const to = String(f.destino.value).trim();
      if (!isAddress(to)) return (out.innerHTML = `<p class="err">La dirección de destino no es válida (0x y 40 caracteres).</p>`);
      if (to.toLowerCase() === acc.address.toLowerCase()) return (out.innerHTML = `<p class="err">Esa es tu propia billetera.</p>`);
      run(btn, "Transfiriendo…", () => send("safeTransferFrom", [acc.address, to, id, qty, "0x"]), `Listo: pasaste ${int(qty)} ha-mes.`);
    } else {
      run(btn, "Retirando…", () => send("retireCertificates", [id, qty]), `Listo: ${int(qty)} ha-mes quedaron retirados a tu nombre.`);
    }
  };
  el.addEventListener("click", onClick);
  el.addEventListener("submit", onSubmit);
  const unsub = store.subscribe((s) => {
    const typing = el.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName);
    if (!busy && !typing && s.version !== version) load();
  });
  load();
  return () => {
    off();
    unsub();
    el.removeEventListener("click", onClick);
    el.removeEventListener("submit", onSubmit);
  };
}
