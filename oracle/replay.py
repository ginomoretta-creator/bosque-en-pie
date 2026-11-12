"""Repite 2025 en un minuto (#21): envía en orden los informes mensuales de una parcela.

Saltea los meses que el contrato ya aplicó (según la fecha del último informe de la parcela),
así que se puede cortar y volver a correr sin duplicar. Para B se ve: pagos, revisión y corte;
los meses posteriores al corte no se envían.

Uso:
    python -m oracle.replay B --red localhost
    python -m oracle.replay A --red fuji --pausa 2      # pausa en segundos, para el video
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

from oracle.red import ESTADOS, RAIZ, Red, conectar
from oracle.relay import enviar_informe, leer_informe, linea


def meses(informes: Path, parcela: str) -> list[Path]:
    carpeta = informes / parcela
    if not carpeta.is_dir():
        raise FileNotFoundError(f"no hay informes en {carpeta}")
    return sorted(c for c in carpeta.iterdir() if (c / "report.json").exists())


def repetir(red: Red, parcela: str, informes: Path | None = None, pausa: float = 0, mostrar=print) -> list[dict]:
    pid = red.parcela_id(parcela)
    enviados = []
    for carpeta in meses(informes or RAIZ / "reports", parcela):
        inf = leer_informe(carpeta)
        p = red.contrato.functions.getParcel(pid).call()
        estado, ultima = p[8], p[7]
        if estado not in (1, 2):
            mostrar(f"{parcela} quedó {ESTADOS[estado]}: no se envían más informes")
            break
        if ultima and inf.t_obs <= ultima:
            mostrar(f"{parcela} {inf.mes} · ya estaba aplicado, se saltea")
            continue
        r = enviar_informe(red, carpeta)
        enviados.append(r)
        mostrar(linea(r))
        if pausa:
            time.sleep(pausa)
    return enviados


def main():
    ap = argparse.ArgumentParser(description="Envía en orden los informes de una parcela")
    ap.add_argument("parcela", choices=["A", "B"])
    ap.add_argument("--red", default="localhost", choices=["localhost", "fuji"])
    ap.add_argument("--informes", type=Path, default=None, help="carpeta de informes (por defecto reports/)")
    ap.add_argument("--pausa", type=float, default=0, help="segundos entre informes")
    a = ap.parse_args()
    repetir(conectar(a.red), a.parcela, a.informes, a.pausa)


if __name__ == "__main__":
    main()
