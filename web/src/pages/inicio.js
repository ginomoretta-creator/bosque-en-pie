// Portada: la propuesta en una frase, la prueba (la Parcela B antes y después del desmonte, con las
// imágenes reales del oráculo), cómo funciona en tres pasos, qué recibe quien aporta y las parcelas hoy.
import { explorerAddress } from "../chain.js";
import { esc, int, pct, short } from "../format.js";
import { parcelMap } from "../map.js";
import { reports } from "../reports.js";
import { statusChip } from "../ui.js";

// La prueba: el mismo lugar, dos meses. Julio en pie y pagó; septiembre desmontada y el contrato cortó.
const PRUEBA = [
  { key: "2025-07", tone: "ok", color: "#6CC58A", what: "en pie · el contrato pagó la cuota" },
  { key: "2025-09", tone: "cut", color: "#E58A66", what: "desmontada · el contrato cortó los pagos" },
];

const PASOS = [
  ["Aportás", "Elegís una parcela y dejás AVAX en un contrato de Avalanche. Nadie del equipo puede mover esa plata."],
  ["El satélite confirma", "Cada mes, Sentinel-2 compara la parcela con el mismo mes del año anterior. Dos de tres verificadores firman el informe."],
  ["El contrato paga o corta", "En pie: paga la cuota al dueño (60 %) y a quien la cuida (40 %). Si hay desmonte, corta para siempre y el saldo vuelve a quien aportó o va a restaurar."],
];

const fecha = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";

function prueba() {
  const folders = reports.B || {};
  const shots = PRUEBA.map((x) => ({ ...x, f: folders[x.key] })).filter((x) => x.f?.rgb);
  if (shots.length < 2) return "";
  return `
  <section class="land-proof" aria-label="La Parcela B antes y después del desmonte">
    <div class="land-proof-grid">
      ${shots
        .map(
          (x, i) => `
      <figure class="land-shot land-${x.tone}">
        <div class="land-map" data-shot="${i}" role="img" aria-label="Imagen Sentinel-2 de la Parcela B, ${esc(fecha(x.f.evidence?.imagen?.fecha))}"></div>
        <figcaption>
          <span class="mono-sm">${esc(fecha(x.f.evidence?.imagen?.fecha))}</span>
          <b>${pct(x.f.report?.coverBps ?? 0)}<small>%</small></b>
          <span>${esc(x.what)}</span>
        </figcaption>
      </figure>`,
        )
        .join("")}
    </div>
    <p class="land-proof-cap mono-sm">Parcela B · 84 ha · Chaco salteño. Mismo lugar, dos imágenes del satélite: el porcentaje es el monte que sigue en pie. Fondo: <a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless 2023</a> de EOX IT Services, contiene datos Copernicus Sentinel modificados.</p>
  </section>`;
}

function parcelas(s) {
  if (!s.parcels.length) return `<p class="muted">${s.loading ? "Leyendo el contrato…" : "Todavía no hay parcelas registradas."}</p>`;
  return `<ul class="land-parcels">${s.parcels
    .map(
      (p) => `<li><a href="#/parcela/${p.id}">
        <span class="land-pn">${esc(p.name)}</span>
        ${statusChip(p.status)}
        <span class="land-pc">${p.lastReport ? `${pct(p.lastReport.coverBps)} %` : "—"}<small>en pie</small></span>
        <span class="land-ph muted">${int(p.hectares)} ha</span>
        <span class="land-go" aria-hidden="true">→</span>
      </a></li>`,
    )
    .join("")}</ul>`;
}

export function inicio(_params, s) {
  const contract = s.deployment?.address;
  const html = `
  <section class="land">
    <header class="land-hero">
      <p class="land-tag mono-sm">Monte nativo · Chaco salteño</p>
      <h1>Pagamos para que el monte siga <em>en&nbsp;pie</em>.</h1>
      <div class="land-sub">
        <p class="land-lead">Una empresa financia una parcela de monte. Cada mes, un satélite confirma que sigue en pie y un contrato le paga a quien la cuida. Si aparece un desmonte, los pagos se cortan solos.</p>
        <div class="land-cta">
          <a class="btn btn-dark" href="#/parcela/2">Ver una parcela real →</a>
          <a class="btn" href="#/aportar">Aportar con un QR</a>
        </div>
      </div>
    </header>

    ${prueba()}

    <section class="land-sec" aria-labelledby="land-como">
      <p class="eyebrow" id="land-como">Cómo funciona</p>
      <ol class="land-steps">
        ${PASOS.map(([t, d], i) => `<li><span class="land-n mono-sm">0${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join("")}
      </ol>
    </section>

    <section class="land-sec land-cert" aria-labelledby="land-cert">
      <p class="eyebrow">Lo que recibe quien aporta</p>
      <div class="land-cert-grid">
        <h2 id="land-cert">Un certificado por cada hectárea que sigue en pie, cada mes.</h2>
        <div>
          <p class="land-eq mono"><span>1 ha</span><i>×</i><span>1 mes en pie</span><i>=</i><b>1 certificado</b></p>
          <p class="muted">Llega cuando tu aporte paga una cuota con la parcela verificada en pie. Lo podés guardar, pasar a otra billetera o retirar a tu nombre. Cuenta monte conservado; no es carbono ni compensa emisiones.</p>
        </div>
      </div>
    </section>

    <section class="land-sec" aria-labelledby="land-hoy">
      <div class="block-h"><p class="eyebrow" id="land-hoy">Las parcelas hoy, leídas del contrato</p><a class="mono-sm" href="#/actividad">Ver la actividad →</a></div>
      ${parcelas(s)}
    </section>

    <section class="land-end">
      <h2>Nadie tiene que confiar en nadie.</h2>
      <p>Las reglas están en un contrato de Avalanche y las imágenes son públicas: cualquiera puede revisar cada pago y cada corte.</p>
      <div class="land-cta">
        <a class="btn btn-lima" href="#/como-funciona">Cómo funciona en detalle →</a>
        ${contract ? `<a class="btn btn-ghost" href="${esc(explorerAddress(contract))}" target="_blank" rel="noopener">Contrato ${short(contract)} ↗</a>` : ""}
      </div>
    </section>
  </section>`;

  return {
    html,
    mount(el) {
      const folders = reports.B || {};
      const maps = [...el.querySelectorAll("[data-shot]")].map((node) => {
        const x = PRUEBA[Number(node.dataset.shot)];
        const m = parcelMap(node, "B", { color: x.color, padding: 0.45, still: true });
        m.show(folders[x.key].rgb, { alt: "" });
        return m;
      });
      return () => maps.forEach((m) => m.destroy());
    },
  };
}
