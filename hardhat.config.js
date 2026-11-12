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
      url: process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: keys,
    },
  },
};
