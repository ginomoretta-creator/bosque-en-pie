// Piezas compartidas de las pantallas del carril 4.
import { NET, NETWORK, explorerAddress, explorerTx } from "../chain.js";
import { avax, esc, short } from "../format.js";
import { icon } from "../ui.js";
import { LOCAL_ACCOUNTS, account, balance, logout, reason, useKey, useLocal } from "./billetera.js";

/** Barra con la billetera activa y su saldo (el saldo se completa en mountWallet). */
export function walletBar(acc) {
  const url = explorerAddress(acc.address);
  const addr = url
    ? `<a class="mono" href="${esc(url)}" target="_blank" rel="noopener">${short(acc.address)} ↗</a>`
    : `<span class="mono">${short(acc.address)}</span>`;
  return `<div class="wbar">
    <span class="wdot"></span>
    <div class="wbar-t"><b>${esc(acc.label)}</b><span class="muted mono-sm">${addr} · ${esc(NET.label)}</span></div>
    <span class="wbal num" data-saldo>…</span>
    <button class="btn btn-sm wbar-out" type="button" data-salir>Salir</button>
  </div>`;
}

export async function fillBalance(root, acc) {
  const el = root.querySelector("[data-saldo]");
  if (!el) return 0n;
  try {
    const b = await balance(acc);
    el.textContent = `${avax(b, 4)} AVAX`;
    return b;
  } catch {
    el.textContent = "sin saldo";
    return 0n;
  }
}

/** Pantalla para entrar: QR del jurado, clave pegada o (en local) una cuenta del nodo. */
export function loginScreen(title) {
  const local =
    NETWORK === "localhost"
      ? `<div class="card"><p class="eyebrow">Red local · cuentas del nodo de Hardhat</p>
          <div class="accs">${LOCAL_ACCOUNTS.map(([n, i]) => `<button class="btn" type="button" data-local="${i}">${esc(n)}</button>`).join("")}</div></div>`
      : "";
  return `<section class="page narrow">
    <p class="eyebrow">${esc(NET.label)} · no es plata real</p>
    <h1 class="h1">${esc(title)}</h1>
    <div class="card qrhelp">
      <div class="qrhelp-ic">${icon("coins")}</div>
      <div>
        <p class="eyebrow">Para aportar necesitás un QR de prueba</p>
        <h2>Escaneá el QR con la cámara del celular.</h2>
        <ol class="qrhelp-steps">
          <li>Se abre esta página con una billetera de prueba ya cargada (0,03 AVAX de la red Fuji, no es plata real).</li>
          <li>Elegís la parcela, el monto y qué pasa con tu saldo si hay desmonte.</li>
          <li>Tocás «Aportar»: la transacción queda en la blockchain y la ves en vivo.</li>
        </ol>
        <p class="muted">Los QR los repartimos impresos en la presentación. No están en la web a propósito: cada uno lleva la clave de su billetera.</p>
      </div>
    </div>
    <a class="btn btn-block" href="#/como-funciona">Sin QR: ver cómo funciona la demo →</a>
    ${local}
    <details class="card paste"><summary>Tengo una clave de prueba</summary>
      <form data-pegar class="paste-f">
        <label class="lbl" for="clave">Clave privada de prueba (no uses una billetera con plata real)</label>
        <input id="clave" class="input mono" type="password" autocomplete="off" spellcheck="false" placeholder="0x…">
        <button class="btn btn-dark" type="submit">Usar esta billetera</button>
        <p class="err" data-err hidden></p>
      </form>
    </details>
  </section>`;
}

/** Engancha los botones de entrar y salir. onChange se llama al cambiar de billetera. */
export function bindLogin(root, onChange) {
  const handler = (e) => {
    const loc = e.target.closest("[data-local]");
    if (loc) {
      useLocal(Number(loc.dataset.local));
      onChange();
      return;
    }
    if (e.target.closest("[data-salir]")) {
      logout();
      onChange();
    }
  };
  const submit = (e) => {
    const f = e.target.closest("[data-pegar]");
    if (!f) return;
    e.preventDefault();
    try {
      useKey(f.querySelector("input").value);
      onChange();
    } catch (err) {
      const p = f.querySelector("[data-err]");
      p.textContent = err.message;
      p.hidden = false;
    }
  };
  root.addEventListener("click", handler);
  root.addEventListener("submit", submit);
  return () => {
    root.removeEventListener("click", handler);
    root.removeEventListener("submit", submit);
  };
}

/** Resultado de una transacción, con link al explorer. */
export function txDone(text, receipt) {
  const url = explorerTx(receipt.transactionHash);
  return `<div class="notice notice-verde" role="status">${icon("tree")}<div><strong>${text}</strong>
    <p>${url ? `<a class="mono" href="${esc(url)}" target="_blank" rel="noopener">Ver la transacción ${short(receipt.transactionHash)} ↗</a>` : `<span class="mono">${short(receipt.transactionHash)}</span>`} · bloque ${receipt.blockNumber}</p></div></div>`;
}

export const txError = (e) =>
  `<div class="notice notice-terra" role="alert">${icon("warn")}<div><strong>No se pudo.</strong><p>${esc(reason(e))}</p></div></div>`;

/** Corre una acción con el botón deshabilitado y un aviso de espera. */
export async function withBusy(btn, out, label, fn) {
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  out.innerHTML = `<p class="muted mono-sm" role="status">Firmando con la billetera de prueba y esperando el bloque…</p>`;
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    out.innerHTML = txError(e);
    return null;
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
}

export { account };
