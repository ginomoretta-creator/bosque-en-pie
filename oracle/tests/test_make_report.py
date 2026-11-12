"""Pruebas de make_report sin red: formato de la evidencia y de la imagen de pérdida."""
import json

import numpy as np

from oracle.make_report import dump_evidence, loss_image
from oracle.signing import evidence_hash


def test_evidencia_en_una_linea_estable_y_utf8():
    a = dump_evidence({"b": 1, "a": "año", "c": {"z": 1, "y": 2}})
    b = dump_evidence({"c": {"y": 2, "z": 1}, "a": "año", "b": 1})
    assert a == b
    assert b"\n" not in a and not a.endswith(b"\n")
    assert json.loads(a.decode("utf-8"))["a"] == "año"
    assert evidence_hash(a) == evidence_hash(b)


def test_imagen_de_perdida_pinta_monte_y_perdida():
    base = np.full((4, 4), 0.8, dtype="float32")
    forest = np.ones((4, 4), bool)
    lost = np.zeros((4, 4), bool)
    lost[0, 0] = True
    parcel = np.ones((4, 4), bool)
    img = loss_image(base, forest, lost, parcel)
    assert img.shape == (4, 4, 3)
    assert tuple(img[0, 0]) == (220, 60, 40)
    assert tuple(img[1, 1]) == (47, 150, 80)
