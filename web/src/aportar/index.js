// Carril 4 (#26, #27, #28): aportar, mi aporte y certificados, con la billetera de prueba del QR del jurado.
// live: false → main.js no las repinta con cada bloque; cada pantalla se actualiza sola (store.subscribe)
// sin borrar un formulario a medio completar.
import "./aportar.css";
import { route } from "../router.js";
import { aportar } from "./aportar.js";
import { miAporte } from "./mi-aporte.js";
import { certificados } from "./certificados.js";

route("/aportar", aportar, { live: false });
route("/aportar/:id", aportar, { live: false });
route("/mi-aporte", miAporte, { live: false });
route("/certificados", certificados, { live: false });
