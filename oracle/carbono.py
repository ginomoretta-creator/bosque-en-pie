"""Estimación de carbono en pie por parcela. Solo informativa: no va al contrato.

t CO₂e = hectáreas × biomasa aérea (t materia seca/ha) × (1 + raíz/tallo) × 0,47 × 44/12

Factores para el monte chaqueño (bosque seco subtropical de Sudamérica), de la
2019 Refinement to the 2006 IPCC Guidelines, Vol. 4, cap. 4 (Forest Land):

- Biomasa aérea: 115,9 t m.s./ha. Tabla 4.7 (updated), p. 4.23: "Sub-tropical dry
  forests, North and South America, Primary". Incertidumbre: desvío estándar 46,2
  t m.s./ha (rango aproximado 70–162 t/ha), referencia 59 de la tabla.
- Relación raíz/tallo: R = 0,336. Tabla 4.4 (updated), p. 4.19: "Sub-tropical Dry,
  North and South America, Natural, biomasa aérea ≤ 125 t/ha". Incertidumbre ±90 %.
  (Para biomasa aérea > 125 t/ha sería R = 0,352, desvío 0,047.)
- Fracción de carbono de la materia seca: 0,47 (IPCC 2006, Vol. 4, cap. 4, tabla 4.3).

Con estos factores el monte chaqueño da ~266,8 t CO₂e/ha. Es una estimación de
nivel Tier 1: va en la evidencia con la etiqueta "SIMULACIÓN · no validado".
"""
from __future__ import annotations

from dataclasses import dataclass

CARBON_FRACTION = 0.47   # fracción de carbono de la materia seca
CO2_PER_C = 44 / 12      # relación molecular CO₂/C
DEFAULT_FOREST_TYPE = "subtropical_dry_forest"


@dataclass(frozen=True)
class ForestFactors:
    """Factores de un tipo de bosque, con la cita de la fuente."""
    agb_tdm_ha: float          # biomasa aérea, t materia seca/ha
    agb_sd: float              # desvío estándar de la biomasa aérea
    root_shoot: float          # R: raíz/tallo, t raíz m.s. por t tallo m.s.
    fuente: str                # cita exacta (tabla y página)


FACTORS: dict[str, ForestFactors] = {
    # Monte chaqueño = bosque seco subtropical, América del Sur, natural primario.
    "subtropical_dry_forest": ForestFactors(
        agb_tdm_ha=115.9,
        agb_sd=46.2,
        root_shoot=0.336,
        fuente=("IPCC 2019 Refinement, Vol. 4, cap. 4: tabla 4.7 (p. 4.23), bosque seco "
                "subtropical, América del Norte y del Sur, primario, 115,9 t m.s./ha; "
                "tabla 4.4 (p. 4.19), R = 0,336 para biomasa ≤ 125 t/ha"),
    ),
}


def estimate_tco2e(hectares: float, forest_type: str | None = DEFAULT_FOREST_TYPE) -> float:
    """Toneladas de CO₂e en pie en `hectares` de `forest_type`, con factores IPCC Tier 1."""
    f = FACTORS.get(forest_type or DEFAULT_FOREST_TYPE)
    if f is None:
        raise ValueError(f"tipo de bosque sin factores: {forest_type!r} (hay {sorted(FACTORS)})")
    return hectares * f.agb_tdm_ha * (1 + f.root_shoot) * CARBON_FRACTION * CO2_PER_C


def carbono_estimado(hectares: float, forest_type: str | None = DEFAULT_FOREST_TYPE,
                     cover_bps: int | None = None) -> dict:
    """Bloque `carbono_estimado` para la evidencia de un informe, con la etiqueta de simulación.

    `cover_bps` es la parte de la parcela que sigue en pie (en puntos base); si se da,
    la estimación se calcula solo sobre esa superficie.
    """
    forest_type = forest_type or DEFAULT_FOREST_TYPE
    f = FACTORS.get(forest_type)
    if f is None:
        raise ValueError(f"tipo de bosque sin factores: {forest_type!r} (hay {sorted(FACTORS)})")
    en_pie = hectares if cover_bps is None else hectares * cover_bps / 10_000
    return {
        "tco2e": round(estimate_tco2e(en_pie, forest_type), 1),
        "hectareas": hectares,
        "hectareas_en_pie": round(en_pie, 1),
        "tipo_bosque": forest_type,
        "biomasa_aerea_tms_ha": f.agb_tdm_ha,
        "raiz_tallo": f.root_shoot,
        "fuente": f.fuente,
        "etiqueta": "SIMULACIÓN · no validado",
    }
