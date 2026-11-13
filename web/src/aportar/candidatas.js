// Parcelas candidatas (parcels/candidatas.geojson, de oracle/candidatas.py): celdas de 100 ha alrededor
// de A y B donde el monte sigue en pie según bosque-v1 y ESA WorldCover. NO están en el contrato.
// Con poco zoom se ve la zona pintada (monte hoy en verde, desmonte reciente en rojo); al acercarse,
// el monte se divide en las celdas que se podrían registrar.
import L from "leaflet";
import { esc, int } from "../format.js";
import raw from "../../../parcels/candidatas.geojson?raw";
import zonaUrl from "../../../parcels/zona-chaco.png?url";

export const candidatas = (() => {
  try {
    return JSON.parse(raw);
  } catch {
    return { meta: null, features: [] };
  }
})();

const SHOW_CELLS_AT = 13; // zoom desde el que la zona se divide en parcelas

const fecha = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";

const mes = (iso) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { month: "short", year: "numeric", timeZone: "UTC" }) : "";

export function candidateInfo(f) {
  const p = f.properties;
  const m = candidatas.meta;
  return `
    <div class="card-h"><b class="pick-n">Candidata ${esc(p.id)}</b><span class="chip chip-cand">Sin registrar</span></div>
    <p class="muted">${int(p.hectareas)} ha · Chaco salteño · a pocos km de las Parcelas A y B</p>
    <dl class="pick-rows">
      <div><dt>Monte en pie hoy</dt><dd>${int(p.hectareas_monte)} ha <span class="muted">(${String(p.monte_pct).replace(".", ",")} % de la celda)</span></dd></div>
      <div><dt>Si se registra, cada cuota pagada</dt><dd>${int(p.certificados_por_cuota)} certificados <span class="muted">(1 por hectárea en pie)</span></dd></div>
      <div><dt>Carbono que sigue en pie</dt><dd>≈ ${int(p.tco2e)} t CO₂e <span class="tag-sim">SIMULACIÓN · no validado</span></dd></div>
      <div><dt>Verificada con bosque-v1</dt><dd>Imagen del ${esc(fecha(m?.imagen?.fecha))} contra la del ${esc(fecha(m?.imagen_base?.fecha))}: sin desmonte</dd></div>
    </dl>
    <p class="notice-mini">Todavía no está en el contrato: no recibe aportes. El curador la registra con su dueño, su operador y su cuota; desde ahí, se paga igual que la Parcela A.</p>`;
}

/**
 * Suma al mapa la zona pintada y las celdas candidatas. `onPick(feature)` al pasar el mouse o tocar una.
 * Devuelve los límites de la zona, para encuadrar.
 */
export function addCandidates(map, { onPick } = {}) {
  const m = candidatas.meta;
  if (!m?.zona_bounds) return null;
  const zone = L.imageOverlay(zonaUrl, m.zona_bounds, {
    className: "zona-img",
    alt: "Monte en pie y desmontes recientes en la zona",
    opacity: 0.85,
  }).addTo(map);
  zone.bringToBack(); // debajo de las imágenes reales de A y B

  const base = { color: "#F4F2EC", weight: 1, dashArray: "3 3", fillColor: "#6CC58A", fillOpacity: 0.08 };
  const hot = { color: "#FFFFFF", weight: 2.5, dashArray: null, fillColor: "#6CC58A", fillOpacity: 0.35 };
  let current = null;
  const cells = L.geoJSON(candidatas, {
    style: () => base,
    onEachFeature: (f, layer) => {
      const pick = () => {
        current?.setStyle(base);
        layer.setStyle(hot);
        current = layer;
        onPick?.(f);
      };
      layer.on("mouseover", pick);
      layer.on("click", pick);
      layer.bindTooltip(`${esc(f.properties.id)} · ${int(f.properties.hectareas_monte)} ha`, { direction: "top", className: "celltip" });
    },
  });

  const sync = () => {
    const near = map.getZoom() >= SHOW_CELLS_AT;
    if (near && !map.hasLayer(cells)) cells.addTo(map);
    if (!near && map.hasLayer(cells)) map.removeLayer(cells);
    zone.setOpacity(near ? 0.35 : 0.85);
    // las parcelas registradas siempre arriba de las candidatas
    map.eachLayer((l) => l.options?.registered && l.bringToFront?.());
  };
  map.on("zoomend", sync);
  sync();

  const legend = L.control({ position: "topright" });
  legend.onAdd = () => {
    const d = L.DomUtil.create("div", "map-legend");
    d.innerHTML = `<span><i class="lg lg-monte"></i>monte hoy</span><span><i class="lg lg-corte"></i>monte perdido ${esc(mes(m.imagen_base?.fecha))} → ${esc(mes(m.imagen?.fecha))}</span><span><i class="lg lg-cand"></i>candidatas de 100 ha (acercate)</span>`;
    return d;
  };
  legend.addTo(map);
  return L.latLngBounds(m.zona_bounds);
}
