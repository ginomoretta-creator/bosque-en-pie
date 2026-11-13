"""Pruebas de bosque-v1 sobre matrices sintéticas (sin red)."""
import numpy as np
import pytest

from oracle.cover import VERSION, Thresholds, clean_loss, compute_cover, ndvi, to_reflectance

N = 100  # parcela de 100 × 100 píxeles = 100 ha


def refl_for_ndvi(value, nir=0.30):
    """Rojo e infrarrojo que dan el NDVI pedido con un NIR fijo."""
    value = np.asarray(value, dtype="float32")
    red = nir * (1 - value) / (1 + value)
    return red.astype("float32"), np.full_like(red, nir, dtype="float32")


def scene(ndvi_base=0.80, ndvi_now=0.78, scl=4, base_scl=4, shape=(N, N)):
    nb = np.full(shape, ndvi_base, dtype="float32") if np.isscalar(ndvi_base) else ndvi_base
    nn = np.full(shape, ndvi_now, dtype="float32") if np.isscalar(ndvi_now) else ndvi_now
    br, bn = refl_for_ndvi(nb)
    r, n = refl_for_ndvi(nn)
    s = np.full(shape, scl, dtype="uint8") if np.isscalar(scl) else scl
    bs = np.full(shape, base_scl, dtype="uint8") if np.isscalar(base_scl) else base_scl
    return dict(red=r, nir=n, scl=s, base_red=br, base_nir=bn, base_scl=bs, parcel_mask=np.ones(shape, bool))


def test_version():
    assert VERSION == "bosque-v1"


def test_monte_sin_cambios_da_10000():
    res = compute_cover(**scene())
    assert res.cover_bps == 10000
    assert res.valid_bps == 10000
    assert res.base_forest_px == N * N and res.lost_px == 0


def test_desmonte_en_bloque():
    now = np.full((N, N), 0.78, dtype="float32")
    now[10:50, 20:60] = 0.20  # 40 × 40 = 1600 px desmontados (16 ha)
    res = compute_cover(**scene(ndvi_now=now))
    assert res.lost_px == 1600
    assert res.cover_bps == 8400


def test_ruido_aislado_y_manchas_chicas_no_cuentan():
    now = np.full((N, N), 0.78, dtype="float32")
    rng = np.random.default_rng(1)
    idx = rng.choice(N * N, 300, replace=False)
    now.flat[idx] = 0.20          # píxeles sueltos
    now[70:79, 70:79] = 0.20      # mancha de 81 px (< 1 ha)
    now[5, 0:100] = 0.20          # línea de 1 px de ancho (camino)
    res = compute_cover(**scene(ndvi_now=now))
    assert res.lost_px == 0
    assert res.cover_bps == 10000


def test_caida_de_hojas_no_es_desmonte():
    # Bajó 0,30 pero quedó en 0,50 (> 0,35): monte seco de invierno, no desmonte.
    res = compute_cover(**scene(ndvi_base=0.80, ndvi_now=0.50))
    assert res.cover_bps == 10000


def test_nubes_reducen_la_parte_visible_y_no_cuentan_como_perdida():
    now = np.full((N, N), 0.78, dtype="float32")
    now[:, 50:] = 0.10                       # mitad derecha "perdida"…
    scl = np.full((N, N), 4, dtype="uint8")
    scl[:, 50:] = 9                           # …pero tapada por nubes (SCL 9)
    res = compute_cover(**scene(ndvi_now=now, scl=scl))
    assert res.valid_bps == 5000
    assert res.lost_px == 0
    assert res.cover_bps == 10000            # se mide solo sobre lo visible


def test_nubes_en_el_ano_base_tampoco_cuentan():
    base_scl = np.full((N, N), 4, dtype="uint8")
    base_scl[:50, :] = 8                      # mitad de arriba nublada en 2024
    now = np.full((N, N), 0.78, dtype="float32")
    now[:50, :] = 0.10
    res = compute_cover(**scene(ndvi_now=now, base_scl=base_scl))
    assert res.valid_bps == 10000            # hoy se ve toda la parcela
    assert res.base_forest_px == 5000
    assert res.cover_bps == 10000


def test_sin_dato_cuenta_como_no_visible():
    s = scene()
    s["red"][0:10, :] = np.nan
    res = compute_cover(**s)
    assert res.valid_bps == 9000


def test_fuera_de_la_parcela_no_cuenta():
    now = np.full((N, N), 0.78, dtype="float32")
    now[:, :30] = 0.10                        # desmonte afuera del polígono
    s = scene(ndvi_now=now)
    s["parcel_mask"][:, :30] = False
    res = compute_cover(**s)
    assert res.parcel_px == 7000
    assert res.cover_bps == 10000


def test_poco_monte_base_no_da_lectura():
    res = compute_cover(**scene(ndvi_base=0.30, ndvi_now=0.30))
    assert res.cover_bps is None
    assert "monte base visible insuficiente" in res.reason


def test_umbrales_configurables():
    now = np.full((N, N), 0.78, dtype="float32")
    now[0:20, 0:20] = 0.20                    # 400 px
    res = compute_cover(**scene(ndvi_now=now), th=Thresholds(min_patch_px=500))
    assert res.cover_bps == 10000            # 400 < 500: se descarta


def test_reflectancia_con_escala_offset_y_sin_dato():
    dn = np.array([[0, 1000, 3000]], dtype="uint16")
    r = to_reflectance(dn, 0.0001, -0.1)
    assert np.isnan(r[0, 0])
    assert r[0, 1] == pytest.approx(0.0, abs=1e-6)
    assert r[0, 2] == pytest.approx(0.2, abs=1e-6)


def test_ndvi_protege_divisiones():
    out = ndvi(np.array([0.0, 0.1]), np.array([0.0, 0.3]))
    assert np.isnan(out[0]) and out[1] == pytest.approx(0.5)


def test_clean_loss_vacio():
    assert not clean_loss(np.zeros((5, 5), bool)).any()


def test_formas_distintas_falla():
    s = scene()
    s["scl"] = s["scl"][:50]
    with pytest.raises(ValueError):
        compute_cover(**s)
