"""Parcelas candidatas alrededor de A y B: dónde sigue habiendo monte, en celdas de 100 ha.

Para la página de aportar. NO registra nada en el contrato: son propuestas que el curador podría
registrar. Cada celda pasa por el mismo algoritmo bosque-v1 que las parcelas de la demo.

Pasos, para toda la zona (unos 18 × 18 km del tile 20KNA):
1. Árboles según ESA WorldCover 2021 (clase 10), llevado a la grilla de 10 m de Sentinel-2.
2. bosque-v1 entre la imagen actual y la del mismo mes de dos años antes: detecta desmontes recientes
   (los de 2025 incluidos, como el de B).
3. Monte hoy = árbol en WorldCover, monte en la imagen base (NDVI ≥ umbral), monte en la actual,
   dosel cerrado (reflectancia roja actual ≤ 0,08: en lotes raleados se ve el suelo entre los
   árboles) y sin pérdida detectada. Con 0,08 la Parcela A da 95 % de dosel cerrado.
4. Grilla de 1 km × 1 km (100 ha) en UTM 20S. Candidata: ≥ 90 % de la celda con dato válido y
   ≥ 90 % monte hoy, sin pérdida reciente y sin tocar A ni B.

Salidas en parcels/:
- candidatas.geojson: las celdas candidatas, con hectáreas de monte, certificados por cuota
  y carbono estimado (SIMULACIÓN · no validado).
- zona-chaco.png: el monte de hoy (verde) y los desmontes recientes donde WorldCover marcaba
  árboles (rojo; así un lote agrícola cosechado no cuenta como desmonte), en EPSG:4326,
  para pintar la zona con poco zoom; sus límites van en candidatas.geojson.

Uso: python -m oracle.candidatas
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from pyproj import Transformer
from rasterio.crs import CRS
from rasterio.warp import Resampling, reproject
from shapely.geometry import box, mapping, shape

from oracle.carbono import DEFAULT_FOREST_TYPE, estimate_tco2e
from oracle.cover import Thresholds, compute_cover
from oracle.s2 import GDAL_ENV, load_parcel, read_clip, search_scenes

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "parcels"

# Zona: A y B en el centro, ~18 × 18 km.
REGION = box(-62.205, -22.535, -62.030, -22.365)
NOW = ("2026-11-01", "2026-11-03", "S2C_20KNA_20261102_0_L2A")   # la imagen del informe en vivo de A
BASE = ("2024-11-01", "2024-11-30")                                # mismo mes, dos años antes
WORLDCOVER = ("https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
              "ESA_WorldCover_10m_2021_v200_S24W063_Map.tif")
CELL_PX = 100          # 100 px de 10 m = 1 km → 100 ha
MIN_VALID = 0.90
MIN_FOREST = 0.90
MAX_LOST = 0.0
CANOPY_RED_MAX = 0.08  # dosel cerrado: deja afuera raleados y desmontes viejos con árboles sueltos


def _scene(start, end, item_id=None, region=REGION):
    scenes = search_scenes(region, start, end, tile="20KNA")
    if item_id:
        return next(s for s in scenes if s.item_id == item_id)
    best = None
    for s in scenes:
        c = read_clip(s, region, scl_only=True)
        v = c.visible_fraction()
        print(f"  base {s.item_id}: {100 * v:.1f} % visible")
        if best is None or v > best[1]:
            best = (s, v)
    return best[0]


def worldcover_trees(shape_, transform, crs) -> np.ndarray:
    dst = np.zeros(shape_, dtype="uint8")
    with rasterio.Env(**GDAL_ENV), rasterio.open(WORLDCOVER) as ds:
        # Solo la ventana de la zona (con margen), no el tile entero de 3° × 3°.
        win = ds.window(REGION.bounds[0] - 0.01, REGION.bounds[1] - 0.01,
                        REGION.bounds[2] + 0.01, REGION.bounds[3] + 0.01)
        src = ds.read(1, window=win)
        reproject(src, dst, src_transform=ds.window_transform(win), src_crs=ds.crs,
                  dst_transform=transform, dst_crs=crs, resampling=Resampling.nearest)
    return dst == 10


def main() -> None:
    print("Imagen actual y base…")
    now_s = _scene(*NOW)
    base_s = _scene(*BASE)
    now = read_clip(now_s, REGION)
    base = read_clip(base_s, REGION)
    if now.transform != base.transform or now.scl.shape != base.scl.shape:
        raise RuntimeError("la imagen actual y la base no comparten grilla")
    t = rasterio.Affine(*now.transform)
    crs = now_s.crs
    region_mask = now.parcel_mask
    print(f"  actual {now_s.item_id}: {100 * now.visible_fraction():.1f} % visible")
    print(f"  base   {base_s.item_id}: {100 * base.visible_fraction():.1f} % visible")

    th = Thresholds()
    r = compute_cover(now.red, now.nir, now.scl, base.red, base.nir, base.scl, region_mask, th)
    lost = r.loss_mask
    with np.errstate(invalid="ignore", divide="ignore"):
        ndvi_now = (now.nir - now.red) / (now.nir + now.red)
        ndvi_base = (base.nir - base.red) / (base.nir + base.red)
    valid = region_mask & np.isin(now.scl, [4, 5, 6, 7]) & np.isin(base.scl, [4, 5, 6, 7]) \
        & np.isfinite(ndvi_now) & np.isfinite(ndvi_base)
    print("ESA WorldCover 2021…")
    trees = worldcover_trees(now.scl.shape, t, crs)
    with np.errstate(invalid="ignore"):
        canopy = now.red <= CANOPY_RED_MAX
    forest = valid & trees & canopy & (ndvi_base >= th.base_forest_ndvi) & (ndvi_now >= th.base_forest_ndvi) & ~lost

    # Celdas de 1 km alineadas a la grilla de 10 m del recorte.
    to_ll = Transformer.from_crs(crs, 4326, always_xy=True)
    taken = [load_parcel(ROOT / f"parcels/{p}.geojson") for p in "AB"]
    h, w = forest.shape
    feats = []
    for i in range(0, h - CELL_PX + 1, CELL_PX):
        for j in range(0, w - CELL_PX + 1, CELL_PX):
            sl = (slice(i, i + CELL_PX), slice(j, j + CELL_PX))
            n = CELL_PX * CELL_PX
            if not region_mask[sl].all():
                continue
            v = valid[sl].sum() / n
            f = forest[sl].sum() / n
            lo = lost[sl].sum() / n
            if v < MIN_VALID or f < MIN_FOREST or lo > MAX_LOST:
                continue
            corners = [t * (j, i), t * (j + CELL_PX, i), t * (j + CELL_PX, i + CELL_PX), t * (j, i + CELL_PX)]
            ring = [list(map(lambda x: round(x, 6), to_ll.transform(x, y))) for x, y in corners]
            ring.append(ring[0])
            poly = shape({"type": "Polygon", "coordinates": [ring]})
            if any(poly.intersects(p) for p in taken):
                continue
            ha = round(forest[sl].sum() * 0.01, 1)  # 1 px de 10 m = 0,01 ha
            feats.append({
                "type": "Feature",
                "geometry": mapping(poly),
                "properties": {
                    "id": f"C-{i // CELL_PX:02d}{j // CELL_PX:02d}",
                    "hectareas": 100.0,
                    "hectareas_monte": ha,
                    "monte_pct": round(100 * f, 1),
                    "valido_pct": round(100 * v, 1),
                    "certificados_por_cuota": int(round(ha)),
                    "tco2e": round(estimate_tco2e(ha, DEFAULT_FOREST_TYPE), 1),
                },
            })

    # Imagen de la zona en EPSG:4326: verde = monte hoy, rojo = desmonte reciente.
    rgba = np.zeros((4,) + forest.shape, dtype="uint8")
    rgba[:, forest] = np.array([108, 197, 138, 150], dtype="uint8")[:, None]
    lost_any = lost & region_mask & trees  # solo donde había monte: un cultivo cosechado no es un desmonte
    rgba[:, lost_any] = np.array([229, 138, 102, 230], dtype="uint8")[:, None]
    w0, s0, e0, n0 = REGION.bounds
    res = 0.0001  # ~10 m
    W, H = int(math.ceil((e0 - w0) / res)), int(math.ceil((n0 - s0) / res))
    dst_t = rasterio.Affine(res, 0, w0, 0, -res, n0)
    out = np.zeros((4, H, W), dtype="uint8")
    for b in range(4):
        reproject(rgba[b], out[b], src_transform=t, src_crs=crs, dst_transform=dst_t,
                  dst_crs=CRS.from_epsg(4326), resampling=Resampling.nearest)
    Image.fromarray(np.transpose(out, (1, 2, 0)), "RGBA").save(OUT / "zona-chaco.png", optimize=True)

    meta = {
        "descripcion": "Parcelas candidatas de 100 ha con monte en pie. No están registradas en el contrato.",
        "etiqueta_carbono": "SIMULACIÓN · no validado",
        "algoritmo": "bosque-v1",
        "umbrales": th.as_dict(),
        "imagen": now_s.describe(),
        "imagen_base": base_s.describe(),
        "arboles": "ESA WorldCover 2021 v200, clase 10 (cobertura arbórea), CC BY 4.0",
        "criterio": (f"≥ {int(MIN_VALID * 100)} % con dato válido, ≥ {int(MIN_FOREST * 100)} % monte hoy "
                     f"(árbol en WorldCover, NDVI ≥ {th.base_forest_ndvi} en las dos imágenes, rojo ≤ {CANOPY_RED_MAX}), "
                     "sin pérdida reciente, sin tocar A ni B"),
        "zona_png": "zona-chaco.png",
        "atribucion": "Contiene datos Copernicus Sentinel modificados, 2024 y 2026",
        "monte_ha": round(float(forest.sum()) * 0.01, 1),
        "desmonte_reciente_ha": round(float(lost_any.sum()) * 0.01, 1),
    }
    # Límites exactos del PNG: arriba-izquierda (n0, w0), abajo-derecha (n0 - H·res, w0 + W·res).
    meta["zona_bounds"] = [[round(n0 - H * res, 6), round(w0, 6)], [round(n0, 6), round(w0 + W * res, 6)]]
    (OUT / "candidatas.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "meta": meta, "features": feats}, ensure_ascii=False),
        encoding="utf-8")
    print(f"{len(feats)} celdas candidatas · monte {meta['monte_ha']} ha · desmonte reciente {meta['desmonte_reciente_ha']} ha")


if __name__ == "__main__":
    main()
