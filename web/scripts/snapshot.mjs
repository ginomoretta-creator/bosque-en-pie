// Foto de los eventos del contrato para la web publicada (#30).
// El RPC público de Fuji deja leer eventos de a 100 bloques: leer toda la historia desde el celular
// serían cientos de pedidos. Este script la lee una vez al publicar y la guarda en
// web/src/snapshot/<red>.json; la página arranca de ahí y solo pide los bloques nuevos.
//
// Uso (desde web/):  node scripts/snapshot.mjs fuji      |   node scripts/snapshot.mjs localhost
// Si no hay deployments/<red>.json, avisa y termina sin error (la web dice que no hay contrato).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http } from "viem";

const NETWORK = process.argv[2] || process.env.VITE_NETWORK || "fuji";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RPC = {
  fuji: process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
  localhost: "http://127.0.0.1:8545",
}[NETWORK];
const CHUNK = NETWORK === "fuji" ? 100n : 50_000n;
const PARALLEL = 4;

const depFile = join(ROOT, "deployments", `${NETWORK}.json`);
if (!existsSync(depFile)) {
  console.log(`No hay ${depFile}: la web se publica sin foto de eventos.`);
  process.exit(0);
}
const deployment = JSON.parse(readFileSync(depFile, "utf8"));
const client = createPublicClient({ transport: http(RPC, { retryCount: 5, retryDelay: 500 }) });

const head = await client.getBlockNumber();
const from = BigInt(deployment.blockNumber || 0);
const ranges = [];
for (let s = from; s <= head; s += CHUNK) ranges.push([s, s + CHUNK - 1n < head ? s + CHUNK - 1n : head]);
console.log(`${NETWORK}: ${deployment.address} · bloques ${from} a ${head} · ${ranges.length} pedidos`);

const logs = [];
for (let i = 0; i < ranges.length; i += PARALLEL) {
  const batch = await Promise.all(
    ranges.slice(i, i + PARALLEL).map(([a, b]) => client.getLogs({ address: deployment.address, fromBlock: a, toBlock: b })),
  );
  logs.push(...batch.flat());
  if (i % (PARALLEL * 50) === 0) process.stdout.write(`  ${Math.min(i + PARALLEL, ranges.length)}/${ranges.length}\r`);
}

const times = {};
for (const b of [...new Set(logs.map((l) => l.blockNumber))]) {
  times[b.toString()] = Number((await client.getBlock({ blockNumber: b })).timestamp);
}

const out = {
  network: NETWORK,
  address: deployment.address,
  lastBlock: head.toString(),
  takenAt: new Date().toISOString(),
  logs: logs.map((l) => ({
    address: l.address,
    topics: l.topics,
    data: l.data,
    blockNumber: l.blockNumber.toString(),
    transactionHash: l.transactionHash,
    logIndex: l.logIndex,
    timestamp: times[l.blockNumber.toString()],
  })),
};
const dest = join(ROOT, "web", "src", "snapshot", `${NETWORK}.json`);
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out) + "\n");
console.log(`\n${logs.length} eventos hasta el bloque ${head} → web/src/snapshot/${NETWORK}.json`);
