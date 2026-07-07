import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import { Contract, JsonRpcProvider, NonceManager, Wallet, parseEther, parseUnits, formatEther, formatUnits } from "ethers";

dotenv.config({ path: ".env.local" });

const deployment = JSON.parse(readFileSync(process.env.DEPLOYMENT_FILE || "contracts/deployments.bsc-testnet.v3.json", "utf8"));
const rpcUrl = process.env.VITE_RPC_URL || process.env.BSC_TESTNET_RPC_URL || deployment.rpcUrl;
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY is required");

const FACTORY_ABI = [
  "function projects(uint256) view returns (address token,address creator,string name,string symbol,string metadataURI,address pairToken,uint256 totalSupply,uint256 createdAt,uint256 lpDeadline,uint8 status)",
  "function reviewProject(uint256 projectId,bool approved,string note)",
  "function markLaunched(uint256 projectId)",
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 value) returns (bool)",
  "function decimals() view returns (uint8)",
];

const ROUTER_ABI = [
  "function addLiquidityETH(address token,uint256 amountTokenDesired,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) payable returns (uint256 amountToken,uint256 amountETH,uint256 liquidity)",
];

const PANCAKE_FACTORY_ABI = [
  "function getPair(address tokenA,address tokenB) view returns (address pair)",
];

const VAULT_ABI = [
  "function positionCount() view returns (uint256)",
  "function lock(address lpToken,address projectToken,uint256 amount,uint256 unlockAt,uint8 releaseType,uint256 releaseStart,uint256 releaseEnd) returns (uint256 positionId)",
];

const provider = new JsonRpcProvider(rpcUrl);
const signer = new NonceManager(new Wallet(privateKey, provider));
const walletAddress = await signer.getAddress();
const balance = await provider.getBalance(walletAddress);
console.log(`deployer ${walletAddress} balance=${formatEther(balance)} tBNB`);

const projectId = BigInt(deployment.rocketProjectId || 1);
const routerAddress = process.env.VITE_PANCAKE_ROUTER_ADDRESS || "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
const pancakeFactoryAddress = process.env.VITE_PANCAKE_FACTORY_ADDRESS || "0x6725F303b657a9451d8BA641348b6761A6CC7a17";
const wbnbAddress = process.env.VITE_WBNB_ADDRESS || "0xae13d989dac2f0debff460ac112a837c89baa7cd";
const tokenAmount = parseUnits(process.env.SEED_ROCKET_TOKEN_AMOUNT || "1000", 18);
const bnbAmount = parseEther(process.env.SEED_ROCKET_BNB_AMOUNT || "0.01");

const factory = new Contract(deployment.factoryAddress, FACTORY_ABI, signer);
let project = await factory.projects(projectId);
if (Number(project.status) === 0) {
  console.log("reviewing ROCKET project on-chain");
  const tx = await factory.reviewProject(projectId, true, "seed launch smoke");
  console.log(`review tx ${tx.hash}`);
  await tx.wait();
  project = await factory.projects(projectId);
}
if (Number(project.status) === 1) {
  console.log("marking ROCKET project launched on-chain");
  const tx = await factory.markLaunched(projectId);
  console.log(`launch tx ${tx.hash}`);
  await tx.wait();
  project = await factory.projects(projectId);
}
if (Number(project.status) !== 2) {
  throw new Error(`ROCKET project did not reach Launched status; status=${project.status}`);
}
console.log("ROCKET project launched");

const vault = new Contract(deployment.lpVaultAddress, VAULT_ABI, signer);
const currentPositions = await vault.positionCount();
if (currentPositions > 0n) {
  console.log(`vault already has ${currentPositions} position(s); skipping seed LP lock`);
  process.exit(0);
}

const token = new Contract(deployment.rocketTokenAddress, ERC20_ABI, signer);
const tokenBalance = await token.balanceOf(walletAddress);
if (tokenBalance < tokenAmount) {
  throw new Error(`insufficient ROCKET balance: ${formatUnits(tokenBalance, 18)}`);
}
if (balance < bnbAmount + parseEther("0.02")) {
  throw new Error(`insufficient tBNB balance for liquidity and gas: ${formatEther(balance)}`);
}

const tokenAllowance = await token.allowance(walletAddress, routerAddress);
if (tokenAllowance < tokenAmount) {
  console.log("approving ROCKET for Pancake router");
  const tx = await token.approve(routerAddress, tokenAmount);
  console.log(`token approve tx ${tx.hash}`);
  await tx.wait();
}

const router = new Contract(routerAddress, ROUTER_ABI, signer);
const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
console.log(`adding Pancake liquidity token=${formatUnits(tokenAmount, 18)} ROCKET bnb=${formatEther(bnbAmount)}`);
const addTx = await router.addLiquidityETH(
  deployment.rocketTokenAddress,
  tokenAmount,
  0,
  0,
  walletAddress,
  deadline,
  { value: bnbAmount },
);
console.log(`add liquidity tx ${addTx.hash}`);
await addTx.wait();

const pancakeFactory = new Contract(pancakeFactoryAddress, PANCAKE_FACTORY_ABI, provider);
const pairAddress = await pancakeFactory.getPair(deployment.rocketTokenAddress, wbnbAddress);
if (pairAddress === "0x0000000000000000000000000000000000000000") {
  throw new Error("Pancake pair was not created");
}

const lpToken = new Contract(pairAddress, ERC20_ABI, signer);
const lpBalance = await lpToken.balanceOf(walletAddress);
if (lpBalance <= 0n) throw new Error("No LP balance to lock");
const lpAllowance = await lpToken.allowance(walletAddress, deployment.lpVaultAddress);
if (lpAllowance < lpBalance) {
  console.log("approving LP token for vault");
  const tx = await lpToken.approve(deployment.lpVaultAddress, lpBalance);
  console.log(`lp approve tx ${tx.hash}`);
  await tx.wait();
}

const unlockAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
console.log(`locking LP balance ${formatUnits(lpBalance, 18)} until ${unlockAt}`);
const lockTx = await vault.lock(pairAddress, deployment.rocketTokenAddress, lpBalance, unlockAt, 0, unlockAt, unlockAt);
console.log(`vault lock tx ${lockTx.hash}`);
await lockTx.wait();

const finalPositionCount = await vault.positionCount();
console.log(`ROCKET V3 launch/liquidity seed ok positions=${finalPositionCount} pair=${pairAddress}`);
