// Mapa de las parcelas (Leaflet) sobre Sentinel-2 cloudless de EOX.
// Los polígonos salen de parcels/*.geojson y el color, del estado que dice el contrato.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { STATUS, STATUS_KEY } from "./chain.js";
import { esc } from "./format.js";

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
  for (const p of parcels) {
    const letter = p.name.replace("Parcela ", "");
    const f = geo[letter];
    if (!f) continue;
    const key = STATUS_KEY[p.status] || "none";
    const layer = L.geoJSON(f, {
      style: { color: COLOR[key], weight: 2.5, fillColor: COLOR[key], fillOpacity: 0.12 },
    }).addTo(map);
    layer.bindTooltip(
      `<span class="maptag maptag-${key}"><b>${esc(p.name)}</b> · ${esc(STATUS[p.status]).toLowerCase()}</span>`,
      { permanent: true, direction: "top", className: "maptip", offset: [0, -4] },
    );
    if (onSelect) layer.on("click", () => onSelect(p));
    bounds.push(layer.getBounds());
  }
  if (bounds.length) {
    const all = bounds.reduce((a, b) => a.extend(b), L.latLngBounds(bounds[0].getSouthWest(), bounds[0].getNorthEast()));
    map.fitBounds(all, { padding: [48, 48] });
  } else {
    map.setView([-22.45, -62.12], 12);
  }
  return map;
}
