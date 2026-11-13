"""Conexión al contrato desplegado: lee deployments/<red>.json y el ABI exportado (ver #38)."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

RAIZ = Path(__file__).resolve().parents[1]
load_dotenv(RAIZ / ".env")

ESTADOS = {0: "sin registrar", 1: "en pie", 2: "en revisión", 3: "desmontada", 4: "cerrada"}
EXPLORADOR_FUJI = "https://testnet.snowtrace.io"


def rpc_de(red: str) -> str:
    if red == "fuji":
        return os.environ.get("FUJI_RPC_URL", "https://avalanche-fuji-c-chain-rpc.publicnode.com")
    if red == "localhost":
        return os.environ.get("LOCAL_RPC_URL", "http://127.0.0.1:8545")
    raise ValueError(f"red desconocida: {red} (usá localhost o fuji)")


@dataclass
class Red:
    nombre: str
    w3: Web3
    contrato: object          # web3 Contract
    despliegue: dict

    @property
    def chain_id(self) -> int:
        return int(self.despliegue["chainId"])

    def parcela_id(self, nombre: str) -> int:
        for p in self.despliegue.get("parcels", []):
            if p["name"] == nombre:
                return int(p["id"])
        raise KeyError(f"la parcela {nombre} no está registrada en deployments/{self.nombre}.json")

    def link_tx(self, tx: str) -> str | None:
        return f"{EXPLORADOR_FUJI}/tx/{tx}" if self.chain_id == 43113 else None


def conectar(red: str, despliegues: Path | None = None, rpc: str | None = None) -> Red:
    carpeta = despliegues or RAIZ / "deployments"
    archivo = carpeta / f"{red}.json"
    if not archivo.exists():
        raise FileNotFoundError(f"no existe {archivo}: primero hay que desplegar (npm run local o npm run fuji:deploy)")
    despliegue = json.loads(archivo.read_text(encoding="utf-8"))
    abi = json.loads((carpeta / "BosqueEnPie.abi.json").read_text(encoding="utf-8"))
    w3 = Web3(Web3.HTTPProvider(rpc or rpc_de(red)))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)  # Avalanche C-Chain
    if not w3.is_connected():
        raise ConnectionError(f"no hay conexión con la red {red} ({rpc or rpc_de(red)})")
    if w3.eth.chain_id != int(despliegue["chainId"]):
        raise ValueError(f"la red responde chainId {w3.eth.chain_id}, pero el despliegue es de {despliegue['chainId']}")
    if not w3.eth.get_code(despliegue["address"]):
        raise ValueError(f"no hay contrato en {despliegue['address']}: ¿se reinició el nodo local? Volvé a correr npm run local")
    contrato = w3.eth.contract(address=Web3.to_checksum_address(despliegue["address"]), abi=abi)
    return Red(red, w3, contrato, despliegue)


def enviar(red: Red, cuenta, llamada, valor: int = 0):
    """Arma, firma y envía una transacción; devuelve el recibo (falla si revierte)."""
    w3 = red.w3
    tx = llamada.build_transaction({
        "from": cuenta.address,
        "value": valor,
        "nonce": w3.eth.get_transaction_count(cuenta.address),
        "gasPrice": w3.eth.gas_price,
        "chainId": red.chain_id,
    })
    tx["gas"] = int(w3.eth.estimate_gas(tx) * 1.2)
    h = w3.eth.send_raw_transaction(cuenta.sign_transaction(tx).raw_transaction)
    recibo = w3.eth.wait_for_transaction_receipt(h, timeout=120)
    if recibo.status != 1:
        raise RuntimeError(f"la transacción {h.hex()} revirtió")
    return recibo
