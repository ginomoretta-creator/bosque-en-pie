// Verifica el código del contrato en el explorer de Fuji (#14), con los mismos argumentos del despliegue.
// Uso: npm run fuji:verificar
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const red = hre.network.name;
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${red}.json`), "utf8"));
  const p = d.params;
  await hre.run("verify:verify", {
    address: d.address,
    constructorArguments: [d.verifiers, p.quorum, p.challengeWindow, p.minInterval, p.maxObsAge, p.restorationTimeout],
  });
  console.log(`Código verificado: https://testnet.snowtrace.io/address/${d.address}#code`);
}

main().catch((e) => {
  // "Already Verified" no es un error para nosotros.
  if (/already verified/i.test(e.message || "")) {
    console.log("El contrato ya estaba verificado.");
    return;
  }
  console.error(e.message || e);
  process.exit(1);
});
