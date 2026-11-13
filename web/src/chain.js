// Lectura del contrato BosqueEnPie con viem.
// La red se elige con VITE_NETWORK (localhost | fuji). La dirección y las parcelas salen de
// deployments/<red>.json y el ABI de deployments/BosqueEnPie.abi.json (formatos de #38).
//
// Uso desde las pantallas:
//   import { store, NET, explorerTx } from "./chain.js";
//   store.subscribe((s) => render(s));   // s.parcels, s.events, s.error, s.loading
//   store.start();                       // primera lectura y luego cada POLL_MS
import { createPublicClient, defineChain, http } from "viem";
import { avalancheFuji } from "viem/chains";
import abi from "../../deployments/BosqueEnPie.abi.json";

export { abi };

const deployments = import.meta.glob("../../deployments/*.json", { eager: true, import: "default" });

export const NETWORK = import.meta.env.VITE_NETWORK || "localhost";

const localChain = defineChain({
  id: 31337,
  name: "Hardhat local",
  nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

const NETS = {
  localhost: {
    chain: localChain,
    // Con el host de la página, la web abierta desde otro equipo de la red local también llega al nodo.
    rpc: import.meta.env.VITE_RPC_URL || `http://${location.hostname || "127.0.0.1"}:8545`,
    label: "Red local",
    explorer: null,
    logChunk: 50_000n,
  },
  fuji: {
    chain: avalancheFuji,
    rpc: import.meta.env.VITE_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
    label: "Red de prueba Fuji",
    explorer: "https://testnet.snowtrace.io",
    logChunk: 2_000n, // el RPC público limita el rango de eth_getLogs
  },
};

if (!NETS[NETWORK]) throw new Error(`VITE_NETWORK desconocida: ${NETWORK} (usar localhost o fuji)`);

export const NET = { name: NETWORK, ...NETS[NETWORK] };
export const deployment = deployments[`../../deployments/${NETWORK}.json`] || null;
export const client = createPublicClient({ chain: NET.chain, transport: http(NET.rpc) });

export const STATUS = ["Sin registrar", "En pie", "En revisión", "Desmontada", "Compromiso cerrado"];
export const STATUS_KEY = ["none", "standing", "review", "cleared", "closed"];
export const CHOICE = ["Devolución", "Restauración"];
export const WITHDRAW_KIND = ["devolución", "restauración", "sobrante"];

export const explorerTx = (hash) => (NET.explorer && hash ? `${NET.explorer}/tx/${hash}` : null);
export const explorerAddress = (addr) => (NET.explorer && addr ? `${NET.explorer}/address/${addr}` : null);

export function parcelName(id) {
  const p = deployment?.parcels?.find((x) => Number(x.id) === Number(id));
  return p ? `Parcela ${p.name}` : `Parcela ${id}`;
}

const POLL_MS = NETWORK === "fuji" ? 6000 : 3000;

// ------------------------------------------------------------------ lectura

async function readParcels() {
  const address = deployment.address;
  const count = Number(await client.readContract({ address, abi, functionName: "parcelCount" }));
  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const raw = await Promise.all(
    ids.map((id) => client.readContract({ address, abi, functionName: "getParcel", args: [BigInt(id)] })),
  );
  return raw.map((p, i) => ({ id: ids[i], name: parcelName(ids[i]), ...p, status: Number(p.status) }));
}

async function readLogs(fromBlock, toBlock) {
  const out = [];
  for (let start = fromBlock; start <= toBlock; start += NET.logChunk) {
    const end = start + NET.logChunk - 1n < toBlock ? start + NET.logChunk - 1n : toBlock;
    const logs = await client.getContractEvents({ address: deployment.address, abi, fromBlock: start, toBlock: end });
    out.push(...logs);
  }
  return out;
}

const blockTimes = new Map();
async function addTimestamps(logs) {
  const missing = [...new Set(logs.map((l) => l.blockNumber))].filter((b) => !blockTimes.has(b));
  await Promise.all(
    missing.map(async (b) => {
      const block = await client.getBlock({ blockNumber: b });
      blockTimes.set(b, Number(block.timestamp));
    }),
  );
  for (const l of logs) l.timestamp = blockTimes.get(l.blockNumber);
}

// ------------------------------------------------------------------ estado derivado

const bitCount = (n) => n.toString(2).split("").filter((c) => c === "1").length;

/** Une parcelas y eventos: informes aplicados, pagos y aportes de cada parcela. */
function derive(parcels, events) {
  return parcels.map((p) => {
    const mine = events.filter((e) => Number(e.args.parcelId) === p.id);
    const reports = mine
      .filter((e) => e.eventName === "ReportApplied")
      .map((e) => ({
        tObs: Number(e.args.report.tObs),
        coverBps: Number(e.args.report.coverBps),
        validBps: Number(e.args.report.validBps),
        evidenceHash: e.args.report.evidenceHash,
        signers: bitCount(Number(e.args.report.signersMask)),
        signersMask: Number(e.args.report.signersMask),
        standing: e.args.standing,
        status: Number(e.args.status),
        paid: e.args.paid,
        tx: e.transactionHash,
      }));
    const sum = (name, f) => mine.filter((e) => e.eventName === name).reduce((a, e) => a + f(e.args), 0n);
    return {
      ...p,
      reports,
      lastReport: reports.at(-1) || null,
      totalPaid: sum("Paid", (a) => a.ownerAmount + a.operatorAmount),
      totalDonated: sum("Donated", (a) => a.amount),
    };
  });
}

// ------------------------------------------------------------------ store

function createStore() {
  const state = {
    deployment,
    parcels: [],
    events: [],
    loading: true,
    error: deployment ? null : `No hay contrato desplegado en ${NET.label}: falta deployments/${NETWORK}.json`,
    lastBlock: null,
    version: 0, // sube solo cuando llegan eventos nuevos: las pantallas se repintan con eso, no con cada bloque
    updatedAt: null,
  };
  const subs = new Set();
  let timer = null;
  let busy = false;
  let rawEvents = [];

  const emit = () => subs.forEach((fn) => fn(state));

  async function refresh() {
    if (!deployment || busy) return;
    busy = true;
    try {
      const head = await client.getBlockNumber();
      const from = state.lastBlock === null ? BigInt(deployment.blockNumber || 0) : state.lastBlock + 1n;
      if (state.lastBlock === null || head > state.lastBlock) {
        const logs = from <= head ? await readLogs(from, head) : [];
        await addTimestamps(logs);
        rawEvents = rawEvents.concat(logs);
        const parcels = await readParcels();
        state.events = rawEvents;
        state.parcels = derive(parcels, rawEvents);
        if (logs.length || state.lastBlock === null) state.version++;
        state.lastBlock = head;
      }
      state.error = null;
      state.updatedAt = new Date();
    } catch (e) {
      console.error(e);
      state.error = `No se pudo leer el contrato en ${NET.label} (${NET.rpc}). ${e.shortMessage || e.message || e}`;
    } finally {
      state.loading = false;
      busy = false;
      emit();
    }
  }

  return {
    get state() {
      return state;
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    refresh,
    start() {
      if (timer) return;
      refresh();
      timer = setInterval(refresh, POLL_MS);
    },
  };
}

export const store = createStore();
