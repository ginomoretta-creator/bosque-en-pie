// Carril 4 (#26, #27, #28): pantallas de aportar, mi aporte y certificados.
// Este archivo es solo el lugar donde se enchufan: reemplazá estas rutas por las pantallas reales.
// Con route(path, render, { live: false }) la pantalla no se repinta sola mientras alguien completa un formulario.
// La clave del QR está en judgeKey() de ../wallet.js; la lectura del contrato, en ../chain.js.
import { route } from "../router.js";

const pending = (title, issue) => () => `
  <section class="page narrow">
    <p class="eyebrow">En construcción · carril 4</p>
    <h1 class="h1">${title}</h1>
    <p class="muted">Esta pantalla llega con ${issue}.</p>
    <a class="btn" href="#/">Volver a las parcelas</a>
  </section>`;

route("/aportar", pending("Aportar", "#26"));
route("/aportar/:id", pending("Aportar", "#26"));
route("/mi-aporte", pending("Mi aporte", "#27"));
route("/certificados", pending("Certificados", "#28"));
