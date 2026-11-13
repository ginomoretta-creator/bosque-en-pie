"""Contrato: cada mes se usa la imagen utilizable más cercana a la fecha fijada (día 15),
no la más limpia del mes. Así una imagen limpia de fin de mes no deja al mes siguiente
sin imágenes por la regla de 20 días entre informes (lo que pasó en marzo de 2025)."""
from datetime import datetime, timezone

from oracle.s2 import Scene, pick_scene


def escena(dia: int, nubes: float, mes: int = 3) -> Scene:
    return Scene(item_id=f"S2B_20KNA_2025{mes:02d}{dia:02d}_0_L2A",
                 datetime=datetime(2025, mes, dia, 14, 28, tzinfo=timezone.utc),
                 tile="20KNA", cloud_cover=nubes, crs=None, hrefs={}, bands={},
                 boa_offset_applied=True, processing_baseline="05.11")


OBJETIVO = datetime(2025, 3, 15, tzinfo=timezone.utc)


def test_elige_la_utilizable_mas_cercana_a_la_fecha_aunque_otra_este_mas_limpia():
    cands = [(escena(4, 0.4), 1.0), (escena(12, 20.0), 0.80), (escena(27, 1.0), 0.99)]
    s, frac = pick_scene(cands, target=OBJETIVO)
    assert s.datetime.day == 12 and frac == 0.80


def test_no_usa_una_imagen_con_poca_parte_visible_aunque_este_en_la_fecha():
    cands = [(escena(15, 90.0), 0.40), (escena(7, 6.4), 0.95)]
    s, _ = pick_scene(cands, target=OBJETIVO)
    assert s.datetime.day == 7


def test_a_igual_distancia_gana_la_mas_visible():
    cands = [(escena(10, 5.0), 0.70), (escena(20, 5.0), 0.90)]
    s, _ = pick_scene(cands, target=OBJETIVO)
    assert s.datetime.day == 20


def test_si_ninguna_alcanza_el_minimo_devuelve_la_mas_visible_para_dejar_el_motivo():
    cands = [(escena(17, 91.0), 0.45), (escena(27, 65.0), 0.54)]
    s, frac = pick_scene(cands, target=OBJETIVO)
    assert s.datetime.day == 27 and frac == 0.54


def test_sin_fecha_fijada_sigue_eligiendo_la_mas_visible():
    cands = [(escena(4, 0.4), 0.99), (escena(12, 0.0), 0.80)]
    s, _ = pick_scene(cands)
    assert s.datetime.day == 4


def test_sin_candidatas_no_hay_imagen():
    assert pick_scene([], target=OBJETIVO) is None
