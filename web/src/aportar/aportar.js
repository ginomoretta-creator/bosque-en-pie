// Aportar (#26): elegir parcela, monto y qué pasa con el saldo si hay desmonte; firmar con la billetera de prueba.
import { parseEther } from "viem";
import { formatEther } from "viem";
import { NET } from "../chain.js";
import { avax, esc, int } from "../format.js";
import { drawMap, latestImage } from "../map.js";
import { reports } from "../reports.js";
import { icon, statusChip } from "../ui.js";
import { account, bindLogin, fillBalance, loginScreen, txDone, walletBar, withBusy } from "./comun.js";
import { read, send } from "./billetera.js";

const OPEN = (p) => p.status === 1 || p.status === 2; // el contrato acepta aportes en pie o en revisión
const GAS = parseEther("0.002"); // reserva para el gas (en Fuji hoy cuesta mucho menos)

const letterOf = (p) => p.name.replace("Parcela ", "");

/** Qué financia una parcela, con lo que dicen el contrato y el último informe aplicado. */
function parcelInfo(p) {
  const open = OPEN(p);
  const ha = Number(p.hectares);
  const fee = Number(formatEther(p.fee ?? 0n));
  const cuotas = p.fee > 0n ? Number(p.balance / p.fee) : 0;
  const img = latestImage(letterOf(p), p);
  const carb = img ? reports[letterOf(p)]?.[img.month]?.carbono : null;
  const rows = [
    ["Cada cuota pagada", `${int(ha)} certificados <span class="muted">(1 por hectárea en pie)</span>`],
    fee > 0 ? ["Por cada AVAX que aportás", `hasta ${int(ha / fee)} certificados`] : null,
    ["Cuota", `${avax(p.fee)} AVAX por mes · 60 % dueño, 40 % operador`],
    ["El pozo alcanza para", `${int(cuotas)} ${cuotas === 1 ? "cuota" : "cuotas"} más`],
    carb ? ["Carbono que sigue en pie", `≈ ${int(carb.tco2e)} t CO₂e <span class="tag-sim">SIMULACIÓN · no validado</span>`] : null,
  ].filter(Boolean);
  return `
    <div class="card-h"><b class="pick-n">${esc(p.name)}</b>${statusChip(p.status)}</div>
    <p class="muted">${int(ha)} ha de monte nativo · Chaco salteño</p>
    ${
      open
        ? `<dl class="pick-rows">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
    <p class="muted mono-sm">Los certificados se reparten entre quienes aportaron, según cuánto puso cada uno, y solo con la parcela verificada en pie.</p>
    <a class="btn btn-dark btn-block" href="#/aportar/${p.id}">Aportar a la ${esc(p.name)} →</a>`
        : `<p><b>Desmontada: no recibe aportes y sus certificados quedaron congelados.</b></p>
    <a class="btn btn-block" href="#/parcela/${p.id}">Ver qué pasó →</a>`
    }`;
}

const fechaCorta = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });

/** " (A: 17 dic 2025 · B: 15 sept 2025)" con la fecha de la imagen que muestra el mapa en cada parcela. */
function fechas(s) {
  const f = s.parcels
    .map((p) => [letterOf(p), latestImage(letterOf(p), p)?.fecha])
    .filter(([, iso]) => iso)
    .map(([l, iso]) => `${l}: ${fechaCorta(iso)}`);
  return f.length ? ` (${esc(f.join(" · "))})` : "";
}

function pickParcel(s) {
  if (!s.parcels.length) return pickList(s);
  const first = s.parcels.find(OPEN) || s.parcels[0];
  return {
    html: pickList(s, `
    <div class="pick-explore">
      <div class="pick-map" data-pick-map role="application" aria-label="Mapa de las parcelas"></div>
      <div class="card pick-info" data-pick-info aria-live="polite">${parcelInfo(first)}</div>
    </div>
    <p class="muted mono-sm pick-hint">Pasá el mouse o tocá una parcela en el mapa para ver qué financiás.
      Adentro de cada parcela, la imagen Sentinel-2 de su último informe${fechas(s)}; alrededor, mosaico 2023.</p>`),
    mount(el) {
      const info = el.querySelector("[data-pick-info]");
      const show = (p) => (info.innerHTML = parcelInfo(p));
      const map = drawMap(el.querySelector("[data-pick-map]"), s.parcels, { onSelect: show, onHover: show, dateNote: false });
      return () => map.remove();
    },
  };
}

function pickList(s, explore = "") {
  const cards = s.parcels
    .map((p) => {
      const open = OPEN(p);
      return `<a class="card pick${open ? "" : " pick-off"}" href="${open ? `#/aportar/${p.id}` : `#/parcela/${p.id}`}">
        <div class="card-h"><b class="pick-n">${esc(p.name)}</b>${statusChip(p.status)}</div>
        <p class="muted">${int(p.hectares)} ha · cuota ${avax(p.fee)} AVAX por mes</p>
        <p class="pick-cta">${open ? "Aportar a esta parcela →" : "No recibe aportes: ya está desmontada o cerrada"}</p>
      </a>`;
    })
    .join("");
  return `<section class="page ${explore ? "pick-page" : "narrow"}">
    <a class="back" href="#/">← Parcelas</a>
    <h1 class="h1">¿A qué parcela querés aportar?</h1>
    ${explore}
    ${cards ? `<div class="pick-cards">${cards}</div>` : `<p class="muted">${s.loading ? "Leyendo el contrato…" : "No hay parcelas registradas."}</p>`}
  </section>`;
}

function form(p, acc) {
  return `<section class="page narrow">
    <a class="back" href="#/parcela/${p.id}">← ${esc(p.name)}</a>
    ${walletBar(acc)}
    <h1 class="h1">¿Cuánto querés aportar a la ${esc(p.name)}?</h1>
    <form data-aporte class="aform">
      <div class="amounts" data-montos></div>
      <label class="lbl" for="monto">Otro monto (AVAX)</label>
      <input id="monto" class="input num-in" inputmode="decimal" autocomplete="off" placeholder="0,01">

      <p class="lbl">Si hay desmonte, tu saldo…</p>
      <label class="choice"><input type="radio" name="eleccion" value="0" checked>
        <span><b>Vuelve a mí</b><span>Lo retirás en proporción a lo que aportaste.</span></span></label>
      <label class="choice"><input type="radio" name="eleccion" value="1">
        <span><b>Va a restaurar la parcela</b><span>Queda como fondo de restauración. Si en <span data-plazo>un año</span> no se usa, lo retirás.</span></span></label>

      <div class="card rows rows-flat" data-resumen></div>
      <button class="btn btn-dark btn-block" type="submit" data-enviar>Aportar</button>
      <p class="muted center mono-sm">Firmás con tu billetera de prueba. No sale plata real.</p>
      <div data-out></div>
    </form>
  </section>`;
}

export function aportar(params, s) {
  if (!params.id) return pickParcel(s);
  const p = s.parcels.find((x) => x.id === Number(params.id));
  if (!p) return `<section class="page narrow"><h1 class="h1">Aportar</h1><p class="muted">${s.loading ? "Leyendo el contrato…" : "Esa parcela no existe."}</p><a class="btn" href="#/aportar">Elegir parcela</a></section>`;
  const acc = account();
  if (!acc) {
    return {
      html: loginScreen(`Aportar a la ${p.name}`),
      mount: (el) => bindLogin(el, () => window.dispatchEvent(new HashChangeEvent("hashchange"))),
    };
  }
  if (!OPEN(p)) {
    return `<section class="page narrow"><a class="back" href="#/parcela/${p.id}">← ${esc(p.name)}</a>
      <h1 class="h1">${esc(p.name)} ya no recibe aportes</h1>
      <div class="notice notice-terra">${icon("axe")}<div><strong>${statusChip(p.status)}</strong><p>Si aportaste antes del corte, tu parte está en Mi aporte.</p></div></div>
      <a class="btn btn-dark btn-block" href="#/mi-aporte">Ver mi parte</a></section>`;
  }
  return { html: form(p, acc), mount: (el) => mountForm(el, p, acc) };
}

function mountForm(el, p, acc) {
  const off = bindLogin(el, () => window.dispatchEvent(new HashChangeEvent("hashchange")));
  const f = el.querySelector("[data-aporte]");
  const input = f.querySelector("#monto");
  const montos = f.querySelector("[data-montos]");
  const resumen = f.querySelector("[data-resumen]");
  const btn = f.querySelector("[data-enviar]");
  const out = f.querySelector("[data-out]");
  let max = 0n;
  let amount = 0n;

  const fee = p.fee;
  const toAvaxText = (wei) => avax(wei, 4).replace(/,?0+$/, "").replace(/,$/, "");

  function parse(v) {
    const t = String(v).trim().replace(",", ".");
    if (!/^\d*\.?\d+$/.test(t)) return null;
    try {
      return parseEther(t);
    } catch {
      return null;
    }
  }

  function paint() {
    const cuotas = Number((amount * 100n) / fee) / 100;
    const ha = Number(p.hectares);
    const ok = amount > 0n && amount <= max;
    resumen.innerHTML = `
      <div><span>Cubre</span><b class="num">${amount > 0n ? `${cuotas.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${cuotas === 1 ? "cuota" : "cuotas"}` : "—"}</b></div>
      <div><span>Cada cuota pagada certifica</span><b class="num">${int(ha)} ha-mes, repartidas entre quienes aportan</b></div>
      <div><span>Red</span><b>${esc(NET.label)} · prueba</b></div>`;
    btn.disabled = !ok;
    btn.textContent = amount > 0n ? `Aportar ${toAvaxText(amount)} AVAX de prueba` : "Elegí un monto";
    for (const b of montos.querySelectorAll("[data-v]")) b.classList.toggle("on", BigInt(b.dataset.v) === amount);
    if (amount > max && max > 0n) out.innerHTML = `<p class="err">Tu billetera tiene para aportar hasta ${toAvaxText(max)} AVAX (se guarda un poco para el gas).</p>`;
    else if (!out.querySelector(".notice")) out.innerHTML = "";
  }

  (async () => {
    const bal = await fillBalance(el, acc);
    max = bal > GAS ? bal - GAS : 0n;
    const opts = [1n, 2n, 5n, 10n].map((n) => n * fee).filter((v) => v <= max);
    // «Todo lo que tengo» solo si la billetera es chica (las del jurado); con miles de AVAX locales no tiene sentido.
    if (max > 0n && max < 10n * fee && !opts.includes(max)) opts.push(max);
    montos.innerHTML = opts.length
      ? opts
          .map((v) => {
            const c = Number((v * 100n) / fee) / 100;
            const sub = v === max && !(v % fee === 0n && c <= 10) ? "todo lo que tengo" : `${c.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ${c === 1 ? "cuota" : "cuotas"}`;
            return `<button type="button" class="amt" data-v="${v}" aria-label="${toAvaxText(v)} AVAX, ${sub}"><b>${toAvaxText(v)}</b><span>${sub}</span></button>`;
          })
          .join("")
      : `<p class="err">La billetera de prueba no tiene saldo para aportar.</p>`;
    amount = opts.includes(fee) ? fee : opts[0] || 0n;
    paint();
  })();

  read("restorationTimeout")
    .then((t) => {
      const d = Number(t);
      const plazo = f.querySelector("[data-plazo]");
      if (plazo && d) plazo.textContent = d >= 86400 * 300 ? `${Math.round(d / (86400 * 30))} meses` : `${Math.round(d / 86400)} días`;
    })
    .catch(() => {}); // el plazo es solo texto

  const onClick = (e) => {
    const b = e.target.closest("[data-v]");
    if (!b) return;
    amount = BigInt(b.dataset.v);
    input.value = "";
    out.innerHTML = "";
    paint();
  };
  const onInput = () => {
    const v = parse(input.value);
    amount = v ?? 0n;
    out.innerHTML = "";
    paint();
  };
  const onSubmit = async (e) => {
    if (!e.target.closest("[data-aporte]")) return;
    e.preventDefault();
    const choice = Number(f.querySelector("input[name=eleccion]:checked").value);
    const value = amount;
    const r = await withBusy(btn, out, "Enviando…", () => send("donate", [BigInt(p.id), choice], value));
    if (r) {
      out.innerHTML =
        txDone(`Listo: aportaste ${toAvaxText(value)} AVAX a la ${esc(p.name)}.`, r) +
        `<a class="btn btn-block" href="#/mi-aporte">Ver mi aporte</a>`;
      const bal = await fillBalance(el, acc);
      max = bal > GAS ? bal - GAS : 0n;
      paint();
    }
  };
  montos.addEventListener("click", onClick);
  input.addEventListener("input", onInput);
  el.addEventListener("submit", onSubmit);
  return () => {
    off();
    montos.removeEventListener("click", onClick);
    input.removeEventListener("input", onInput);
    el.removeEventListener("submit", onSubmit);
  };
}

