"""Algoritmo bosque-v1: cuánto del monte del año base sigue en pie en la imagen del mes.

Funciones puras sobre matrices numpy (sin red). La lectura de Sentinel-2 está en s2.py.

Pasos (CLAUDE.md):
  1. Píxeles válidos: SCL en {4, 5, 6, 7} (vegetación, suelo desnudo, agua, sin clasificar).
  2. NDVI del mes y NDVI del mismo mes del año base.
  3. Monte del año base: NDVI base ≥ 0,45.
  4. Píxel perdido: era monte, bajó 0,25 o más y quedó en 0,35 o menos.
  5. Limpieza: apertura morfológica 3×3 y descarte de manchas de menos de 100 píxeles (1 ha a 10 m).
  6. coverBps = 10000 × (1 − perdidos / monte base); validBps = 10000 × válidos / total de la parcela.

Decisiones de implementación:
  - validBps sale solo de la imagen del mes.
  - El monte base y los perdidos se cuentan solo sobre píxeles válidos en las dos imágenes:
    un píxel nublado hoy no puede contar como "en pie" ni como "perdido".
  - Si el monte base visible es muy poco (menos de min_base_forest_frac de la parcela),
    no hay lectura confiable: cover_bps queda en None y se explica en `reason`.
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field

import numpy as np
from scipy import ndimage

VERSION = "bosque-v1"
VALID_SCL = (4, 5, 6, 7)


@dataclass(frozen=True)
class Thresholds:
    base_forest_ndvi: float = 0.45   # monte en el año base
    loss_drop: float = 0.25          # caída mínima de NDVI para contar pérdida
    loss_max_ndvi: float = 0.35      # NDVI máximo después de la pérdida
    opening_size: int = 3            # apertura morfológica (lado del cuadrado)
    min_patch_px: int = 100          # mancha mínima: 100 px de 10 m = 1 ha
    min_base_forest_frac: float = 0.05  # monte base visible mínimo, sobre el total de la parcela

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class CoverResult:
    cover_bps: int | None
    valid_bps: int
    parcel_px: int
    valid_px: int
    valid_both_px: int
    base_forest_px: int
    lost_px: int
    reason: str | None = None
    loss_mask: np.ndarray | None = field(default=None, repr=False)

    def as_dict(self) -> dict:
        d = asdict(self)
        d.pop("loss_mask")
        return d


def to_reflectance(dn: np.ndarray, scale: float, offset: float, nodata: int = 0) -> np.ndarray:
    """Pasa números digitales a reflectancia con la escala y el offset de cada asset. nodata → NaN."""
    dn = np.asarray(dn)
    refl = dn.astype("float32") * np.float32(scale) + np.float32(offset)
    refl[dn == nodata] = np.nan
    return refl


def ndvi(red: np.ndarray, nir: np.ndarray) -> np.ndarray:
    """NDVI = (NIR − rojo) / (NIR + rojo). Divisiones inválidas → NaN."""
    red = np.asarray(red, dtype="float32")
    nir = np.asarray(nir, dtype="float32")
    denom = nir + red
    with np.errstate(divide="ignore", invalid="ignore"):
        out = (nir - red) / denom
    out[~np.isfinite(out) | (denom <= 0)] = np.nan
    return out


def valid_scl(scl: np.ndarray) -> np.ndarray:
    return np.isin(np.asarray(scl), VALID_SCL)


def clean_loss(mask: np.ndarray, opening_size: int = 3, min_patch_px: int = 100) -> np.ndarray:
    """Apertura morfológica y descarte de manchas chicas (conectividad de 8 vecinos)."""
    mask = np.asarray(mask, dtype=bool)
    if not mask.any():
        return mask
    opened = ndimage.binary_opening(mask, structure=np.ones((opening_size, opening_size), dtype=bool))
    labels, n = ndimage.label(opened, structure=np.ones((3, 3), dtype=bool))
    if n == 0:
        return opened
    sizes = np.bincount(labels.ravel())
    keep = sizes >= min_patch_px
    keep[0] = False
    return keep[labels]


def _bps(x: float) -> int:
    return max(0, min(10000, math.floor(10000 * x + 0.5)))


def compute_cover(
    red: np.ndarray,
    nir: np.ndarray,
    scl: np.ndarray,
    base_red: np.ndarray,
    base_nir: np.ndarray,
    base_scl: np.ndarray,
    parcel_mask: np.ndarray,
    th: Thresholds = Thresholds(),
) -> CoverResult:
    """Calcula coverBps y validBps de una parcela para un mes.

    Todas las matrices tienen la misma forma y la misma grilla de píxeles. `red`, `nir` y sus
    equivalentes base van en reflectancia (NaN = sin dato). `parcel_mask` es True dentro del polígono.
    """
    shapes = {np.shape(a) for a in (red, nir, scl, base_red, base_nir, base_scl, parcel_mask)}
    if len(shapes) != 1:
        raise ValueError(f"las matrices tienen formas distintas: {shapes}")
    parcel = np.asarray(parcel_mask, dtype=bool)
    parcel_px = int(parcel.sum())
    if parcel_px == 0:
        raise ValueError("la parcela no tiene píxeles")

    ndvi_now = ndvi(red, nir)
    ndvi_base = ndvi(base_red, base_nir)

    valid_now = parcel & valid_scl(scl) & np.isfinite(ndvi_now)
    valid_both = valid_now & valid_scl(base_scl) & np.isfinite(ndvi_base)
    base_forest = valid_both & (ndvi_base >= th.base_forest_ndvi)

    with np.errstate(invalid="ignore"):
        lost_raw = base_forest & ((ndvi_base - ndvi_now) >= th.loss_drop) & (ndvi_now <= th.loss_max_ndvi)
    lost = clean_loss(lost_raw, th.opening_size, th.min_patch_px) & base_forest

    valid_px = int(valid_now.sum())
    base_px = int(base_forest.sum())
    lost_px = int(lost.sum())
    result = CoverResult(
        cover_bps=None,
        valid_bps=_bps(valid_px / parcel_px),
        parcel_px=parcel_px,
        valid_px=valid_px,
        valid_both_px=int(valid_both.sum()),
        base_forest_px=base_px,
        lost_px=lost_px,
        loss_mask=lost,
    )
    if base_px < th.min_base_forest_frac * parcel_px:
        result.reason = (
            f"monte base visible insuficiente: {base_px} px, "
            f"menos del {th.min_base_forest_frac:.0%} de la parcela ({parcel_px} px)"
        )
        return result
    result.cover_bps = _bps(1 - lost_px / base_px)
    return result
