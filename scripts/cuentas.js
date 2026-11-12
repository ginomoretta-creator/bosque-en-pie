// Cuentas de la demo.
// - En Fuji salen del .env (<NOMBRE>_PRIVATE_KEY): claves de prueba que maneja el equipo.
// - En la red local (localhost / hardhat), si no están en el .env, salen de las cuentas públicas
//   de Hardhat. Así cualquiera del equipo despliega y prueba sin pedir claves.
// El mismo reparto está en oracle/cuentas.py: si cambiás uno, cambiá el otro.
const { ethers } = require("hardhat");

const MNEMONIC = "test test test test test test test test test test test junk"; // pública, sin valor
const INDICE_LOCAL = {
  CURATOR: 0,
  RELAYER: 1,
  VERIFIER_1: 2,
  VERIFIER_2: 3,
  VERIFIER_3: 4,
  OWNER_A: 5,
  OPERATOR_A: 6,
  OWNER_B: 7,
  OPERATOR_B: 8,
  EMPRESA: 9,
  BILLETERA_1: 10,
  BILLETERA_2: 11,
  BILLETERA_3: 12,
  BILLETERA_4: 13,
  BILLETERA_5: 14,
};

const esLocal = (red) => red === "localhost" || red === "hardhat";

/** Billetera (ethers v6) de una cuenta de la demo, sin conectar a un proveedor. */
function cuenta(nombre, red) {
  const clave = process.env[`${nombre}_PRIVATE_KEY`];
  if (clave) return new ethers.Wallet(clave);
  if (esLocal(red) && nombre in INDICE_LOCAL) {
    return ethers.HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${INDICE_LOCAL[nombre]}`);
  }
  throw new Error(`Falta ${nombre}_PRIVATE_KEY en .env`);
}

module.exports = { cuenta, esLocal, INDICE_LOCAL, MNEMONIC };
