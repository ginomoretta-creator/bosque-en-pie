// Carga los aportes iniciales de la demo para que los informes tengan de dónde pagar.
// La "empresa de prueba" aporta a A (devolución) y a B (mitad devolución, mitad restauración).
// Si se corre dos veces no duplica: saltea las parcelas donde la empresa ya aportó.
// Si la empresa no tiene saldo, se lo pasa el curador.
// Uso: npx hardhat run scripts/aportes-demo.js --network localhost   (o --network fuji)
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const { cuenta } = require("./cuentas");

const APORTES = [
  { parcela: "A", eleccion: 0, avax: "0.12" }, // 12 cuotas de 0,01
  { parcela: "B", eleccion: 0, avax: "0.06" },
  { parcela: "B", eleccion: 1, avax: "0.06" },
];

async function main() {
  const root = path.join(__dirname, "..");
  const deployment = JSON.parse(fs.readFileSync(path.join(root, "deployments", `${network.name}.json`), "utf8"));
  const empresa = cuenta("EMPRESA", network.name).connect(ethers.provider);
  const c = await ethers.getContractAt("BosqueEnPie", deployment.address, empresa);
  const ids = Object.fromEntries((deployment.parcels || []).map((p) => [p.name, p.id]));

  // Si a la empresa no le alcanza para los aportes (más gas), el curador le pasa la diferencia.
  const total = APORTES.reduce((t, a) => t + ethers.parseEther(a.avax), 0n) + ethers.parseEther("0.01");
  let saldo = await ethers.provider.getBalance(empresa.address);
  if (saldo < total) {
    const [curador] = await ethers.getSigners();
    const tx = await curador.sendTransaction({ to: empresa.address, value: total - saldo });
    await tx.wait();
    console.log(`El curador le pasó ${ethers.formatEther(total - saldo)} AVAX a la empresa de prueba · tx ${tx.hash}`);
    saldo = total;
  }
  console.log(`Red: ${network.name} · empresa de prueba: ${empresa.address} · saldo: ${ethers.formatEther(saldo)} AVAX`);

  for (const a of APORTES) {
    const id = ids[a.parcela];
    if (!id) throw new Error(`La parcela ${a.parcela} no está registrada en deployments/${network.name}.json`);
    const yaTiene = a.eleccion === 0 ? await c.refundStake(id, empresa.address) : await c.restoreStake(id, empresa.address);
    if (yaTiene > 0n) {
      console.log(`Parcela ${a.parcela}: la empresa ya aportó (${a.eleccion === 0 ? "devolución" : "restauración"}), se saltea`);
      continue;
    }
    const tx = await c.donate(id, a.eleccion, { value: ethers.parseEther(a.avax) });
    await tx.wait();
    console.log(`Parcela ${a.parcela}: aporte de ${a.avax} AVAX (${a.eleccion === 0 ? "devolución" : "restauración"}) · tx ${tx.hash}`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
