"""Informes de PRUEBA para 2025 (no salen de imágenes satelitales).

Sirven para probar el envío y el replay, y para que la web tenga datos mientras el algoritmo
(#16 a #19) no está listo. Se escriben en `reports-prueba/`, nunca en `reports/`, y cada
evidence.json dice "origen": "prueba". No usar en el video ni en el pitch como si fueran reales.

- A: monte en pie los 12 meses.
- B: en pie de enero a junio, primera lectura mala en julio (en revisión) y segunda en agosto
  (desmontada). Los meses siguientes también quedan escritos, pero el contrato ya no los acepta.

Uso:
    python -m oracle.informes_prueba            # escribe reports-prueba/A y reports-prueba/B
    python -m oracle.replay B --informes reports-prueba
"""
from __future__ import annotations

import argparse
import calendar
import json
from pathlib import Path

from eth_utils import keccak

from oracle.red import RAIZ

# coverBps y validBps por mes (enero a diciembre)
VALORES = {
    "A": [(9962, 9410), (9958, 8870), (9951, 7920), (9949, 9630), (9955, 9810), (9960, 9720),
          (9957, 9880), (9953, 9840), (9948, 9550), (9952, 8610), (9956, 8130), (9959, 7740)],
    "B": [(9931, 9620), (9927, 9150), (9918, 8740), (9922, 9700), (9915, 9790), (9908, 9810),
          (7130, 9860), (3860, 9830), (3790, 9520), (3720, 8900), (3700, 8420), (3690, 8010)],
}


def t_obs(anio: int, mes: int) -> int:
    """Día 15 a las 14:00 UTC (Sentinel-2 pasa por Salta cerca de esa hora)."""
    return calendar.timegm((anio, mes, 15, 14, 0, 0))


def escribir(destino: Path, anio: int = 2025) -> list[Path]:
    carpetas = []
    for parcela, valores in VALORES.items():
        for i, (cover, valid) in enumerate(valores, start=1):
            mes = f"{anio}-{i:02d}"
            carpeta = destino / parcela / mes
            carpeta.mkdir(parents=True, exist_ok=True)
            evidencia = {
                "origen": "prueba",
                "aviso": "Valores de prueba: no salen de una imagen satelital",
                "algoritmo": "bosque-v1",
                "parcela": parcela,
                "mes": mes,
                "coverBps": cover,
                "validBps": valid,
            }
            crudo = (json.dumps(evidencia, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
            (carpeta / "evidence.json").write_bytes(crudo)
            informe = {
                "parcel": parcela, "month": mes, "tObs": t_obs(anio, i),
                "coverBps": cover, "validBps": valid, "evidenceHash": "0x" + keccak(crudo).hex(),
            }
            (carpeta / "report.json").write_text(json.dumps(informe, indent=2) + "\n", encoding="utf-8")
            carpetas.append(carpeta)
    return carpetas


def main():
    ap = argparse.ArgumentParser(description="Escribe informes de prueba de 2025")
    ap.add_argument("--destino", type=Path, default=RAIZ / "reports-prueba")
    a = ap.parse_args()
    n = len(escribir(a.destino))
    print(f"{n} informes de prueba en {a.destino}")


if __name__ == "__main__":
    main()
