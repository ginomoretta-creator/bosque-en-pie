// Billeteras del jurado (#29): carga AVAX de prueba en BILLETERA_1..5 y arma la hoja de QR imprimible.
// Cada QR abre la web con la billetera cargada en el fragmento de la URL (#k=…), que nunca llega al servidor.
//
// Uso:
//   WEB_URL=https://<la-web-publicada> npx hardhat run scripts/billeteras-jurado.js --network fuji
//   npx hardhat run scripts/billeteras-jurado.js --network localhost        (WEB_URL por defecto: http://localhost:5173)
// Opcional: JURADO_AVAX=0.05 (saldo que se deja en cada billetera).
//
// La hoja queda en jurado/hoja-qr-<red>.html, que está en .gitignore: tiene claves (de prueba, sin valor).
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const { ethers, network } = require("hardhat");
const { cuenta } = require("./cuentas");

const CANTIDAD = 5;

const escapar = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const corta = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

async function main() {
  const red = network.name;
  const web = (process.env.WEB_URL || "http://localhost:5173").replace(/\/+$/, "");
  const objetivo = ethers.parseEther(process.env.JURADO_AVAX || "0.05");
  const [curador] = await ethers.getSigners();
  const billeteras = Array.from({ length: CANTIDAD }, (_, i) => cuenta(`BILLETERA_${i + 1}`, red));

  // Cuánto hay que mandar en total, para avisar antes de empezar si no alcanza.
  const saldos = await Promise.all(billeteras.map((b) => ethers.provider.getBalance(b.address)));
  const falta = saldos.reduce((t, s) => t + (s < objetivo ? objetivo - s : 0n), 0n);
  const saldoCurador = await ethers.provider.getBalance(curador.address);
  console.log(`Red: ${red} · curador ${curador.address} · saldo ${ethers.formatEther(saldoCurador)} AVAX · hace falta ${ethers.formatEther(falta)} AVAX`);
  if (falta > 0n && saldoCurador < falta + ethers.parseEther("0.01")) {
    throw new Error("El curador no tiene AVAX suficiente para cargar las billeteras (más gas). Cargá del faucet o bajá JURADO_AVAX.");
  }

  for (const [i, b] of billeteras.entries()) {
    if (saldos[i] >= objetivo) {
      console.log(`Billetera ${i + 1} (${corta(b.address)}): ya tiene ${ethers.formatEther(saldos[i])} AVAX`);
      continue;
    }
    const tx = await curador.sendTransaction({ to: b.address, value: objetivo - saldos[i] });
    await tx.wait();
    console.log(`Billetera ${i + 1} (${corta(b.address)}): cargada a ${ethers.formatEther(objetivo)} AVAX · tx ${tx.hash}`);
  }

  const signo = fs.readFileSync(path.join(__dirname, "..", "design", "assets", "logo", "signo-dia.svg"), "utf8");
  const tarjetas = [];
  for (const [i, b] of billeteras.entries()) {
    const url = `${web}/#k=${b.privateKey}`;
    const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#121410", light: "#0000" } });
    tarjetas.push(`
    <article class="tarjeta">
      <header><span class="signo">${signo}</span><b>bosque <i>en pie</i></b><span class="n">${String(i + 1).padStart(2, "0")}</span></header>
      <div class="qr">${qr}</div>
      <p class="accion">Escaneá con la cámara del celular y aportá a una parcela.</p>
      <p class="aviso">■ Red de prueba Fuji · no es plata real</p>
      <p class="dir">Billetera de prueba ${i + 1} · ${escapar(corta(b.address))} · ${ethers.formatEther(objetivo).replace(".", ",")} AVAX</p>
    </article>`);
  }
  tarjetas.push(`
    <article class="tarjeta info">
      <header><span class="signo">${signo}</span><b>bosque <i>en pie</i></b></header>
      <h2>Cómo funciona</h2>
      <ol>
        <li>Escaneás el QR: la web abre con una billetera de prueba ya cargada.</li>
        <li>Elegís una parcela y qué pasa con tu aporte si hay desmonte: vuelve a vos o va a restaurar.</li>
        <li>Cada mes, el satélite mira la parcela y tres verificadores firman el informe. Si el monte sigue en pie, el contrato paga a quienes lo cuidan.</li>
      </ol>
      <p class="aviso">■ Avalanche Fuji, red de prueba · Contiene datos Copernicus Sentinel modificados, 2024 y 2025</p>
    </article>`);

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Bosque en pie · billeteras del jurado (${escapar(red)})</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..800&family=Geist+Mono:wght@400..500&display=swap">
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #F4F2EC; color: #121410; font-family: Geist, system-ui, sans-serif; }
  main { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; padding: 6mm; max-width: 210mm; margin: auto; }
  .tarjeta { background: #FBFAF6; border: 1px solid #D9D5CA; border-radius: 4px; padding: 6mm; height: 88mm;
             display: flex; flex-direction: column; break-inside: avoid; }
  header { display: flex; align-items: center; gap: 2mm; font-size: 13pt; letter-spacing: -0.045em; }
  header b { font-weight: 800; } header i { font-style: normal; color: #2E7D4F; }
  .signo svg { width: 7mm; height: 7mm; display: block; }
  .n { margin-left: auto; font-family: "Geist Mono", monospace; font-size: 9pt; color: #5E6259; }
  .qr { flex: 1; display: grid; place-items: center; padding: 3mm 0; }
  .qr svg { width: 44mm; height: 44mm; }
  .accion { margin: 0 0 2mm; font-size: 10pt; font-weight: 600; }
  .aviso { margin: 0 0 1mm; font-family: "Geist Mono", monospace; font-size: 7pt; text-transform: uppercase; color: #885E0C; }
  .dir { margin: 0; font-family: "Geist Mono", monospace; font-size: 7pt; color: #5E6259; }
  .info h2 { font-size: 14pt; margin: 5mm 0 2mm; letter-spacing: -0.02em; }
  .info ol { margin: 0 0 auto; padding-left: 5mm; font-size: 9.5pt; line-height: 1.4; }
  .info li { margin-bottom: 2mm; }
</style></head>
<body><main>${tarjetas.join("")}
</main></body></html>
`;
  const destino = path.join(__dirname, "..", "jurado", `hoja-qr-${red}.html`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, html);
  console.log(`Hoja de QR en jurado/hoja-qr-${red}.html (abrila en el navegador e imprimila en A4). Tiene claves de prueba: no la subas.`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
