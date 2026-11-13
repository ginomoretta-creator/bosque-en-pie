// Billetera del jurado (#26, carril 4): el QR abre la web con #k=<clave privada de prueba>.
// Acá solo se saca la clave del fragmento ANTES de que arranque el router, y se limpia la URL
// para que no quede a la vista. El fragmento nunca llega al servidor. Solo claves de prueba.
// El carril 4 arma la billetera con judgeKey() (por ejemplo, viem privateKeyToAccount).
const STORAGE = "bosque-en-pie:clave-prueba";
let memoryKey = null;

export function captureKeyFromHash() {
  const m = location.hash.match(/^#k=(0x[0-9a-fA-F]{64})/);
  if (!m) return false;
  memoryKey = m[1];
  try {
    sessionStorage.setItem(STORAGE, memoryKey);
  } catch {
    /* sin sessionStorage: queda solo en memoria */
  }
  history.replaceState(null, "", `${location.pathname}${location.search}#/`);
  return true;
}

export function judgeKey() {
  if (memoryKey) return memoryKey;
  try {
    return sessionStorage.getItem(STORAGE);
  } catch {
    return null;
  }
}

export function forgetKey() {
  memoryKey = null;
  try {
    sessionStorage.removeItem(STORAGE);
  } catch {
    /* nada */
  }
}
