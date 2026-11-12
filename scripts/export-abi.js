// Copia el ABI del contrato compilado a deployments/BosqueEnPie.abi.json (se commitea).
// artifacts/ está en .gitignore: la web y el oráculo leen el ABI de acá.
// Uso: npm run abi   (compila y exporta)
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const artefacto = path.join(root, "artifacts", "contracts", "BosqueEnPie.sol", "BosqueEnPie.json");
if (!fs.existsSync(artefacto)) {
  console.error("Falta compilar: npx hardhat compile");
  process.exit(1);
}
const { abi } = JSON.parse(fs.readFileSync(artefacto, "utf8"));
const destino = path.join(root, "deployments", "BosqueEnPie.abi.json");
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, JSON.stringify(abi, null, 2) + "\n");
console.log(`ABI exportado a deployments/BosqueEnPie.abi.json (${abi.length} entradas)`);
