"""Envía un informe mensual al contrato (#20).

Lee la carpeta de un informe (`reports/<A|B>/<AAAA-MM>/`, formato en #38):
  - report.json   → parcel, month, tObs, coverBps, validBps, evidenceHash (lo arma make_report.py)
  - evidence.json → si está, se comprueba que su keccak256 sea evidenceHash

Firma el informe con los verificadores **para la red de destino** (el digest incluye chainId y
dirección del contrato, así que una firma de la red local no sirve en Fuji), lo envía desde el
relayer y deja `envio-<red>.json` en la misma carpeta con la transacción y el resultado.

Uso:
    python -m oracle.relay reports/B/2025-03 --red localhost
    python -m oracle.relay reports/B/2025-03 --red fuji
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

from eth_utils import keccak
from web3.logs import DISCARD

from oracle.cuentas import VERIFICADORES, cuenta
from oracle.red import ESTADOS, Red, conectar, enviar
from oracle.signing import Report, sign_report


@dataclass
class Informe:
    carpeta: Path
    parcela: str
    mes: str
    t_obs: int
    cover_bps: int
    valid_bps: int
    evidence_hash: bytes


def leer_informe(carpeta: Path) -> Informe:
    carpeta = Path(carpeta)
    datos = json.loads((carpeta / "report.json").read_text(encoding="utf-8"))
    h = bytes.fromhex(datos["evidenceHash"].removeprefix("0x"))
    evidencia = carpeta / "evidence.json"
    if evidencia.exists() and keccak(evidencia.read_bytes()) != h:
        raise ValueError(f"{carpeta}: evidence.json no coincide con evidenceHash (¿se editó después de armar el informe?)")
    return Informe(carpeta, datos["parcel"], datos["month"], int(datos["tObs"]),
                   int(datos["coverBps"]), int(datos["validBps"]), h)


def firmar(red: Red, parcela_id: int, inf: Informe) -> list[bytes]:
    quorum = red.contrato.functions.quorum().call()
    claves, faltan = [], []
    for nombre in VERIFICADORES:
        try:
            claves.append(cuenta(nombre, red.nombre).key)
        except RuntimeError:
            faltan.append(nombre)
    if len(claves) < quorum:
        raise RuntimeError(f"hacen falta {quorum} verificadores y faltan las claves de {', '.join(faltan)} en .env")
    r = Report(parcela_id, inf.t_obs, inf.cover_bps, inf.valid_bps, inf.evidence_hash)
    return sign_report(red.chain_id, red.contrato.address, r, claves)


def enviar_informe(red: Red, carpeta: Path) -> dict:
    inf = leer_informe(carpeta)
    pid = red.parcela_id(inf.parcela)
    p = red.contrato.functions.getParcel(pid).call()
    estado, ultima = p[8], p[7]
    if estado not in (1, 2):
        raise RuntimeError(f"la parcela {inf.parcela} está {ESTADOS[estado]}: no recibe más informes")
    minimo = red.contrato.functions.minInterval().call()
    if ultima and inf.t_obs < ultima + minimo:
        raise RuntimeError(
            f"{inf.parcela} {inf.mes}: la imagen es de {inf.t_obs - ultima} s después de la anterior y el contrato pide "
            f"al menos {minimo} s ({minimo // 86400} días). Elegí otra imagen del mes.")

    firmas = firmar(red, pid, inf)
    relayer = cuenta("RELAYER", red.nombre)
    recibo = enviar(red, relayer, red.contrato.functions.submitReport(
        pid, inf.t_obs, inf.cover_bps, inf.valid_bps, inf.evidence_hash, firmas))

    aplicado = red.contrato.events.ReportApplied().process_receipt(recibo, errors=DISCARD)
    pagado = aplicado[0]["args"]["paid"] if aplicado else 0
    estado = red.contrato.functions.getParcel(pid).call()[8]
    tx = "0x" + recibo.transactionHash.hex().removeprefix("0x")
    resultado = {
        "network": red.nombre, "chainId": red.chain_id, "contract": red.contrato.address,
        "parcel": inf.parcela, "parcelId": pid, "month": inf.mes,
        "tx": tx, "block": recibo.blockNumber, "firmas": len(firmas),
        "aplicado": bool(aplicado), "pagadoWei": str(pagado), "estado": ESTADOS[estado],
        "explorer": red.link_tx(tx),
    }
    (inf.carpeta / f"envio-{red.nombre}.json").write_text(json.dumps(resultado, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return resultado


def linea(r: dict) -> str:
    pago = int(r["pagadoWei"]) / 1e18
    txt = f"{r['parcel']} {r['month']} · pagó {pago:g} AVAX · queda {r['estado']}"
    return txt + (f" · {r['explorer']}" if r["explorer"] else f" · tx {r['tx']}")


def main():
    ap = argparse.ArgumentParser(description="Envía un informe firmado a BosqueEnPie")
    ap.add_argument("carpeta", type=Path, help="carpeta del informe, por ejemplo reports/B/2025-03")
    ap.add_argument("--red", default="localhost", choices=["localhost", "fuji"])
    a = ap.parse_args()
    print(linea(enviar_informe(conectar(a.red), a.carpeta)))


if __name__ == "__main__":
    main()
