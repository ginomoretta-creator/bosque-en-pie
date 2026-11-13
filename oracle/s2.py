"""Lectura de Sentinel-2 L2A desde Earth Search (sin clave), solo el recorte de cada parcela.

- Busca en `sentinel-2-l2a` las imágenes cuyo contorno contiene la parcela entera.
- Un solo tile MGRS por parcela: la imagen del año base y la del mes comparten la grilla de píxeles.
- Si una imagen fue reprocesada (…_0_L2A y …_1_L2A), se queda con la última versión.
- Lee `red` y `nir` (10 m) y `scl` (20 m) con una ventana alineada a la grilla de 20 m,
  así SCL se duplica 2×2 y cae exacto sobre los píxeles de 10 m.
- Escala y offset salen de `raster:bands` de cada asset (no se fijan en el código).
- Los recortes se guardan en `.cache/s2/` (ignorado por git) para no bajarlos de nuevo.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.features import geometry_mask
from rasterio.windows import Window, from_bounds
from rasterio.windows import transform as window_transform
from shapely.geometry import mapping, shape
from shapely.ops import transform as shp_transform

from oracle.cover import VALID_SCL, to_reflectance

EARTH_SEARCH = "https://earth-search.aws.element84.com/v1"
COLLECTION = "sentinel-2-l2a"
ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "s2"

GDAL_ENV = dict(
    GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
    CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif",
    GDAL_HTTP_MULTIRANGE="YES",
    GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES",
    AWS_NO_SIGN_REQUEST="YES",
    VSI_CACHE="TRUE",
)


# ---------------------------------------------------------------- parcelas

def load_parcel(path: str | Path):
    """Lee un GeoJSON (Feature, FeatureCollection o geometría) en WGS84 y devuelve la geometría shapely."""
    gj = json.loads(Path(path).read_text(encoding="utf-8"))
    if gj.get("type") == "FeatureCollection":
        if len(gj["features"]) != 1:
            raise ValueError("el GeoJSON tiene que tener una sola parcela")
        gj = gj["features"][0]
    geom = shape(gj["geometry"] if gj.get("type") == "Feature" else gj)
    if geom.geom_type not in ("Polygon", "MultiPolygon") or not geom.is_valid:
        raise ValueError("la parcela tiene que ser un polígono válido")
    return geom


def utm_crs_for(geom) -> CRS:
    lon, lat = geom.centroid.x, geom.centroid.y
    zone = int((lon + 180) // 6) + 1
    return CRS.from_epsg((32700 if lat < 0 else 32600) + zone)


def to_crs(geom, crs: CRS):
    t = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    return shp_transform(t.transform, geom)


def hectares(geom) -> float:
    """Superficie en hectáreas, medida en la proyección UTM de la parcela."""
    return to_crs(geom, utm_crs_for(geom)).area / 10_000


# ---------------------------------------------------------------- búsqueda

_ID_RE = re.compile(r"^(S2[ABC])_(\w{5})_(\d{8})_(\d+)_L2A$")


@dataclass
class Scene:
    item_id: str
    datetime: datetime
    tile: str
    cloud_cover: float | None
    crs: CRS
    hrefs: dict
    bands: dict          # {"red": {"scale":…, "offset":…, "nodata":…}, …}
    boa_offset_applied: bool | None
    processing_baseline: str | None
    platform: str | None = None

    @property
    def t_obs(self) -> int:
        return int(self.datetime.timestamp())

    def describe(self) -> dict:
        return {
            "id": self.item_id,
            "fecha": self.datetime.isoformat(),
            "tile": self.tile,
            "nubes_escena": self.cloud_cover,
            "plataforma": self.platform,
            "procesamiento": self.processing_baseline,
            "boa_offset_applied": self.boa_offset_applied,
            "bandas": self.bands,
            "fuente": f"{EARTH_SEARCH}/collections/{COLLECTION}/items/{self.item_id}",
        }


def _scene_from_item(item) -> Scene:
    props = item.properties
    code = props.get("proj:code") or (f"EPSG:{props['proj:epsg']}" if props.get("proj:epsg") else None)
    if code is None:
        code = item.assets["red"].extra_fields.get("proj:code") or f"EPSG:{item.assets['red'].extra_fields['proj:epsg']}"
    bands = {}
    for k in ("red", "nir", "scl"):
        rb = (item.assets[k].extra_fields.get("raster:bands") or [{}])[0]
        bands[k] = {"scale": rb.get("scale", 1.0), "offset": rb.get("offset", 0.0), "nodata": rb.get("nodata", 0)}
        # Earth Search sirve los COG de L2A con el offset BOA (-1000 DN) ya aplicado, aunque raster:bands
        # siga anunciando -0,1 y aunque `earthsearch:boa_offset_applied` a veces diga False (visto en
        # S2B_20KNA_20250222_0_L2A: mismos DN que las imágenes con True, rojo ~430 sobre monte).
        # Restarlo de nuevo da reflectancias negativas y NDVI > 1. Se usa offset 0 y se guarda el del catálogo.
        if k in ("red", "nir"):
            bands[k]["offset_catalogo"] = bands[k]["offset"]
            bands[k]["offset"] = 0.0
    tile = props.get("grid:code") or props.get("s2:mgrs_tile") or item.id.split("_")[1]
    return Scene(
        item_id=item.id,
        datetime=item.datetime.astimezone(timezone.utc),
        tile=str(tile).replace("MGRS-", ""),
        cloud_cover=props.get("eo:cloud_cover"),
        crs=CRS.from_user_input(code),
        hrefs={k: item.assets[k].href for k in ("red", "nir", "scl", "visual") if k in item.assets},
        bands=bands,
        boa_offset_applied=props.get("earthsearch:boa_offset_applied"),
        processing_baseline=props.get("s2:processing_baseline"),
        platform=props.get("platform"),
    )


def search_scenes(geom, start: str, end: str, tile: str | None = None) -> list[Scene]:
    """Imágenes entre `start` y `end` (fechas ISO, inclusive) que contienen la parcela entera."""
    from pystac_client import Client

    cat = Client.open(EARTH_SEARCH)
    search = cat.search(collections=[COLLECTION], intersects=mapping(geom), datetime=f"{start}/{end}", max_items=500)
    best: dict[tuple, tuple[int, object]] = {}
    for item in search.items():
        if not shape(item.geometry).contains(geom):
            continue
        m = _ID_RE.match(item.id)
        key = (m.group(2), m.group(3)) if m else (item.id, "")
        version = int(m.group(4)) if m else 0
        if key not in best or version > best[key][0]:
            best[key] = (version, item)
    scenes = [_scene_from_item(it) for _, it in best.values()]
    if tile:
        scenes = [s for s in scenes if s.tile == tile]
    return sorted(scenes, key=lambda s: s.datetime)


def main_tile(scenes: list[Scene]) -> str | None:
    """Tile con más imágenes (para fijar uno por parcela)."""
    counts: dict[str, int] = {}
    for s in scenes:
        counts[s.tile] = counts.get(s.tile, 0) + 1
    return max(counts, key=counts.get) if counts else None


# ---------------------------------------------------------------- lectura

@dataclass
class Clip:
    scene: Scene
    red_dn: np.ndarray
    nir_dn: np.ndarray
    scl: np.ndarray          # ya llevado a 10 m
    parcel_mask: np.ndarray
    transform: tuple
    extra: dict = field(default_factory=dict)

    @property
    def red(self):
        b = self.scene.bands["red"]
        return to_reflectance(self.red_dn, b["scale"], b["offset"], b["nodata"])

    @property
    def nir(self):
        b = self.scene.bands["nir"]
        return to_reflectance(self.nir_dn, b["scale"], b["offset"], b["nodata"])

    def visible_fraction(self) -> float:
        n = self.parcel_mask.sum()
        return float((self.parcel_mask & np.isin(self.scl, VALID_SCL)).sum() / n) if n else 0.0


def _snapped_scl_window(scl_ds, bounds) -> Window:
    w = from_bounds(*bounds, transform=scl_ds.transform)
    c0, r0 = math.floor(w.col_off), math.floor(w.row_off)
    c1, r1 = math.ceil(w.col_off + w.width), math.ceil(w.row_off + w.height)
    return Window(c0, r0, c1 - c0, r1 - r0)


def _cache_key(scene: Scene, geom, what: str) -> Path:
    h = hashlib.sha1(geom.wkb).hexdigest()[:12]
    return CACHE / f"{scene.item_id}_{h}_{what}.npz"


def read_clip(scene: Scene, geom, scl_only: bool = False) -> Clip:
    """Lee el recorte de la parcela. Con scl_only=True baja solo la banda SCL (para elegir imágenes)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    cache = _cache_key(scene, geom, "scl" if scl_only else "full")
    full_cache = _cache_key(scene, geom, "full")
    if full_cache.exists():
        cache = full_cache
    if cache.exists():
        z = np.load(cache)
        empty = np.zeros_like(z["scl"], dtype="uint16")
        return Clip(scene, z["red"] if "red" in z else empty, z["nir"] if "nir" in z else empty,
                    z["scl"], z["mask"], tuple(z["transform"]))

    poly = to_crs(geom, scene.crs)
    with rasterio.Env(**GDAL_ENV):
        with rasterio.open(scene.hrefs["scl"]) as scl_ds:
            sw = _snapped_scl_window(scl_ds, poly.bounds)
            scl20 = scl_ds.read(1, window=sw)
            t20 = window_transform(sw, scl_ds.transform)
        scl = np.repeat(np.repeat(scl20, 2, axis=0), 2, axis=1)
        w10 = Window(sw.col_off * 2, sw.row_off * 2, sw.width * 2, sw.height * 2)
        red = nir = None
        t10 = None
        if not scl_only:
            with rasterio.open(scene.hrefs["red"]) as red_ds:
                red = red_ds.read(1, window=w10)
                t10 = window_transform(w10, red_ds.transform)
            with rasterio.open(scene.hrefs["nir"]) as nir_ds:
                nir = nir_ds.read(1, window=w10)
                if window_transform(w10, nir_ds.transform) != t10:
                    raise RuntimeError("rojo e infrarrojo no comparten grilla")
            if not np.allclose([t10.c, t10.f], [t20.c, t20.f]):
                raise RuntimeError("la ventana de 10 m no quedó alineada con la de 20 m")
        else:
            t10 = rasterio.Affine(t20.a / 2, t20.b, t20.c, t20.d, t20.e / 2, t20.f)

    mask = geometry_mask([mapping(poly)], out_shape=scl.shape, transform=t10, invert=True)
    tvals = np.array(tuple(t10)[:6])
    if scl_only:
        np.savez_compressed(cache, scl=scl, mask=mask, transform=tvals)
        empty = np.zeros_like(scl, dtype="uint16")
        return Clip(scene, empty, empty, scl, mask, tuple(tvals))
    np.savez_compressed(cache, red=red, nir=nir, scl=scl, mask=mask, transform=tvals)
    return Clip(scene, red, nir, scl, mask, tuple(tvals))


def read_visual(scene: Scene, clip: Clip) -> np.ndarray | None:
    """Color real (asset `visual`, 10 m) sobre la misma ventana del recorte. Devuelve (alto, ancho, 3) uint8."""
    href = scene.hrefs.get("visual")
    if not href:
        return None
    t = rasterio.Affine(*clip.transform)
    h, w = clip.scl.shape
    with rasterio.Env(**GDAL_ENV), rasterio.open(href) as ds:
        col, row = ~ds.transform * (t.c, t.f)
        win = Window(round(col), round(row), w, h)
        arr = ds.read([1, 2, 3], window=win, boundless=True, fill_value=0)
    return np.transpose(arr, (1, 2, 0))


MIN_VISIBLE_FRAC = 0.60   # igual que MIN_VALID_BPS del contrato


def pick_scene(scored: list[tuple[Scene, float]], target: datetime | None = None,
               min_frac: float = MIN_VISIBLE_FRAC) -> tuple[Scene, float] | None:
    """Elige entre imágenes ya medidas (escena, parte visible de la parcela).

    Con `target`: la utilizable (parte visible >= `min_frac`) más cercana a esa fecha; a igual
    distancia, la más visible. Si ninguna es utilizable, la más visible, para que el informe
    deje escrito el motivo. Sin `target`: la más visible (empate: menos nubes en la escena).
    """
    if not scored:
        return None
    most_visible = max(scored, key=lambda c: (c[1], -(c[0].cloud_cover or 0)))
    usable = [c for c in scored if c[1] >= min_frac]
    if target is None or not usable:
        return most_visible
    return min(usable, key=lambda c: (abs((c[0].datetime.date() - target.date()).days), -c[1]))


def best_scene(geom, start: str, end: str, tile: str | None = None,
               min_datetime: datetime | None = None,
               target: datetime | None = None) -> tuple[Scene, float] | None:
    """La imagen de la parcela entre `start` y `end` que usa el informe (ver `pick_scene`).

    `min_datetime` deja afuera las imágenes anteriores (para respetar el minInterval del contrato).
    """
    scenes = search_scenes(geom, start, end, tile)
    if min_datetime is not None:
        scenes = [s for s in scenes if s.datetime >= min_datetime]
    scored = [(s, read_clip(s, geom, scl_only=True).visible_fraction()) for s in scenes]
    return pick_scene(scored, target)
