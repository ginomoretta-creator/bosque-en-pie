// Despliega BosqueEnPie con los parámetros de la demo y guarda la dirección en deployments/<red>.json.
// Uso: npx hardhat run scripts/deploy.js --network fuji
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const { cuenta } = require("./cuentas");

const DAY = 24 * 60 * 60;

// Parámetros de la demo (CLAUDE.md): se repite 2025 en un minuto con imágenes históricas.
// En producción serían challengeWindow = 72 h y maxObsAge = 45 días.
const PARAMS = {
  quorum: 2,
  challengeWindow: 0,
  minInterval: 20 * DAY,
  maxObsAge: 0,
  restorationTimeout: 365 * DAY,
};

function verifierAddresses() {
  return ["VERIFIER_1", "VERIFIER_2", "VERIFIER_3"].map((n) => cuenta(n, network.name).address);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Red: ${network.name} · curador: ${deployer.address} · saldo: ${ethers.formatEther(balance)} AVAX`);
  if (balance === 0n) throw new Error("El curador no tiene saldo. Cargá AVAX de prueba desde el faucet de Fuji.");

  const verifiers = verifierAddresses();
  const F = await ethers.getContractFactory("BosqueEnPie");
  const c = await F.deploy(verifiers, PARAMS.quorum, PARAMS.challengeWindow, PARAMS.minInterval, PARAMS.maxObsAge, PARAMS.restorationTimeout);
  const tx = c.deploymentTransaction();
  await c.waitForDeployment();
  const receipt = await tx.wait();
  const address = await c.getAddress();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  const out = {
    network: network.name,
    chainId,
    address,
    deployTx: tx.hash,
    blockNumber: receipt.blockNumber,
    curator: deployer.address,
    verifiers,
    params: PARAMS,
    explorer: chainId === 43113 ? `https://testnet.snowtrace.io/address/${address}` : null,
    deployedAt: new Date().toISOString(),
  };
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(out, null, 2) + "\n");

  console.log(`BosqueEnPie desplegado en ${address} (bloque ${receipt.blockNumber})`);
  if (out.explorer) console.log(`Explorer: ${out.explorer}`);
  console.log(`Guardado en deployments/${network.name}.json · copiá la dirección a CONTRACT_ADDRESS en .env`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
