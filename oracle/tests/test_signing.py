"""Pruebas unitarias de oracle/signing.py (sin red)."""
import pytest
from eth_account import Account

from oracle.signing import Report, evidence_hash, recover_signer, report_digest, sign_report

CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
EVID = evidence_hash({"algoritmo": "bosque-v1", "coverBps": 9930})


def make_report(**kw):
    base = dict(parcel_id=1, t_obs=1_735_689_600, cover_bps=9930, valid_bps=9100, evidence_hash=EVID)
    base.update(kw)
    return Report(**base)


def test_evidence_hash_es_estable_ante_el_orden_de_claves():
    assert evidence_hash({"a": 1, "b": 2}) == evidence_hash({"b": 2, "a": 1})
    assert len(EVID) == 32


def test_el_digest_cambia_si_cambia_cualquier_campo():
    r = make_report()
    d = report_digest(43113, CONTRACT, r)
    assert d != report_digest(31337, CONTRACT, r)
    assert d != report_digest(43113, "0x" + "11" * 20, r)
    for change in [dict(parcel_id=2), dict(t_obs=r.t_obs + 1), dict(cover_bps=9929), dict(valid_bps=9099),
                   dict(evidence_hash=evidence_hash("otra"))]:
        assert d != report_digest(43113, CONTRACT, make_report(**change))


def test_las_firmas_salen_ordenadas_por_direccion_y_se_recuperan():
    keys = [Account.create().key.hex() for _ in range(3)]
    r = make_report()
    sigs = sign_report(43113, CONTRACT, r, keys)
    digest = report_digest(43113, CONTRACT, r)
    signers = [recover_signer(digest, s) for s in sigs]
    assert [int(a, 16) for a in signers] == sorted(int(a, 16) for a in signers)
    assert {a.lower() for a in signers} == {Account.from_key(k).address.lower() for k in keys}
    assert all(len(s) == 65 for s in sigs)


def test_rechaza_claves_repetidas_y_valores_fuera_de_rango():
    k = Account.create().key.hex()
    with pytest.raises(ValueError):
        sign_report(43113, CONTRACT, make_report(), [k, k])
    with pytest.raises(ValueError):
        make_report(cover_bps=10001)
    with pytest.raises(ValueError):
        make_report(evidence_hash=b"corto")
