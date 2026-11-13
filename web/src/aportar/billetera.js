// Billetera de prueba del carril 4: la clave sale del QR del jurado (#k=… en el fragmento, ver ../wallet.js).
// En la red local, sin QR, se puede elegir una cuenta del nodo de Hardhat (mnemónico público de prueba).
// Solo claves de prueba: nunca se manda la clave a ningún servidor; firma el navegador y va directo al RPC.
import { createWalletClient, formatEther, http } from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { NET, NETWORK, abi, client, deployment, store } from "../chain.js";
import { captureKeyFromHash, forgetKey, judgeKey } from "../wallet.js";

const LOCAL_MNEMONIC = "test test test test test test test test test test test junk";
const LOCAL_KEY = "bosque-en-pie:cuenta-local";
// Mismos índices que scripts/cuentas.js: EMPRESA 9, BILLETERA_1..5 10–14.
export const LOCAL_ACCOUNTS = [
  ["Empresa de prueba", 9],
  ["Billetera de prueba 1", 10],
  ["Billetera de prueba 2", 11],
  ["Billetera de prueba 3", 12],
];

let cached = null;

function localIndex() {
  try {
    const v = sessionStorage.getItem(LOCAL_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

/** Cuenta activa: la del QR, o (solo en local) la elegida del nodo de Hardhat. */
export function account() {
  const key = judgeKey();
  const idx = NETWORK === "localhost" ? localIndex() : null;
  const id = key || (idx !== null ? `local:${idx}` : null);
  if (!id) return null;
  if (cached?.id === id) return cached.account;
  const acc = key ? privateKeyToAccount(key) : mnemonicToAccount(LOCAL_MNEMONIC, { addressIndex: idx });
  const label = key ? "Billetera de prueba" : LOCAL_ACCOUNTS.find(([, i]) => i === idx)?.[0] || `Cuenta local ${idx}`;
  acc.label = label;
  cached = { id, account: acc };
  return acc;
}

/** Usa una clave pegada a mano, igual que si viniera de un QR. */
export function useKey(raw) {
  const k = String(raw || "").trim();
  const key = k.startsWith("0x") ? k : `0x${k}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("La clave de prueba tiene que tener 64 caracteres hexadecimales.");
  const path = location.hash.startsWith("#/") ? location.hash.slice(1) : "/mi-aporte";
  location.hash = `#k=${key}`;
  captureKeyFromHash(); // guarda la clave y deja la URL en #/
  location.hash = `#${path}`;
}

export function useLocal(index) {
  try {
    sessionStorage.setItem(LOCAL_KEY, String(index));
  } catch {
    /* sin sessionStorage */
  }
  cached = null;
}

export function logout() {
  forgetKey();
  try {
    sessionStorage.removeItem(LOCAL_KEY);
  } catch {
    /* nada */
  }
  cached = null;
}

export const balance = async (acc) => client.getBalance({ address: acc.address });
export const avaxNumber = (wei) => Number(formatEther(wei));

/** Escribe en el contrato con la billetera de prueba y espera la confirmación. Devuelve el recibo. */
export async function send(functionName, args, value) {
  const acc = account();
  if (!acc) throw new Error("No hay billetera de prueba activa.");
  const wallet = createWalletClient({ account: acc, chain: NET.chain, transport: http(NET.rpc) });
  // Simular primero: si el contrato lo rechaza, el motivo llega en español antes de firmar.
  const { request } = await client.simulateContract({
    account: acc,
    address: deployment.address,
    abi,
    functionName,
    args,
    value,
  });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("La transacción se revirtió.");
  store.refresh();
  return receipt;
}

/** Motivo legible de un error de viem (los require del contrato están en español). */
export function reason(e) {
  const all = [e?.shortMessage, e?.details, e?.cause?.reason, e?.cause?.shortMessage, e?.message].filter(Boolean).join("\n");
  const m = all.match(/reverted with the following reason:\s*\n?\s*([^\n]+)/i) || all.match(/reason:\s*([^\n]+)/i);
  if (m) return m[1].trim();
  if (/insufficient funds|exceeds the balance/i.test(all)) return "No alcanza el saldo de la billetera de prueba (aporte más gas).";
  if (/fetch|network|timeout/i.test(all)) return `No hubo respuesta de ${NET.label}. Probá de nuevo en unos segundos.`;
  return e?.shortMessage || e?.message || String(e);
}

/** Lee del contrato. */
export const read = (functionName, args = []) =>
  client.readContract({ address: deployment.address, abi, functionName, args });
