"""Arma los informes mensuales de una parcela: evidencia, firma y miniaturas.

Uso:
    python -m oracle.make_report A --year 2025                 # solo evidencia y miniaturas
    python -m oracle.make_report A --year 2025 --sign fuji     # además firma para la red fuji

Por cada mes escribe en reports/<parcela>/<AAAA-MM>/ (formato de la issue #38):
    evidence.json  JSON en una sola línea, UTF-8, sin salto final. evidenceHash = keccak256 de esos bytes.
    report.json    parcelId, tObs, coverBps, validBps, evidenceHash y, con --sign, las firmas ordenadas.
    rgb.png        color real de la parcela (512 px de ancho como máximo).
    carbono.json   carbono estimado en pie (simulación, #36). Aparte: no cambia evidenceHash.
    perdida.png    monte del año base en verde y píxeles perdidos en rojo.
Si un mes no tiene imagen utilizable (nubes, poco monte base), escribe skip.json con el motivo.

Las imágenes se eligen en secuencia: la de cada mes tiene que ser al menos `--min-interval-days`
posterior a la del último informe, como exige el contrato. Entre las que dejan ver al menos el 60 %
de la parcela se usa la más cercana al día 15 del mes, no la más limpia: así una imagen de fin de
mes no deja al mes siguiente sin imágenes posibles.
"""
from __future__ import annotations

import argparse
import calendar
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from PIL import Image

from oracle.carbono import carbono_estimado
from oracle.cover import VERSION, Thresholds, compute_cover, ndvi
from oracle.s2 import best_scene, hectares, load_parcel, main_tile, read_clip, read_visual, search_scenes
from oracle.signing import Report, evidence_hash, sign_report

ROOT = Path(__file__).resolve().parents[1]
MIN_VALID_BPS = 6000
TARGET_DAY = 15   # fecha fijada de cada informe: se usa la imagen utilizable más cercana a este día
ATTRIBUTION = "Contiene datos Copernicus Sentinel modificados, 2024 y 2025"


def dump_evidence(evidence: dict) -> bytes:
    """Bytes exactos de evidence.json: una sola línea, claves ordenadas, sin salto final."""
    return json.dumps(evidence, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _thumb(arr: np.ndarray, width: int = 512) -> Image.Image:
    """Miniatura de 512 px de ancho (amplía sin suavizar para que se vean los píxeles de 10 m)."""
    im = Image.fromarray(arr)
    return im.resize((width, max(1, round(im.height * width / im.width))), Image.NEAREST)


def loss_image(base_ndvi: np.ndarray, base_forest: np.ndarray, lost: np.ndarray, parcel: np.ndarray) -> np.ndarray:
    g = np.nan_to_num(base_ndvi, nan=0.0)
    gray = (np.clip(g, 0, 1) * 180 + 40).astype("uint8")
    img = np.stack([gray, gray, gray], axis=-1)
    img[base_forest] = (47, 150, 80)
    img[lost] = (220, 60, 40)
    img[~parcel] = (img[~parcel] * 0.35).astype("uint8")
    return img


def month_range(year: int, month: int) -> tuple[str, str]:
    return f"{year}-{month:02d}-01", f"{year}-{month:02d}-{calendar.monthrange(year, month)[1]}"


def parcel_info(name: str) -> tuple[dict, int]:
    registry = json.loads((ROOT / "parcels" / "registry.json").read_text(encoding="utf-8"))
    for i, p in enumerate(registry["parcels"]):
        if p["name"] == name:
            return p, i + 1
    raise SystemExit(f"la parcela {name} no está en parcels/registry.json")


def build_month(name, parcel_id, geom, tile, year, month, min_dt, th, out_dir: Path,
                forest_type: str | None = None):
    start, end = month_range(year, month)
    bstart, bend = month_range(year - 1, month)
    target = datetime(year, month, TARGET_DAY, tzinfo=timezone.utc)
    now = best_scene(geom, start, end, tile=tile, min_datetime=min_dt, target=target)
    base = best_scene(geom, bstart, bend, tile=tile)
    out_dir.mkdir(parents=True, exist_ok=True)
    if not now or not base:
        reason = "sin imagen del mes" if not now else "sin imagen del año base"
        (out_dir / "skip.json").write_bytes(dump_evidence({"motivo": reason}))
        return None, reason

    (s_now, _), (s_base, _) = now, base
    c_now, c_base = read_clip(s_now, geom), read_clip(s_base, geom)
    res = compute_cover(c_now.red, c_now.nir, c_now.scl, c_base.red, c_base.nir, c_base.scl, c_now.parcel_mask, th)

    # Miniaturas (#22)
    rgb = read_visual(s_now, c_now)
    if rgb is not None:
        _thumb(rgb).save(out_dir / "rgb.png")
    base_ndvi = ndvi(c_base.red, c_base.nir)
    base_forest = c_now.parcel_mask & (base_ndvi >= th.base_forest_ndvi)
    _thumb(loss_image(base_ndvi, base_forest, res.loss_mask, c_now.parcel_mask)).save(out_dir / "perdida.png")

    usable = res.cover_bps is not None and res.valid_bps >= MIN_VALID_BPS
    evidence = {
        "algoritmo": VERSION,
        "umbrales": th.as_dict(),
        "parcela": {"nombre": name, "id": parcel_id, "tile": tile},
        "mes": f"{year}-{month:02d}",
        "imagen": s_now.describe(),
        "imagen_base": s_base.describe(),
        "resultado": res.as_dict(),
        "atribucion": ATTRIBUTION,
    }
    if not usable:
        evidence["motivo"] = res.reason or f"parte visible {res.valid_bps / 100:.1f} % (mínimo 60 %)"
        (out_dir / "skip.json").write_bytes(dump_evidence(evidence))
        return None, evidence["motivo"]

    raw = dump_evidence(evidence)
    write_carbon(out_dir, geom, forest_type, res.cover_bps)
    (out_dir / "evidence.json").write_bytes(raw)
    report = {
        "parcel": name,
        "parcelId": parcel_id,
        "month": f"{year}-{month:02d}",
        "tObs": s_now.t_obs,
        "coverBps": res.cover_bps,
        "validBps": res.valid_bps,
        "evidenceHash": "0x" + evidence_hash(raw).hex(),
        "signatures": [],
    }
    return report, s_now.datetime


def write_carbon(out_dir: Path, geom, forest_type, cover_bps: int) -> dict:
    """carbono.json: estimación informativa (#36), aparte de evidence.json.

    No va dentro de la evidencia a propósito: evidenceHash ya está grabado en Fuji y no tiene que
    cambiar si se agrega o se corrige esta estimación.
    """
    est = carbono_estimado(round(hectares(geom), 1), forest_type, cover_bps)
    (out_dir / "carbono.json").write_bytes(dump_evidence(est))
    return est


def carbon_only(name: str, geom, forest_type) -> None:
    """Escribe carbono.json para los informes que ya existen, sin tocar evidence.json ni report.json."""
    for ev in sorted((ROOT / "reports" / name).glob("*/evidence.json")):
        cover = json.loads(ev.read_bytes())["resultado"]["cover_bps"]
        est = write_carbon(ev.parent, geom, forest_type, cover)
        print(f"  {ev.parent.name}: {est['tco2e']:,.0f} t CO₂e en {est['hectareas_en_pie']} ha en pie (simulación)")


def sign(report: dict, network: str) -> dict:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
    dep = json.loads((ROOT / "deployments" / f"{network}.json").read_text(encoding="utf-8"))
    keys = [os.environ[f"VERIFIER_{i}_PRIVATE_KEY"] for i in (1, 2, 3)]
    r = Report(report["parcelId"], report["tObs"], report["coverBps"], report["validBps"],
               bytes.fromhex(report["evidenceHash"][2:]))
    report["network"] = network
    report["chainId"] = dep["chainId"]
    report["contract"] = dep["address"]
    report["signatures"] = ["0x" + s.hex() for s in sign_report(dep["chainId"], dep["address"], r, keys)]
    return report


def main(argv=None):
    ap = argparse.ArgumentParser(description="Informes mensuales de una parcela")
    ap.add_argument("parcel", help="nombre de la parcela en parcels/registry.json (A o B)")
    ap.add_argument("--year", type=int, default=2025)
    ap.add_argument("--months", default="1-12", help="rango de meses, por ejemplo 1-12 o 3-5")
    ap.add_argument("--min-interval-days", type=int, default=20)
    ap.add_argument("--sign", metavar="RED", help="firma con las claves de .env para deployments/<RED>.json")
    ap.add_argument("--solo-carbono", action="store_true",
                    help="solo escribe carbono.json en los informes existentes (no toca la evidencia enviada)")
    args = ap.parse_args(argv)

    info, parcel_id = parcel_info(args.parcel)
    geom = load_parcel(ROOT / info["geojson"])
    tile = info.get("tile") or main_tile(search_scenes(geom, f"{args.year}-01-01", f"{args.year}-03-31"))
    th = Thresholds(**info.get("thresholds", {}))
    if args.solo_carbono:
        print(f"Parcela {args.parcel}: carbono estimado de los informes existentes")
        carbon_only(args.parcel, geom, info.get("forestType"))
        return
    print(f"Parcela {args.parcel} (id {parcel_id}) · {hectares(geom):.0f} ha · tile {tile}")

    m0, m1 = (int(x) for x in args.months.split("-"))
    last: datetime | None = None
    for m in range(m0, m1 + 1):
        out_dir = ROOT / "reports" / args.parcel / f"{args.year}-{m:02d}"
        for f in ("evidence.json", "report.json", "skip.json"):
            (out_dir / f).unlink(missing_ok=True)
        min_dt = last + timedelta(days=args.min_interval_days) if last else None
        report, info_or_reason = build_month(args.parcel, parcel_id, geom, tile, args.year, m, min_dt, th,
                                             out_dir, info.get("forestType"))
        if report is None:
            print(f"  {args.year}-{m:02d}: sin informe ({info_or_reason})")
            continue
        last = info_or_reason
        if args.sign:
            report = sign(report, args.sign)
        (out_dir / "report.json").write_bytes(dump_evidence(report))
        print(f"  {args.year}-{m:02d}: imagen {last.date()} · en pie {report['coverBps'] / 100:.1f} % · "
              f"visible {report['validBps'] / 100:.1f} %{' · firmado' if args.sign else ''}")


if __name__ == "__main__":
    main()
