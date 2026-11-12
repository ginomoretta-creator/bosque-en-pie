"""Prueba de #20 y #21: el envío y el replay funcionan contra un nodo local de Hardhat.

Contratos que protege:
- B: paga de enero a junio, julio la deja en revisión sin pagar, agosto la corta y los meses
  siguientes no se envían. El dueño y el operador cobran exactamente 6 cuotas (60/40).
- A: paga 12 cuotas.
- Volver a correr el replay no envía nada (no duplica pagos).
- Un evidence.json alterado se rechaza antes de enviar.
- Tras el corte, la empresa recupera su parte de devolución.
Requiere `npx hardhat compile`.
"""
import json
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

import pytest
from web3 import Web3

from oracle.cuentas import cuenta
from oracle.informes_prueba import escribir
from oracle.red import conectar, enviar
from oracle.relay import enviar_informe
from oracle.replay import repetir

RAIZ = Path(__file__).resolve().parents[2]
ARTEFACTO = RAIZ / "artifacts" / "contracts" / "BosqueEnPie.sol" / "BosqueEnPie.json"
PUERTO = 8549
DIA = 86400
CUOTA = Web3.to_wei(0.01, "ether")


@pytest.fixture(scope="module")
def nodo():
    if not ARTEFACTO.exists():
        pytest.skip("falta compilar: npx hardhat compile")
    npx = shutil.which("npx.cmd" if sys.platform == "win32" else "npx")
    flags = subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
    proc = subprocess.Popen([npx, "hardhat", "node", "--port", str(PUERTO)], cwd=RAIZ,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)
    w3 = Web3(Web3.HTTPProvider(f"http://127.0.0.1:{PUERTO}"))
    for _ in range(120):
        try:
            if w3.is_connected():
                break
        except Exception:
            pass
        time.sleep(0.5)
    else:
        proc.kill()
        pytest.fail("no arrancó el nodo de Hardhat")
    yield w3
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
    else:
        proc.send_signal(signal.SIGINT)


@pytest.fixture(scope="module")
def red(nodo, tmp_path_factory):
    """Despliega como lo hace npm run local y deja deployments/localhost.json en una carpeta temporal."""
    art = json.loads(ARTEFACTO.read_text(encoding="utf-8"))
    curador = cuenta("CURATOR", "localhost")
    verificadores = [cuenta(f"VERIFIER_{i}", "localhost").address for i in (1, 2, 3)]
    fabrica = nodo.eth.contract(abi=art["abi"], bytecode=art["bytecode"])

    def tx(acct, llamada, valor=0):
        t = llamada.build_transaction({"from": acct.address, "value": valor, "nonce": nodo.eth.get_transaction_count(acct.address),
                                       "gasPrice": nodo.eth.gas_price, "chainId": nodo.eth.chain_id})
        t["gas"] = int(nodo.eth.estimate_gas(t) * 1.2)
        return nodo.eth.wait_for_transaction_receipt(nodo.eth.send_raw_transaction(acct.sign_transaction(t).raw_transaction))

    rc = tx(curador, fabrica.constructor(verificadores, 2, 0, 20 * DIA, 0, 365 * DIA))
    c = nodo.eth.contract(address=rc.contractAddress, abi=art["abi"])
    for p in ("A", "B"):
        tx(curador, c.functions.registerParcel(cuenta(f"OWNER_{p}", "localhost").address,
                                               cuenta(f"OPERATOR_{p}", "localhost").address, CUOTA, 0, 6000, 100, 0))
    empresa = cuenta("EMPRESA", "localhost")
    tx(empresa, c.functions.donate(1, 0), Web3.to_wei(0.12, "ether"))
    tx(empresa, c.functions.donate(2, 0), Web3.to_wei(0.06, "ether"))
    tx(empresa, c.functions.donate(2, 1), Web3.to_wei(0.06, "ether"))

    carpeta = tmp_path_factory.mktemp("deployments")
    (carpeta / "BosqueEnPie.abi.json").write_text(json.dumps(art["abi"]), encoding="utf-8")
    (carpeta / "localhost.json").write_text(json.dumps({
        "network": "localhost", "chainId": nodo.eth.chain_id, "address": rc.contractAddress,
        "parcels": [{"id": 1, "name": "A"}, {"id": 2, "name": "B"}],
    }), encoding="utf-8")
    return conectar("localhost", despliegues=carpeta, rpc=f"http://127.0.0.1:{PUERTO}")


@pytest.fixture(scope="module")
def informes(tmp_path_factory):
    destino = tmp_path_factory.mktemp("reports")
    escribir(destino)
    return destino


def saldo(red, nombre):
    return red.w3.eth.get_balance(cuenta(nombre, "localhost").address)


def test_un_evidence_alterado_se_rechaza_antes_de_enviar(red, informes, tmp_path):
    copia = tmp_path / "B" / "2025-01"
    shutil.copytree(informes / "B" / "2025-01", copia)
    (copia / "evidence.json").write_text('{"coverBps": 9999}', encoding="utf-8")
    with pytest.raises(ValueError, match="no coincide"):
        enviar_informe(red, copia)


def test_replay_de_B_paga_seis_cuotas_y_corta_en_agosto(red, informes):
    dueno0, operador0 = saldo(red, "OWNER_B"), saldo(red, "OPERATOR_B")
    enviados = repetir(red, "B", informes, mostrar=lambda _: None)

    assert [r["month"] for r in enviados] == [f"2025-{m:02d}" for m in range(1, 9)]
    assert [r["estado"] for r in enviados[5:]] == ["en pie", "en revisión", "desmontada"]
    assert all(int(r["pagadoWei"]) == CUOTA for r in enviados[:6])
    assert all(int(r["pagadoWei"]) == 0 for r in enviados[6:])
    assert saldo(red, "OWNER_B") - dueno0 == 6 * CUOTA * 6000 // 10000
    assert saldo(red, "OPERATOR_B") - operador0 == 6 * (CUOTA - CUOTA * 6000 // 10000)
    assert (informes / "B" / "2025-08" / "envio-localhost.json").exists()
    assert not (informes / "B" / "2025-09" / "envio-localhost.json").exists()


def test_replay_de_A_paga_doce_cuotas(red, informes):
    enviados = repetir(red, "A", informes, mostrar=lambda _: None)
    assert len(enviados) == 12
    assert all(r["estado"] == "en pie" and int(r["pagadoWei"]) == CUOTA for r in enviados)


def test_volver_a_correr_el_replay_no_duplica(red, informes):
    assert repetir(red, "A", informes, mostrar=lambda _: None) == []
    assert repetir(red, "B", informes, mostrar=lambda _: None) == []


def test_tras_el_corte_la_empresa_recupera_su_devolucion(red):
    empresa = cuenta("EMPRESA", "localhost")
    rc = enviar(red, empresa, red.contrato.functions.withdrawRefund(2))
    retiro = red.contrato.events.Withdrawn().process_receipt(rc)[0]["args"]
    assert retiro["kind"] == 0 and retiro["amount"] > 0
