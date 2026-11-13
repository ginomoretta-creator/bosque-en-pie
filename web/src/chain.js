// Lectura del contrato BosqueEnPie con viem.
// La red se elige con VITE_NETWORK (localhost | fuji). La dirección y las parcelas salen de
// deployments/<red>.json y el ABI de deployments/BosqueEnPie.abi.json (formatos de #38).
//
// Uso desde las pantallas:
//   import { store, NET, explorerTx } from "./chain.js";
//   store.subscribe((s) => render(s));   // s.parcels, s.events, s.error, s.loading
//   store.start();                       // primera lectura y luego cada POLL_MS
import { createPublicClient, defineChain, fallback, http, parseEventLogs } from "viem";
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
    rpcs: [import.meta.env.VITE_RPC_URL || `http://${location.hostname || "127.0.0.1"}:8545`],
    label: "Red local",
    explorer: null,
    logChunk: 50_000n,
    minChunk: 50_000n,
  },
  fuji: {
    chain: avalancheFuji,
    // publicnode primero: el RPC oficial (api.avax-test.network) corta con «error code: 1015» de Cloudflare
    // cuando hay muchos pedidos desde la misma IP (varios celulares en la WiFi del evento). Queda de respaldo.
    rpcs: [
      import.meta.env.VITE_RPC_URL,
      "https://avalanche-fuji-c-chain-rpc.publicnode.com",
      "https://api.avax-test.network/ext/bc/C/rpc",
    ].filter(Boolean),
    label: "Red de prueba Fuji",
    explorer: "https://testnet.snowtrace.io",
    logChunk: 2000n, // publicnode lee eventos de a miles de bloques; si cae al oficial (100), readLogs parte el tramo
    minChunk: 100n,
  },
};

if (!NETS[NETWORK]) throw new Error(`VITE_NETWORK desconocida: ${NETWORK} (usar localhost o fuji)`);

export const NET = { name: NETWORK, ...NETS[NETWORK] };
NET.rpc = NET.rpcs[0];
export const deployment = deployments[`../../deployments/${NETWORK}.json`] || null;
/** Transporte compartido por la lectura y la billetera: si un RPC falla, pasa al siguiente. */
export const transport = () =>
  NET.rpcs.length > 1 ? fallback(NET.rpcs.map((u) => http(u, { timeout: 12_000, retryCount: 1 }))) : http(NET.rpc);

// multicall junta las lecturas del contrato de una misma vuelta en un solo pedido (Fuji tiene Multicall3).
export const client = createPublicClient({
  chain: NET.chain,
  transport: transport(),
  batch: NET.chain.contracts?.multicall3 ? { multicall: true } : undefined,
});

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

const POLL_MS = NETWORK === "fuji" ? 8000 : 3000;
const PARCEL_EVERY = 6; // sin eventos nuevos, las parcelas se releen cada tantas vueltas (por si acaso)

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

const PARALLEL = 3;

/** Eventos de un tramo; si el RPC no acepta el tramo (por ejemplo el oficial de Fuji, 100 bloques), lo parte. */
async function readRange(a, b) {
  try {
    return await client.getContractEvents({ address: deployment.address, abi, fromBlock: a, toBlock: b });
  } catch (e) {
    if (b - a + 1n <= NET.minChunk) throw e;
    const out = [];
    for (let s = a; s <= b; s += NET.minChunk) {
      const t = s + NET.minChunk - 1n < b ? s + NET.minChunk - 1n : b;
      out.push(...(await client.getContractEvents({ address: deployment.address, abi, fromBlock: s, toBlock: t })));
    }
    return out;
  }
}

/** Eventos entre dos bloques, en tramos de NET.logChunk y de a PARALLEL pedidos a la vez. */
async function readLogs(fromBlock, toBlock) {
  const ranges = [];
  for (let s = fromBlock; s <= toBlock; s += NET.logChunk) {
    ranges.push([s, s + NET.logChunk - 1n < toBlock ? s + NET.logChunk - 1n : toBlock]);
  }
  const out = [];
  for (let i = 0; i < ranges.length; i += PARALLEL) {
    const batch = await Promise.all(ranges.slice(i, i + PARALLEL).map(([a, b]) => readRange(a, b)));
    out.push(...batch.flat());
  }
  return out;
}

// Foto de eventos tomada al publicar (web/scripts/snapshot.mjs): la página arranca de ahí y
// solo pide al RPC los bloques posteriores. Si no hay foto, o es de otro contrato, lee todo.
const snapshots = import.meta.glob("./snapshot/*.json", { eager: true, import: "default" });
const snapshot = (() => {
  const snap = snapshots[`./snapshot/${NETWORK}.json`];
  if (!snap || !deployment || snap.address.toLowerCase() !== deployment.address.toLowerCase()) return null;
  const logs = parseEventLogs({
    abi,
    logs: snap.logs.map((l) => ({ ...l, blockNumber: BigInt(l.blockNumber), removed: false })),
  });
  return { lastBlock: BigInt(snap.lastBlock), logs, takenAt: snap.takenAt };
})();
export const snapshotInfo = snapshot ? { lastBlock: snapshot.lastBlock, takenAt: snapshot.takenAt, events: snapshot.logs.length } : null;

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
  let rawEvents = snapshot ? snapshot.logs : [];
  let rounds = 0;
  let failures = 0;

  const emit = () => subs.forEach((fn) => fn(state));

  async function refresh() {
    if (!deployment || busy) return;
    busy = true;
    try {
      const head = await client.getBlockNumber();
      const start = snapshot ? snapshot.lastBlock + 1n : BigInt(deployment.blockNumber || 0);
      const from = state.lastBlock === null ? start : state.lastBlock + 1n;
      if (state.lastBlock === null || head > state.lastBlock) {
        const logs = from <= head ? await readLogs(from, head) : [];
        await addTimestamps(logs);
        rawEvents = rawEvents.concat(logs);
        state.events = rawEvents;
        if (logs.length || state.lastBlock === null || rounds % PARCEL_EVERY === 0) {
          state.parcels = derive(await readParcels(), rawEvents);
        }
        if (logs.length || state.lastBlock === null) state.version++;
        state.lastBlock = head;
      }
      state.error = null;
      state.updatedAt = new Date();
      failures = 0;
    } catch (e) {
      console.error(e);
      failures++;
      // Con datos ya leídos, un corte suelto no se muestra: se reintenta en la próxima vuelta.
      if (state.lastBlock === null || failures >= 3) {
        state.error = `No se pudo leer el contrato en ${NET.label}. ${e.shortMessage || e.message || e}`;
      }
    } finally {
      rounds++;
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
