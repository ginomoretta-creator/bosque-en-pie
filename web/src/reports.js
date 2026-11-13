// Informes del oráculo en el repo (formato #38): reports/<A|B>/<AAAA-MM>/
//   evidence.json, report.json, rgb.png, perdida.png; skip.json si el mes no tuvo informe (nubes).
// Si todavía no hay reports/, se usan los de prueba de reports-prueba/ (sin imágenes).
import { keccak256, toBytes } from "viem";

const real = {
  json: import.meta.glob("../../reports/*/*/{report,skip}.json", { eager: true, import: "default" }),
  evidence: import.meta.glob("../../reports/*/*/evidence.json", { eager: true, query: "?raw", import: "default" }),
  png: import.meta.glob("../../reports/*/*/*.png", { eager: true, query: "?url", import: "default" }),
  carbono: import.meta.glob("../../reports/*/*/carbono.json", { eager: true, import: "default" }),
};
const test = {
  json: import.meta.glob("../../reports-prueba/*/*/{report,skip}.json", { eager: true, import: "default" }),
  evidence: import.meta.glob("../../reports-prueba/*/*/evidence.json", { eager: true, query: "?raw", import: "default" }),
  png: {},
  carbono: {},
};

const useReal = Object.keys(real.json).length > 0;
const src = useReal ? real : test;
export const REPORTS_DIR = useReal ? "reports" : "reports-prueba";
export const REPO_URL = "https://github.com/ginomoretta-creator/bosque-en-pie";

/** { A: { "2025-08": { month, report, skip, evidence, evidenceRaw, evidenceHash, rgb, perdida, githubUrl } } } */
export const reports = {};

function entry(path) {
  const m = path.match(/\/([^/]+)\/(\d{4}-\d{2})\/([^/]+)$/);
  if (!m) return null;
  const [, parcel, month, file] = m;
  reports[parcel] ??= {};
  reports[parcel][month] ??= { parcel, month, githubUrl: `${REPO_URL}/tree/main/${REPORTS_DIR}/${parcel}/${month}` };
  return { e: reports[parcel][month], file };
}

for (const [path, data] of Object.entries(src.json)) {
  const x = entry(path);
  if (x) x.e[x.file === "skip.json" ? "skip" : "report"] = data;
}
for (const [path, raw] of Object.entries(src.evidence)) {
  const x = entry(path);
  if (!x) continue;
  x.e.evidenceRaw = raw;
  x.e.evidenceHash = keccak256(toBytes(raw)); // los bytes exactos del archivo, como lo calcula el oráculo
  x.e.evidenceUrl = `${REPO_URL}/blob/main/${REPORTS_DIR}/${x.e.parcel}/${x.e.month}/evidence.json`;
  try {
    x.e.evidence = JSON.parse(raw);
  } catch {
    x.e.evidence = null;
  }
}
// Estimación de carbono (SIMULACIÓN · no validado): va aparte para no cambiar el evidenceHash.
for (const [path, data] of Object.entries(src.carbono)) {
  const x = entry(path);
  if (x) x.e.carbono = data;
}
for (const [path, url] of Object.entries(src.png)) {
  const x = entry(path);
  if (x) x.e[x.file.replace(".png", "")] = url;
}

/** Mes "AAAA-MM" (UTC) de una fecha unix. */
export const monthKey = (unix) => new Date(Number(unix) * 1000).toISOString().slice(0, 7);

/** Busca la carpeta de un informe del contrato: primero por evidenceHash, si no por mes. */
export function folderFor(letter, contractReport) {
  const all = Object.values(reports[letter] || {});
  return (
    all.find((r) => r.report?.evidenceHash?.toLowerCase() === contractReport.evidenceHash.toLowerCase()) ||
    reports[letter]?.[monthKey(contractReport.tObs)] ||
    null
  );
}

/** Letra de la parcela (A, B) a partir de su id en el contrato. */
export function letterOf(deployment, id) {
  return deployment?.parcels?.find((p) => Number(p.id) === Number(id))?.name ?? null;
}
