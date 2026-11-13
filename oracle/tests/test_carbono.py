"""Pruebas de oracle/carbono.py: factores IPCC, escala por hectárea y etiqueta."""
import pytest

from oracle.carbono import (CARBON_FRACTION, CO2_PER_C, FACTORS, carbono_estimado,
                            estimate_tco2e)

# Valor central del monte chaqueño: 115,9 t m.s./ha × 1,336 × 0,47 × 44/12 ≈ 266,8 t CO₂e/ha.
EXPECTED_PER_HA = 115.9 * 1.336 * 0.47 * 44 / 12


def test_estimacion_por_hectarea():
    assert estimate_tco2e(1) == pytest.approx(EXPECTED_PER_HA)
    assert estimate_tco2e(101) == pytest.approx(101 * EXPECTED_PER_HA)  # parcela A
    assert estimate_tco2e(84) == pytest.approx(84 * EXPECTED_PER_HA)    # parcela B


def test_escala_lineal():
    assert estimate_tco2e(10) == pytest.approx(10 * estimate_tco2e(1))


def test_formula_es_la_documentada():
    f = FACTORS["subtropical_dry_forest"]
    assert estimate_tco2e(2) == pytest.approx(
        2 * f.agb_tdm_ha * (1 + f.root_shoot) * CARBON_FRACTION * CO2_PER_C)


def test_tipo_de_bosque_desconocido():
    with pytest.raises(ValueError, match="tipo de bosque"):
        estimate_tco2e(1, "selva_valdiviana")


def test_none_cae_al_bosque_por_defecto():
    assert estimate_tco2e(1, None) == pytest.approx(EXPECTED_PER_HA)
    assert carbono_estimado(1, None)["tipo_bosque"] == "subtropical_dry_forest"


def test_solo_la_parte_en_pie():
    c = carbono_estimado(84, cover_bps=144)  # B en 2025-09: 1,44 % en pie
    assert c["hectareas_en_pie"] == pytest.approx(84 * 144 / 10_000, abs=0.05)
    assert c["tco2e"] == pytest.approx(84 * 144 / 10_000 * EXPECTED_PER_HA, abs=0.05)


def test_bloque_de_evidencia():
    c = carbono_estimado(101)
    assert c["tco2e"] == pytest.approx(101 * EXPECTED_PER_HA, abs=0.05)
    assert c["hectareas"] == 101
    assert c["etiqueta"] == "SIMULACIÓN · no validado"
    assert "IPCC" in c["fuente"]
