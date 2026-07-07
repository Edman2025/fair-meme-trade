import dotenv from "dotenv";
import { JsonRpcProvider, Wallet, formatEther } from "ethers";

dotenv.config({ path: ".env.local" });

const rpcUrl = process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const address = process.env.DEPLOYER_ADDRESS;

if (!privateKey && !address) {
  throw new Error("No deployer wallet found. Run `npm run wallet:create` first.");
}

const provider = new JsonRpcProvider(rpcUrl);
const walletAddress = address || new Wallet(privateKey).address;
const balance = await provider.getBalance(walletAddress);

console.log(`Address: ${walletAddress}`);
console.log(`RPC: ${rpcUrl}`);
console.log(`Balance: ${formatEther(balance)} tBNB`);
