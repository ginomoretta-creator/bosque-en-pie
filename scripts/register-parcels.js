// Registra las parcelas de parcels/registry.json en el contrato desplegado.
// Uso: npx hardhat run scripts/register-parcels.js --network fuji
// Las hectáreas salen de los GeoJSON reales: no se registra una parcela con hectáreas sin completar.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

function addressFromEnv(name) {
  const key = process.env[`${name}_PRIVATE_KEY`];
  if (!key) throw new Error(`Falta ${name}_PRIVATE_KEY en .env`);
  return new ethers.Wallet(key).address;
}

async function main() {
  const root = path.join(__dirname, "..");
  const deployment = JSON.parse(fs.readFileSync(path.join(root, "deployments", `${network.name}.json`), "utf8"));
  const registryPath = process.env.PARCEL_REGISTRY || path.join(root, "parcels", "registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const [curator] = await ethers.getSigners();
  const c = await ethers.getContractAt("BosqueEnPie", deployment.address, curator);

  const already = Number(await c.parcelCount());
  const results = [];
  for (const [i, p] of registry.parcels.entries()) {
    const expectedId = i + 1;
    if (expectedId <= already) {
      console.log(`Parcela ${p.name}: ya registrada con id ${expectedId}, se saltea`);
      continue;
    }
    if (!Number.isInteger(p.hectares) || p.hectares <= 0) {
      throw new Error(`Parcela ${p.name}: completar "hectares" en parcels/registry.json a partir del GeoJSON`);
    }
    const owner = addressFromEnv(p.ownerEnv);
    const operator = addressFromEnv(p.operatorEnv);
    const tx = await c.registerParcel(owner, operator, ethers.parseEther(p.feeAvax), p.thresholdBps, p.ownerShareBps, p.hectares, p.commitEnd);
    const rc = await tx.wait();
    console.log(`Parcela ${p.name} registrada con id ${expectedId} · tx ${tx.hash} (bloque ${rc.blockNumber})`);
    results.push({ id: expectedId, name: p.name, tx: tx.hash });
  }
  deployment.parcels = [...(deployment.parcels || []), ...results];
  fs.writeFileSync(path.join(root, "deployments", `${network.name}.json`), JSON.stringify(deployment, null, 2) + "\n");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
