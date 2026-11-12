"""Prueba de punta a punta: la firma hecha en Python valida en el contrato.

Levanta `npx hardhat node`, despliega BosqueEnPie con tres verificadores cuyas claves solo
existen en Python, firma informes con `oracle/signing.py` y los envía con web3.py.
Requiere haber corrido `npx hardhat compile`.
"""
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

import pytest
from eth_account import Account
from web3 import Web3

from oracle.signing import Report, evidence_hash, report_digest, sign_report

ROOT = Path(__file__).resolve().parents[2]
ARTIFACT = ROOT / "artifacts" / "contracts" / "BosqueEnPie.sol" / "BosqueEnPie.json"
PORT = 8547
DAY = 86400
MNEMONIC = "test test test test test test test test test test test junk"  # cuentas públicas de Hardhat


@pytest.fixture(scope="module")
def w3():
    if not ARTIFACT.exists():
        pytest.skip("falta compilar: npx hardhat compile")
    npx = shutil.which("npx.cmd" if sys.platform == "win32" else "npx")
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
    proc = subprocess.Popen([npx, "hardhat", "node", "--port", str(PORT)], cwd=ROOT,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)
    web3 = Web3(Web3.HTTPProvider(f"http://127.0.0.1:{PORT}"))
    for _ in range(120):
        try:
            if web3.is_connected():
                break
        except Exception:
            pass
        time.sleep(0.5)
    else:
        proc.kill()
        pytest.fail("no arrancó el nodo de Hardhat")
    yield web3
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
    else:
        proc.send_signal(signal.SIGINT)


def hardhat_account(i):
    Account.enable_unaudited_hdwallet_features()
    return Account.from_mnemonic(MNEMONIC, account_path=f"m/44'/60'/0'/0/{i}")


def send(w3, acct, fn, value=0):
    tx = fn.build_transaction({"from": acct.address, "value": value, "nonce": w3.eth.get_transaction_count(acct.address),
                               "gasPrice": w3.eth.gas_price, "chainId": w3.eth.chain_id})
    tx["gas"] = int(w3.eth.estimate_gas(tx) * 1.2)
    h = w3.eth.send_raw_transaction(acct.sign_transaction(tx).raw_transaction)
    rc = w3.eth.wait_for_transaction_receipt(h)
    assert rc.status == 1
    return rc


def advance(w3, seconds):
    w3.provider.make_request("evm_increaseTime", [seconds])
    w3.provider.make_request("evm_mine", [])


def test_firma_de_python_valida_en_el_contrato(w3):
    art = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    curator, donor = hardhat_account(0), hardhat_account(1)
    verifiers = [Account.create() for _ in range(3)]  # claves que solo existen en Python
    owner, operator = Account.create().address, Account.create().address

    factory = w3.eth.contract(abi=art["abi"], bytecode=art["bytecode"])
    rc = send(w3, curator, factory.constructor([v.address for v in verifiers], 2, 0, 20 * DAY, 0, 365 * DAY))
    c = w3.eth.contract(address=rc.contractAddress, abi=art["abi"])
    chain_id = w3.eth.chain_id

    fee = Web3.to_wei(0.1, "ether")
    send(w3, curator, c.functions.registerParcel(owner, operator, fee, 0, 6000, 214, 0))
    send(w3, donor, c.functions.donate(1, 0), value=Web3.to_wei(1, "ether"))

    def submit(cover, signer_keys):
        advance(w3, 30 * DAY)
        t_obs = w3.eth.get_block("latest").timestamp
        r = Report(1, t_obs, cover, 9100, evidence_hash({"parcela": "A", "t": t_obs, "coverBps": cover}))
        # 1) el digest de Python es idéntico al del contrato
        assert report_digest(chain_id, c.address, r) == bytes(
            c.functions.reportDigest(r.parcel_id, r.t_obs, r.cover_bps, r.valid_bps, r.evidence_hash).call())
        sigs = sign_report(chain_id, c.address, r, signer_keys)
        return send(w3, donor, c.functions.submitReport(r.parcel_id, r.t_obs, r.cover_bps, r.valid_bps, r.evidence_hash, sigs))

    # 2) un informe firmado por 2 de 3 en Python paga la cuota (60 % dueño, 40 % operador)
    submit(9930, [verifiers[0].key, verifiers[2].key])
    assert w3.eth.get_balance(owner) == fee * 6000 // 10000
    assert w3.eth.get_balance(operator) == fee - fee * 6000 // 10000

    # 3) dos lecturas malas seguidas, firmadas en Python, cortan los pagos
    submit(7130, [verifiers[0].key, verifiers[1].key])
    submit(3860, [verifiers[1].key, verifiers[2].key])
    parcel = c.functions.getParcel(1).call()
    assert parcel[8] == 3  # Status.Cleared
    assert w3.eth.get_balance(owner) == fee * 6000 // 10000  # el dueño no cobró nada más

    # 4) una firma de una clave que no es verificadora se rechaza
    send(w3, curator, c.functions.registerParcel(owner, operator, fee, 0, 6000, 1, 0))
    advance(w3, 30 * DAY)
    t_obs = w3.eth.get_block("latest").timestamp
    r = Report(2, t_obs, 9900, 9100, evidence_hash("x"))
    sigs = sign_report(chain_id, c.address, r, [verifiers[0].key, Account.create().key])
    with pytest.raises(Exception):
        send(w3, donor, c.functions.submitReport(2, t_obs, 9900, 9100, r.evidence_hash, sigs))
