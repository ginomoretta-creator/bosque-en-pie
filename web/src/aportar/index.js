// Carril 4 (#26, #27, #28): aportar con la billetera del QR, mi aporte (recuperar) y certificados.
// La billetera es la clave de prueba que trae el QR (wallet.js → judgeKey); firma con viem desde el
// navegador del celular. Las pantallas con botones usan { live: false } y se actualizan solas en mount().
import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHOICE, NET, abi, client, deployment, explorerTx, store } from "../chain.js";
import { avax, esc, int, short } from "../format.js";
import { route } from "../router.js";
import { icon, statusChip, txLink } from "../ui.js";
import { forgetKey, judgeKey } from "../wallet.js";
import "./aportar.css";

// ------------------------------------------------------------------ billetera

function account() {
  const k = judgeKey();
  if (!k) return null;
  try {
    return privateKeyToAccount(k);
  } catch {
    return null;
  }
}

const walletClient = (acc) => createWalletClient({ account: acc, chain: NET.chain, transport: http(NET.rpc) });

/** Manda una transacción al contrato y espera el recibo. Devuelve el hash. */
async function send(acc, functionName, args, value = 0n) {
  const hash = await walletClient(acc).writeContract({ address: deployment.address, abi, functionName, args, value });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("la transacción se revirtió");
  store.refresh();
  return hash;
}

/** Mensaje de error entendible (fondos, revert del contrato con su motivo en español, red). */
function errorText(e) {
  const msg = `${e?.shortMessage || ""} ${e?.details || ""} ${e?.message || ""}`;
  if (/insufficient funds|exceeds the balance|have enough funds/i.test(msg)) return "La billetera no tiene AVAX de prueba suficiente para el aporte y el gas.";
  const reason = msg.match(/reverted with reason string '([^']+)'|reason:\s*([^\n]+)/i);
  if (reason) return `El contrato lo rechazó: ${reason[1] || reason[2]}.`;
  return e?.shortMessage || e?.message || String(e);
}

const noWallet = (what) => `
  <section class="page narrow">
    <p class="eyebrow">Billetera de prueba</p>
    <h1 class="h1">Escaneá un QR para ${what}</h1>
    <div class="card ap-empty">
      ${icon("pin")}
      <p>Cada QR de la hoja del jurado abre esta página con una billetera de prueba ya cargada con AVAX de ${esc(NET.label)}. No hay que instalar nada y no es plata real.</p>
    </div>
    <a class="btn" href="#/">Ver las parcelas</a>
  </section>`;

const walletLine = (acc) => `
  <div class="ap-wallet">
    <span class="mono-sm">Tu billetera de prueba</span>
    <span class="mono">${short(acc.address)}</span>
    <span class="mono ap-bal" data-bal>…</span>
    <button class="btn btn-ghost btn-sm" data-forget type="button">Salir</button>
  </div>`;

async function showBalance(el, acc) {
  const out = el.querySelector("[data-bal]");
  if (!out) return;
  try {
    out.textContent = `${avax(await client.getBalance({ address: acc.address }))} AVAX`;
  } catch {
    out.textContent = "saldo sin leer";
  }
}

function bindForget(el) {
  el.querySelector("[data-forget]")?.addEventListener("click", () => {
    forgetKey();
    location.hash = "#/";
    location.reload();
  });
}

// ------------------------------------------------------------------ aportar (#26)

function chooseParcel(_params, s) {
  const acc = account();
  if (!acc) return noWallet("aportar");
  const cards = s.parcels
    .map((p) => {
      const open = p.status === 1 || p.status === 2;
      return `
      <a class="card ap-pick${open ? "" : " ap-off"}" ${open ? `href="#/aportar/${p.id}"` : ""}>
        ${icon(p.status === 3 ? "stump" : "tree")}
        <div><strong>${esc(p.name)}</strong><p class="muted">${int(p.hectares)} ha · cuota ${avax(p.fee)} AVAX por mes</p></div>
        ${statusChip(p.status)}
      </a>`;
    })
    .join("");
  return {
    html: `
    <section class="page narrow">
      <p class="eyebrow">Aportar</p>
      <h1 class="h1">¿Qué monte querés cuidar?</h1>
      ${walletLine(acc)}
      <div class="ap-list">${cards || `<p class="muted">${s.loading ? "Leyendo el contrato…" : "No hay parcelas registradas."}</p>`}</div>
    </section>`,
    mount(el) {
      bindForget(el);
      showBalance(el, acc);
    },
  };
}

const MULTIPLES = [1, 3, 6, 12];

function aportar({ id }, s) {
  const acc = account();
  if (!acc) return noWallet("aportar");
  const p = s.parcels.find((x) => x.id === Number(id));
  if (!p) return `<section class="page narrow"><p class="muted">${s.loading ? "Leyendo el contrato…" : "Esa parcela no existe."}</p><a class="btn" href="#/aportar">Volver</a></section>`;
  if (p.status !== 1 && p.status !== 2) {
    return `<section class="page narrow"><a class="back" href="#/parcela/${p.id}">← ${esc(p.name)}</a>
      <h1 class="h1">${esc(p.name)} no recibe aportes</h1>
      <div class="notice notice-terra">${icon("axe")}<div><strong>La parcela quedó desmontada.</strong><p>Los pagos se cortaron para siempre. Si aportaste antes, podés recuperar tu parte.</p></div></div>
      <a class="btn btn-dark btn-block" href="#/mi-aporte">Ver mi aporte</a></section>`;
  }

  const amounts = MULTIPLES.map((n) => ({ n, wei: p.fee * BigInt(n) }));
  return {
    html: `
    <section class="page narrow">
      <a class="back" href="#/parcela/${p.id}">← ${esc(p.name)}</a>
      <div class="phead"><h1 class="h1">¿Cuánto querés aportar a la ${esc(p.name)}?</h1>${statusChip(p.status)}</div>
      ${walletLine(acc)}

      <p class="eyebrow">Monto en AVAX de prueba</p>
      <div class="ap-amounts" role="radiogroup" aria-label="Monto">
        ${amounts.map((a, i) => `<button type="button" class="ap-amt${i === 1 ? " on" : ""}" data-amt="${a.wei}" data-n="${a.n}" role="radio" aria-checked="${i === 1}">
          <b>${avax(a.wei)}</b><span>${a.n} ${a.n === 1 ? "cuota" : "cuotas"}</span></button>`).join("")}
      </div>

      <p class="eyebrow">Si hay desmonte, tu saldo…</p>
      <div class="ap-choices" role="radiogroup" aria-label="Destino si hay desmonte">
        <button type="button" class="ap-choice on" data-choice="0" role="radio" aria-checked="true">${icon("coin")}
          <div><strong>Vuelve a mí</strong><p class="muted">Lo retirás en proporción a lo que aportaste.</p></div><i></i></button>
        <button type="button" class="ap-choice" data-choice="1" role="radio" aria-checked="false">${icon("sprout")}
          <div><strong>Va a restaurar esta parcela</strong><p class="muted">Queda como fondo de restauración. Si no se usa en el plazo, lo podés retirar.</p></div><i></i></button>
      </div>

      <div class="card rows" data-summary></div>
      <div data-result></div>
      <button class="btn btn-dark btn-block" type="button" data-go>Aportar</button>
      <p class="muted hint ap-center">Firmás con tu billetera de prueba en ${esc(NET.label)}. No sale plata real.</p>
    </section>`,
    mount(el) {
      bindForget(el);
      showBalance(el, acc);
      let wei = amounts[1].wei;
      let n = amounts[1].n;
      let choice = 0;
      const summary = el.querySelector("[data-summary]");
      const goBtn = el.querySelector("[data-go]");
      const result = el.querySelector("[data-result]");
      const paint = () => {
        summary.innerHTML = `
          <div><span>Cubre</span><b class="num">${n} ${n === 1 ? "cuota" : "cuotas"} de ${avax(p.fee)} AVAX</b></div>
          <div><span>Certificados de monte en pie</span><b class="num">hasta ${int(n * Number(p.hectares))} ha-mes</b></div>
          <div><span>Si hay desmonte</span><b>${esc(CHOICE[choice])}</b></div>
          <div><span>Red</span><b>${esc(NET.label)}</b></div>`;
        goBtn.textContent = `Aportar ${avax(wei)} AVAX de prueba`;
      };
      const pick = (sel, attr, set) =>
        el.querySelectorAll(sel).forEach((b) =>
          b.addEventListener("click", () => {
            el.querySelectorAll(sel).forEach((x) => (x.classList.remove("on"), x.setAttribute("aria-checked", "false")));
            b.classList.add("on");
            b.setAttribute("aria-checked", "true");
            set(b);
            paint();
          }),
        );
      pick(".ap-amt", "data-amt", (b) => ((wei = BigInt(b.dataset.amt)), (n = Number(b.dataset.n))));
      pick(".ap-choice", "data-choice", (b) => (choice = Number(b.dataset.choice)));
      paint();

      goBtn.addEventListener("click", async () => {
        goBtn.disabled = true;
        goBtn.textContent = "Firmando y enviando…";
        result.innerHTML = "";
        try {
          const hash = await send(acc, "donate", [BigInt(p.id), choice], wei);
          result.innerHTML = `<div class="notice notice-verde">${icon("sigs")}<div><strong>Listo: tu aporte está en el pozo de la ${esc(p.name)}.</strong>
            <p>${avax(wei)} AVAX · si hay desmonte: ${esc(CHOICE[choice].toLowerCase())} · ${txLink(explorerTx(hash), short(hash, 10, 6))}</p></div></div>
            <div class="duo"><a class="btn btn-block" href="#/mi-aporte">Ver mi aporte</a><a class="btn btn-block" href="#/parcela/${p.id}">Ver la parcela</a></div>`;
          goBtn.remove();
          showBalance(el, acc);
        } catch (e) {
          result.innerHTML = `<div class="notice notice-terra">${icon("warn")}<div><strong>No se pudo aportar.</strong><p>${esc(errorText(e))}</p></div></div>`;
          goBtn.disabled = false;
          paint();
        }
      });
    },
  };
}

// ------------------------------------------------------------------ mi aporte (#27) y certificados (#28)

async function readMine(addr, parcels) {
  const call = (functionName, args) => client.readContract({ address: deployment.address, abi, functionName, args });
  const timeout = await call("restorationTimeout", []);
  const now = BigInt(Math.floor(Date.now() / 1000));
  return Promise.all(
    parcels.map(async (p) => {
      const id = BigInt(p.id);
      const [refund, restore, refundDone, restoreDone, leftoverDone, certs, certsPending, certsRetired] = await Promise.all([
        call("refundStake", [id, addr]),
        call("restoreStake", [id, addr]),
        call("refundClaimed", [id, addr]),
        call("restoreClaimed", [id, addr]),
        call("leftoverClaimed", [id, addr]),
        call("balanceOf", [addr, id]),
        call("pendingCertificates", [id, addr]),
        call("certRetiredBy", [id, addr]),
      ]);
      const stake = refund + restore;
      const totalStake = p.totalRefundStake + p.totalRestoreStake;
      const canRefund = p.status === 3 && refund > 0n && !refundDone;
      const restoreUnlock = p.endedAt + timeout;
      const canRestore = p.status === 3 && restore > 0n && !restoreDone && now >= restoreUnlock;
      const canLeftover = p.status === 4 && stake > 0n && !leftoverDone;
      return {
        p,
        refund,
        restore,
        stake,
        // parte del total pagado a quienes cuidan, en proporción al aporte (aproximado)
        paidShare: totalStake > 0n ? (p.totalPaid * stake) / totalStake : 0n,
        refundAmount: canRefund ? (p.refundPool * refund) / p.totalRefundStake : 0n,
        restoreAmount: p.status === 3 && restore > 0n && !restoreDone ? (p.restorePool * restore) / p.totalRestoreStake : 0n,
        leftoverAmount: canLeftover ? (p.leftoverPool * stake) / totalStake : 0n,
        canRefund,
        canRestore,
        canLeftover,
        restoreUnlock,
        refundDone,
        restoreDone,
        certs,
        certsPending,
        certsRetired,
      };
    }),
  );
}

function mineCard(m) {
  const { p } = m;
  const actions = [];
  if (m.canRefund) actions.push(`<button class="btn btn-lima btn-block" data-tx="withdrawRefund" data-id="${p.id}">Recuperar ${avax(m.refundAmount, 4)} AVAX</button>`);
  if (m.canRestore) actions.push(`<button class="btn btn-block" data-tx="withdrawRestoration" data-id="${p.id}">Retirar restauración ${avax(m.restoreAmount, 4)} AVAX</button>`);
  if (m.canLeftover) actions.push(`<button class="btn btn-lima btn-block" data-tx="withdrawLeftover" data-id="${p.id}">Retirar sobrante ${avax(m.leftoverAmount, 4)} AVAX</button>`);
  if (m.certsPending > 0n) actions.push(`<button class="btn btn-block" data-tx="claimCertificates" data-id="${p.id}">Recibir ${int(m.certsPending)} certificados</button>`);
  const unlock = new Date(Number(m.restoreUnlock) * 1000).toLocaleDateString("es-AR");
  return `
  <div class="card ap-mine">
    <div class="card-h"><strong>${esc(p.name)}</strong>${statusChip(p.status)}</div>
    <div class="rows rows-flat">
      <div><span>Aportaste</span><b class="num">${avax(m.stake, 4)} AVAX</b></div>
      ${m.refund > 0n ? `<div><span>· si hay desmonte vuelve a vos</span><b class="num">${avax(m.refund, 4)}</b></div>` : ""}
      ${m.restore > 0n ? `<div><span>· si hay desmonte va a restaurar</span><b class="num">${avax(m.restore, 4)}</b></div>` : ""}
      <div><span>Llegó a quienes cuidan (tu parte, aprox.)</span><b class="num">${avax(m.paidShare, 4)} AVAX</b></div>
      ${m.p.status === 3 && m.refund > 0n ? `<div><span>Para recuperar</span><b class="num ap-terra">${m.refundDone ? "ya lo retiraste" : `${avax(m.refundAmount, 4)} AVAX`}</b></div>` : ""}
      ${m.p.status === 3 && m.restore > 0n ? `<div><span>Fondo de restauración</span><b class="num">${m.restoreDone ? "ya lo retiraste" : m.canRestore ? `${avax(m.restoreAmount, 4)} AVAX, ya disponible` : `bloqueado hasta el ${unlock}`}</b></div>` : ""}
      <div><span>Certificados de monte en pie</span><b class="num">${int(m.certs)} ha-mes${m.certsRetired > 0n ? ` · ${int(m.certsRetired)} retirados` : ""}${m.p.status === 3 ? " · congelados" : ""}</b></div>
    </div>
    ${actions.join("")}
  </div>`;
}

function miAporte(_params, s) {
  const acc = account();
  if (!acc) return noWallet("ver tu aporte");
  return {
    html: `
    <section class="page narrow">
      <p class="eyebrow">Mi aporte</p>
      <h1 class="h1" data-title>Tu aporte</h1>
      ${walletLine(acc)}
      <div data-mine><p class="muted">${s.loading ? "Leyendo el contrato…" : "Leyendo tus aportes…"}</p></div>
      <div data-result></div>
    </section>`,
    mount(el) {
      bindForget(el);
      showBalance(el, acc);
      let alive = true;
      const box = el.querySelector("[data-mine]");
      const result = el.querySelector("[data-result]");
      const load = async () => {
        if (!store.state.parcels.length) return;
        try {
          const mine = (await readMine(acc.address, store.state.parcels)).filter((m) => m.stake > 0n || m.certs > 0n);
          if (!alive) return;
          el.querySelector("[data-title]").textContent = mine.length
            ? `Aportaste en ${mine.length === 1 ? "una parcela" : `${mine.length} parcelas`}.`
            : "Todavía no aportaste.";
          box.innerHTML = mine.length
            ? mine.map(mineCard).join("")
            : `<a class="btn btn-dark btn-block" href="#/aportar">Elegir una parcela para aportar</a>`;
        } catch (e) {
          box.innerHTML = `<div class="notice notice-terra"><div><strong>No se pudieron leer tus aportes.</strong><p>${esc(errorText(e))}</p></div></div>`;
        }
      };
      box.addEventListener("click", async (ev) => {
        const b = ev.target.closest("[data-tx]");
        if (!b) return;
        const label = b.textContent;
        b.disabled = true;
        b.textContent = "Firmando y enviando…";
        result.innerHTML = "";
        try {
          const hash = await send(acc, b.dataset.tx, [BigInt(b.dataset.id)]);
          result.innerHTML = `<div class="notice notice-verde">${icon("sigs")}<div><strong>Listo.</strong><p>${esc(label)} · ${txLink(explorerTx(hash), short(hash, 10, 6))}</p></div></div>`;
          showBalance(el, acc);
          await load();
        } catch (e) {
          result.innerHTML = `<div class="notice notice-terra">${icon("warn")}<div><strong>No se pudo completar.</strong><p>${esc(errorText(e))}</p></div></div>`;
          b.disabled = false;
          b.textContent = label;
        }
      });
      load();
      let seen = store.state.version;
      const unsub = store.subscribe((st) => {
        if (st.version === seen) return; // solo cuando llegan eventos nuevos, no con cada bloque
        seen = st.version;
        load();
      });
      return () => {
        alive = false;
        unsub();
      };
    },
  };
}

route("/aportar", chooseParcel, { live: false });
route("/aportar/:id", aportar, { live: false });
route("/mi-aporte", miAporte, { live: false });
route("/certificados", miAporte, { live: false }); // los certificados se ven y se reciben en Mi aporte
