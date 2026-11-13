// Mapa de las parcelas (Leaflet) sobre Sentinel-2 cloudless de EOX.
// Los polígonos salen de parcels/*.geojson y el color, del estado que dice el contrato.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { STATUS, STATUS_KEY } from "./chain.js";
import { esc } from "./format.js";
import { reports } from "./reports.js";

const files = import.meta.glob("../../parcels/*.geojson", { eager: true, query: "?raw", import: "default" });

/** { A: Feature, B: Feature } */
export const geo = {};
for (const [path, raw] of Object.entries(files)) {
  const letter = path.match(/([^/]+)\.geojson$/)[1];
  try {
    const g = JSON.parse(raw);
    geo[letter] = g.type === "FeatureCollection" ? g.features[0] : g;
  } catch {
    console.warn(`No se pudo leer parcels/${letter}.geojson`);
  }
}

// Recorte de cada imagen de reports/<P>/<mes>/rgb.png: la ventana de lectura del oráculo
// (bbox de la parcela ajustado hacia afuera a la grilla de 20 m del tile 20KNA, UTM 20S),
// pasada a lat/lon. Calculado con oracle/s2.py; las parcelas están congeladas.
const IMG_BOUNDS = {
  A: [[-22.451291, -62.129261], [-22.441484, -62.119676]],
  B: [[-22.467432, -62.107389], [-22.457812, -62.099358]],
};

/** Último informe con imagen de una parcela: { month, rgb, fecha }. */
export function latestImage(letter) {
  const months = Object.keys(reports[letter] || {}).sort().reverse();
  for (const m of months) {
    const r = reports[letter][m];
    if (r.rgb) return { month: m, rgb: r.rgb, fecha: r.evidence?.imagen?.fecha?.slice(0, 10) ?? null };
  }
  return null;
}

const fmtFecha = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });

const COLOR = { standing: "#6CC58A", review: "#E2B04A", cleared: "#E58A66", closed: "#A3A89C", none: "#A3A89C" };

const EOX_URL = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg";
const EOX_ATTR =
  '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless 2023</a> · EOX IT Services · contiene datos Copernicus Sentinel modificados';

/**
 * Dibuja el mapa en `el`. `parcels`: las del store (con name, status, id).
 * Devuelve la instancia para poder destruirla al repintar.
 */
export function drawMap(el, parcels, { onSelect, interactive = true } = {}) {
  const map = L.map(el, {
    zoomControl: interactive,
    scrollWheelZoom: false,
    dragging: interactive,
    attributionControl: true,
  });
  L.tileLayer(EOX_URL, { attribution: EOX_ATTR, maxZoom: 16, maxNativeZoom: 15 }).addTo(map);

  const bounds = [];
  const fechas = new Set();
  for (const p of parcels) {
    const letter = p.name.replace("Parcela ", "");
    const f = geo[letter];
    if (!f) continue;
    const key = STATUS_KEY[p.status] || "none";
    // El fondo es de 2023: adentro de la parcela va la imagen real del último informe,
    // así se ve cómo está hoy (B talada, A en pie).
    const img = latestImage(letter);
    if (img && IMG_BOUNDS[letter]) {
      L.imageOverlay(img.rgb, IMG_BOUNDS[letter], {
        alt: `${p.name}: imagen Sentinel-2 del ${img.fecha ?? img.month}`,
        className: "map-parcel-img",
      }).addTo(map);
      if (img.fecha) fechas.add(img.fecha);
    }
    const layer = L.geoJSON(f, {
      style: { color: COLOR[key], weight: 2.5, fillColor: COLOR[key], fillOpacity: img ? 0 : 0.12 },
    }).addTo(map);
    layer.bindTooltip(
      `<span class="maptag maptag-${key}"><b>${esc(p.name)}</b> · ${esc(STATUS[p.status]).toLowerCase()}</span>`,
      { permanent: true, direction: "top", className: "maptip", offset: [0, -4] },
    );
    if (onSelect) layer.on("click", () => onSelect(p));
    bounds.push(layer.getBounds());
  }
  if (fechas.size) {
    const note = L.control({ position: "topleft" });
    note.onAdd = () => {
      const d = L.DomUtil.create("div", "map-note");
      const f = [...fechas].sort().map(fmtFecha).join(", ");
      d.innerHTML = `Parcelas: imagen real del ${esc(f)} · fondo: 2023`;
      return d;
    };
    note.addTo(map);
  }
  if (bounds.length) {
    const all = bounds.reduce((a, b) => a.extend(b), L.latLngBounds(bounds[0].getSouthWest(), bounds[0].getNorthEast()));
    map.fitBounds(all, { padding: [48, 48] });
  } else {
    map.setView([-22.45, -62.12], 12);
  }
  return map;
}
