// Crea labels, milestones e issues en GitHub a partir de docs/backlog.md.
// Uso: node scripts/create-issues.mjs [--dry-run]
// Requiere `gh` con sesión iniciada. Es idempotente: saltea lo que ya existe.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DRY = process.argv.includes("--dry-run");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const LABELS = {
  "no se recorta": ["b60205", "Va sí o sí en la entrega"],
  "recorte 1 · certificados": ["fbca04", "Primero en recortarse si falta tiempo"],
  "recorte 2 · restauración": ["fdd835", "Segundo en recortarse"],
  "recorte 3 · reparto": ["fef2c0", "Tercero en recortarse"],
  "recorte 4 · impugnación": ["fef9e0", "Cuarto en recortarse"],
  "recorte 5 · imágenes": ["fffdf0", "Quinto en recortarse"],
  "necesita humano": ["d93f0b", "Requiere a una persona del equipo (claves, datos, grabación)"],
  contrato: ["1d76db", "Solidity / Hardhat"],
  "oráculo": ["5319e7", "Python: Sentinel-2, firma y envío"],
  web: ["0e8a16", "Vite + viem + Leaflet"],
  "diseño": ["c5def5", "Interfaz y mocks"],
  datos: ["006b75", "Parcelas, imágenes, calibración"],
  infra: ["bfdadc", "Claves, despliegue, publicación"],
  pitch: ["e99695", "Slides y video"],
  docs: ["d4c5f9", "README y documentación"],
};

const MILESTONES = [
  ["1 · Contrato y pruebas", "Reglas 1 a 8 implementadas y pruebas pasando en red local."],
  ["2 · Firma desde Python", "La firma hecha en Python valida en el contrato."],
  ["3 · Despliegue en Fuji", "Contrato en Fuji con parcelas registradas y link al explorer."],
  ["4 · Algoritmo Sentinel-2", "bosque-v1 probado y calibrado con datos reales de 2025."],
  ["5 · Informes y envío", "Informes reales firmados y enviados; replay de 2025."],
  ["6 · Página web", "Página pública que lee el contrato y permite aportar."],
  ["7 · Entrega", "README, pitch, video y entrega antes del 13/11 09:00."],
];

function gh(args, input) {
  if (DRY) { console.log("gh", args.join(" ")); return ""; }
  return execFileSync("gh", args, { cwd: root, encoding: "utf8", input });
}

function parseBacklog() {
  const text = readFileSync(join(root, "docs", "backlog.md"), "utf8").replace(/\r\n/g, "\n");
  return text.split("\n### ").slice(1).map((block) => {
    const lines = block.split("\n");
    const title = lines[0].trim();
    let milestone = "", labels = [];
    const bodyLines = [];
    for (const line of lines.slice(1)) {
      const m = line.match(/^- milestone: (.+)$/);
      const l = line.match(/^- labels: (.+)$/);
      if (m) milestone = m[1].trim();
      else if (l) labels = l[1].split(",").map((s) => s.trim());
      else bodyLines.push(line);
    }
    const body = bodyLines.join("\n").replace(/\n---\s*$/, "").trim();
    for (const lb of labels) if (!LABELS[lb]) throw new Error(`Label desconocido "${lb}" en "${title}"`);
    if (!MILESTONES.some(([t]) => t === milestone)) throw new Error(`Milestone desconocido "${milestone}" en "${title}"`);
    return { title, milestone, labels, body };
  });
}

const issues = parseBacklog();
console.log(`${issues.length} issues en docs/backlog.md`);

for (const [name, [color, description]] of Object.entries(LABELS)) {
  gh(["label", "create", name, "--color", color, "--description", description, "--force"]);
}

const existingMs = DRY ? [] : JSON.parse(gh(["api", "repos/{owner}/{repo}/milestones?state=all&per_page=100"])).map((m) => m.title);
for (const [title, description] of MILESTONES) {
  if (!existingMs.includes(title)) gh(["api", "repos/{owner}/{repo}/milestones", "-f", `title=${title}`, "-f", `description=${description}`]);
}

const existingIssues = DRY ? [] : JSON.parse(gh(["issue", "list", "--state", "all", "--limit", "500", "--json", "title"])).map((i) => i.title);
const tmp = mkdtempSync(join(tmpdir(), "backlog-"));
for (const [i, it] of issues.entries()) {
  if (existingIssues.includes(it.title)) { console.log(`ya existe: ${it.title}`); continue; }
  const bodyFile = join(tmp, `${i}.md`);
  writeFileSync(bodyFile, it.body + "\n");
  const args = ["issue", "create", "--title", it.title, "--body-file", bodyFile, "--milestone", it.milestone];
  for (const lb of it.labels) args.push("--label", lb);
  const url = gh(args).trim();
  console.log(`${url || "(dry)"}  ${it.title}`);
}
