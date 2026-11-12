"""Firma de informes de Bosque en pie.

El digest tiene que ser idéntico a `BosqueEnPie.reportDigest`:

    keccak256(abi.encode(chainid, contrato, parcelId, tObs, coverBps, validBps, evidenceHash))
    tipos: uint256, address, uint256, uint64, uint16, uint16, bytes32

Cada verificador firma ese digest como mensaje (EIP-191, personal_sign). El contrato recibe
las firmas ordenadas por dirección del firmante, de menor a mayor, y rechaza repetidas.
"""
from __future__ import annotations

import json
from dataclasses import dataclass

from eth_abi import encode
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak, to_checksum_address

DIGEST_TYPES = ["uint256", "address", "uint256", "uint64", "uint16", "uint16", "bytes32"]


@dataclass(frozen=True)
class Report:
    parcel_id: int
    t_obs: int          # fecha de la imagen, segundos Unix
    cover_bps: int      # monte en pie, 0 a 10000
    valid_bps: int      # parte visible de la parcela, 0 a 10000
    evidence_hash: bytes  # keccak256 del JSON de evidencia (32 bytes)

    def __post_init__(self):
        if not (0 <= self.cover_bps <= 10000 and 0 <= self.valid_bps <= 10000):
            raise ValueError("coverBps y validBps van de 0 a 10000")
        if self.t_obs <= 0 or self.t_obs >= 2**64:
            raise ValueError("fecha de imagen fuera de rango")
        if len(self.evidence_hash) != 32:
            raise ValueError("evidenceHash tiene que tener 32 bytes")


def evidence_hash(evidence: dict | bytes | str) -> bytes:
    """keccak256 del JSON de evidencia. Si recibe un dict, lo serializa de forma estable."""
    if isinstance(evidence, dict):
        evidence = json.dumps(evidence, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    if isinstance(evidence, str):
        evidence = evidence.encode("utf-8")
    return keccak(evidence)


def report_digest(chain_id: int, contract: str, report: Report) -> bytes:
    """Mismo valor que `reportDigest` en el contrato."""
    return keccak(encode(DIGEST_TYPES, [
        chain_id,
        to_checksum_address(contract),
        report.parcel_id,
        report.t_obs,
        report.cover_bps,
        report.valid_bps,
        report.evidence_hash,
    ]))


def sign_digest(digest: bytes, private_key: str) -> tuple[str, bytes]:
    """Firma el digest como mensaje EIP-191. Devuelve (dirección, firma de 65 bytes)."""
    signed = Account.sign_message(encode_defunct(primitive=digest), private_key=private_key)
    return Account.from_key(private_key).address, bytes(signed.signature)


def sign_report(chain_id: int, contract: str, report: Report, private_keys: list[str]) -> list[bytes]:
    """Firma con varias claves y devuelve las firmas ordenadas por dirección (como pide el contrato)."""
    digest = report_digest(chain_id, contract, report)
    signed = [sign_digest(digest, k) for k in private_keys]
    addresses = [a.lower() for a, _ in signed]
    if len(set(addresses)) != len(addresses):
        raise ValueError("hay claves repetidas")
    signed.sort(key=lambda pair: int(pair[0], 16))
    return [sig for _, sig in signed]


def recover_signer(digest: bytes, signature: bytes) -> str:
    return Account.recover_message(encode_defunct(primitive=digest), signature=signature)
