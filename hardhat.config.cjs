require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: ".env.local" });

const bscTestnetRpcUrl = process.env.VITE_RPC_URL || "https://bsc-testnet-rpc.publicnode.com";
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;

/** @type {import("hardhat/config").HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    bscTestnet: {
      url: bscTestnetRpcUrl,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
    },
  },
};
