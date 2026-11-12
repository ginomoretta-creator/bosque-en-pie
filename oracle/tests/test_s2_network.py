"""Prueba contra Earth Search real. Usa internet: correr con `pytest -m network`.

Parcela de prueba: un cuadrado de ~1 km en el Chaco salteño (no es una parcela de la demo).
"""
import pytest
from shapely.geometry import box

from oracle.cover import compute_cover
from oracle.s2 import best_scene, hectares, main_tile, read_clip, search_scenes

pytestmark = pytest.mark.network

TEST_PARCEL = box(-63.735, -25.025, -63.725, -25.015)  # ~1 km × 1,1 km


def test_superficie_en_hectareas():
    ha = hectares(TEST_PARCEL)
    assert 100 < ha < 125


def test_lee_y_calcula_un_mes_real():
    scenes = search_scenes(TEST_PARCEL, "2025-01-01", "2025-01-31")
    assert scenes, "Earth Search no devolvió imágenes"
    tile = main_tile(scenes)
    now = best_scene(TEST_PARCEL, "2025-01-01", "2025-01-31", tile=tile)
    base = best_scene(TEST_PARCEL, "2024-01-01", "2024-01-31", tile=tile)
    assert now and base
    (s_now, vis_now), (s_base, vis_base) = now, base
    assert s_now.tile == s_base.tile == tile

    c_now = read_clip(s_now, TEST_PARCEL)
    c_base = read_clip(s_base, TEST_PARCEL)
    assert c_now.red_dn.shape == c_now.scl.shape == c_base.red_dn.shape
    assert c_now.transform == c_base.transform  # misma grilla de píxeles
    assert c_now.parcel_mask.sum() > 10_000     # ~110 ha a 10 m

    res = compute_cover(c_now.red, c_now.nir, c_now.scl, c_base.red, c_base.nir, c_base.scl, c_now.parcel_mask)
    print(f"\n{s_now.item_id} (visible {vis_now:.0%}) vs {s_base.item_id} (visible {vis_base:.0%})")
    print(res.as_dict())
    assert 0 <= res.valid_bps <= 10000
    assert res.cover_bps is None or 0 <= res.cover_bps <= 10000
