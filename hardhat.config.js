require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Claves solo desde .env (nunca en el repo). Si falta alguna, la red fuji queda sin cuentas.
const keys = [process.env.CURATOR_PRIVATE_KEY, process.env.RELAYER_PRIVATE_KEY].filter(Boolean);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "paris",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: { chainId: 31337 },
    fuji: {
      url: process.env.FUJI_RPC_URL || "https://avalanche-fuji-c-chain-rpc.publicnode.com",
      chainId: 43113,
      accounts: keys,
    },
  },
  // Verificación del código en el explorer (#14): Routescan acepta la API de Etherscan y no pide clave real.
  // Uso: npm run fuji:verificar
  etherscan: {
    apiKey: { fuji: "routescan" },
    customChains: [
      {
        network: "fuji",
        chainId: 43113,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan",
          browserURL: "https://testnet.snowtrace.io",
        },
      },
    ],
  },
  sourcify: { enabled: false },
};
