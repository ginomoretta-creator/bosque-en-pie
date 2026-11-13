"""Cuentas de la demo (mismo reparto que scripts/cuentas.js: si cambiás uno, cambiá el otro).

- En Fuji salen del .env (<NOMBRE>_PRIVATE_KEY): claves de prueba que maneja el equipo.
- En la red local salen siempre de las cuentas públicas de Hardhat (el .env es para Fuji).
"""
from __future__ import annotations

import os

from eth_account import Account
from eth_account.signers.local import LocalAccount

MNEMONIC = "test test test test test test test test test test test junk"  # pública, sin valor
INDICE_LOCAL = {
    "CURATOR": 0, "RELAYER": 1, "VERIFIER_1": 2, "VERIFIER_2": 3, "VERIFIER_3": 4,
    "OWNER_A": 5, "OPERATOR_A": 6, "OWNER_B": 7, "OPERATOR_B": 8, "EMPRESA": 9,
    "BILLETERA_1": 10, "BILLETERA_2": 11, "BILLETERA_3": 12, "BILLETERA_4": 13, "BILLETERA_5": 14,
}
VERIFICADORES = ["VERIFIER_1", "VERIFIER_2", "VERIFIER_3"]


def es_local(red: str) -> bool:
    return red in ("localhost", "hardhat")


def cuenta(nombre: str, red: str) -> LocalAccount:
    # En la red local siempre las cuentas públicas de Hardhat: las claves del .env son de Fuji
    # y no tienen saldo en el nodo local (si se usaran, fallaría todo lo local a quien tenga .env).
    if es_local(red) and nombre in INDICE_LOCAL:
        Account.enable_unaudited_hdwallet_features()
        return Account.from_mnemonic(MNEMONIC, account_path=f"m/44'/60'/0'/0/{INDICE_LOCAL[nombre]}")
    clave = os.environ.get(f"{nombre}_PRIVATE_KEY")
    if clave:
        return Account.from_key(clave)
    raise RuntimeError(f"Falta {nombre}_PRIVATE_KEY en .env")
