// Cómo funciona: la demo explicada para quien llega sin contexto (jurado, equipo, cualquiera).
// Qué es cada cosa, qué es real y qué es de prueba, y cuatro pasos para probarla.
import { NET, explorerAddress } from "../chain.js";
import { esc, short } from "../format.js";
import { account } from "../aportar/billetera.js";
import { icon } from "../ui.js";

const PASOS = [
  {
    ic: "stump",
    t: "Mirá cómo se desmontó la Parcela B",
    p: "Abrí la parcela y tocá «▶ Ver el año»: son las imágenes satelitales reales de 2025, mes por mes. En agosto aparece el desmonte y el contrato corta los pagos solo.",
    a: ["#/parcela/2", "Ver la Parcela B"],
  },
  {
    ic: "shield",
    t: "Comprobá que nadie tocó la evidencia",
    p: "Cada informe guarda en el contrato la huella (hash) de su evidencia. Esta página la vuelve a calcular en tu navegador y te dice si coincide.",
    a: ["#/parcela/2/2025-09", "Ver el informe de septiembre"],
  },
  {
    ic: "coins",
    t: "Aportá con un QR de prueba",
    p: "Escaneá un QR con la cámara del celular: se abre esta web con una billetera de prueba ya cargada. Elegís parcela y monto, y firmás. No sale plata real.",
    a: ["#/aportar", "Ir a aportar"],
  },
  {
    ic: "medal",
    t: "Mirá que llegó",
    p: "El aporte aparece en vivo en la pantalla, en «Actividad» y en «Mi aporte», con el link a la transacción en el explorador de Avalanche. Cuando la parcela cobra su cuota, recibís certificados por las hectáreas-mes que financiaste.",
    a: ["#/actividad", "Ver la actividad"],
  },
];

const GLOSARIO = [
  ["Parcela", "Un pedazo de monte nativo del Chaco salteño. A sigue en pie; B se desmontó en 2025."],
  ["Aporte", "AVAX que dejás en el contrato para una parcela. El contrato lo guarda; nadie del equipo lo puede mover."],
  ["Cuota", "Lo que el contrato paga por cada mes que la parcela sigue en pie: 60 % al dueño y 40 % al operador que la cuida."],
  ["Informe", "Una vez por mes, el satélite Sentinel-2 mira la parcela y se calcula qué porcentaje del monte sigue en pie comparado con el mismo mes del año anterior."],
  ["2 de 3 firmas", "Tres verificadores revisan el informe; con dos firmas vale. El contrato chequea las firmas antes de pagar o cortar."],
  ["En revisión", "Una lectura mala (menos de 95 % en pie): ese mes no paga ni corta. Si la siguiente también da mal, se corta."],
  ["Desmontada", "Dos lecturas malas seguidas. Los pagos se cortan para siempre y el saldo vuelve a los donantes o va a restaurar, según eligió cada uno."],
  ["Nubes", "Si se ve menos del 60 % de la parcela, ese mes no hay informe: ni paga ni corta."],
  ["Certificado", "Un token por cada hectárea-mes que tu aporte pagó con el monte en pie. No es de carbono ni compensa emisiones."],
  ["Hash", "La huella digital de un archivo: si cambia una coma, cambia el hash. Por eso sirve para probar que la evidencia es la misma que se firmó."],
];

export function como(_params, s) {
  const contract = s.deployment?.address;
  const url = contract ? explorerAddress(contract) : null;
  const logged = !!account();
  return `
  <section class="page como">
    <div class="como-hero">
      <p class="eyebrow">Cómo funciona</p>
      <h1 class="h1">El monte cobra mientras siga en pie.</h1>
      <p class="lead">Una empresa o una persona deja plata en un contrato de Avalanche. Cada mes, una imagen satelital confirma si la parcela sigue en pie: si sigue, el contrato le paga a quienes la cuidan; si aparece un desmonte, los pagos se cortan solos. Nadie tiene que confiar en nadie: las reglas están en el contrato y cualquiera puede revisar las imágenes.</p>
    </div>

    <div class="block">
      <div class="block-h"><p class="eyebrow">Probala en 4 pasos</p><span class="muted mono-sm">2 minutos</span></div>
      <ol class="como-pasos">
        ${PASOS.map((x, i) => `<li class="card">
          <div class="como-n">${icon(x.ic)}<span class="mono-sm">0${i + 1}</span></div>
          <h3>${esc(x.t)}</h3>
          <p class="muted">${esc(x.p)}</p>
          <a class="btn btn-sm${i === 0 ? " btn-dark" : ""}" href="${x.a[0]}">${esc(x.a[1])} →</a>
        </li>`).join("")}
      </ol>
    </div>

    <div class="como-duo">
      <div class="card como-qr">
        <p class="eyebrow">Los QR</p>
        <h3>¿Dónde están los QR para aportar?</h3>
        <p>Los repartimos <b>impresos</b> en la presentación. Cada QR es una billetera de prueba con 0,03 AVAX de la red Fuji: no es plata real, pero la transacción es de verdad y queda en la blockchain.</p>
        <p class="muted">No están publicados en esta página a propósito: cada QR lleva la clave de su billetera y cualquiera que lo vea la puede usar. Sin QR podés recorrer todo lo demás.</p>
        ${logged ? `<p class="como-ok">${icon("tree")}Ya tenés una billetera de prueba abierta en esta pestaña. <a href="#/aportar">Aportar →</a></p>` : ""}
      </div>
      <div class="card">
        <p class="eyebrow">Real y de prueba</p>
        <h3>Qué es real</h3>
        <ul class="como-list">
          <li>Las imágenes de Sentinel-2 (satélite de la Agencia Espacial Europea) y el cálculo del monte en pie.</li>
          <li>El contrato en Avalanche, sus reglas y cada transacción${url ? `: <a class="mono" href="${esc(url)}" target="_blank" rel="noopener">${short(contract)} ↗</a>` : ""}.</li>
          <li>Las dos parcelas y el desmonte de B en agosto y septiembre de 2025.</li>
        </ul>
        <h3>Qué es de prueba</h3>
        <ul class="como-list">
          <li>La red: ${esc(NET.label)}. El AVAX de prueba no vale plata.</li>
          <li>Las billeteras del dueño, el operador y los donantes.</li>
          <li>Los tres verificadores son del equipo, y los plazos van en cero para mostrar un año en un minuto. En producción serían verificadores independientes, con 72 horas para impugnar un informe.</li>
        </ul>
      </div>
    </div>

    <div class="block">
      <div class="block-h"><p class="eyebrow">Qué es cada cosa</p></div>
      <dl class="como-glos">
        ${GLOSARIO.map(([t, d]) => `<div class="card"><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join("")}
      </dl>
    </div>

    <div class="block como-why">
      <div class="block-h"><p class="eyebrow">¿Por qué blockchain?</p></div>
      <p>El que pone la plata no conoce a quien cuida el monte ni puede ir a verlo; el que cuida no sabe si le van a seguir pagando. Con un contrato, la plata no la guarda ninguna de las dos partes ni una organización intermedia: la regla «si el satélite confirma, se paga; si hay desmonte, se corta» se cumple sola, y todo queda a la vista de cualquiera.</p>
    </div>
  </section>`;
}
