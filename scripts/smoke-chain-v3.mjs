import { readFileSync } from "node:fs";
import { Contract, JsonRpcProvider, ZeroAddress, formatUnits } from "ethers";

const deploymentPath = process.env.DEPLOYMENT_FILE || "contracts/deployments.bsc-testnet.v3.json";
const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
const rpcUrl = process.env.VITE_RPC_URL || process.env.BSC_TESTNET_RPC_URL || deployment.rpcUrl;

const FACTORY_ABI = [
  "function owner() view returns (address)",
  "function admins(address) view returns (bool)",
  "function projectCount() view returns (uint256)",
  "function projects(uint256) view returns (address token,address creator,string name,string symbol,string metadataURI,address pairToken,uint256 totalSupply,uint256 createdAt,uint256 lpDeadline,uint8 status)",
  "function projectIdByToken(address) view returns (uint256)",
];

const VAULT_ABI = [
  "function owner() view returns (address)",
  "function positionCount() view returns (uint256)",
];

const COMMISSION_ABI = [
  "function owner() view returns (address)",
  "function admins(address) view returns (bool)",
  "function withdrawalCount() view returns (uint256)",
];

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function creator() view returns (address)",
  "function factory() view returns (address)",
];

const PANCAKE_FACTORY_ABI = [
  "function getPair(address tokenA,address tokenB) view returns (address pair)",
];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sameAddress = (left, right) => String(left).toLowerCase() === String(right).toLowerCase();
const isNonZeroCode = async (provider, address, label) => {
  const code = await provider.getCode(address);
  assert(code && code !== "0x", `${label} has no bytecode at ${address}`);
  return code.length;
};

const provider = new JsonRpcProvider(rpcUrl);
const latestBlock = await provider.getBlockNumber();
assert(latestBlock > 0, "RPC did not return a latest block");
console.log(`rpc ok block=${latestBlock}`);

await isNonZeroCode(provider, deployment.factoryAddress, "FairMemeFactoryV3");
await isNonZeroCode(provider, deployment.lpVaultAddress, "LpLockVaultV3");
await isNonZeroCode(provider, deployment.commissionVaultAddress, "CommissionVault");
await isNonZeroCode(provider, deployment.rocketTokenAddress, "ROCKET token");

const factory = new Contract(deployment.factoryAddress, FACTORY_ABI, provider);
const vault = new Contract(deployment.lpVaultAddress, VAULT_ABI, provider);
const commission = new Contract(deployment.commissionVaultAddress, COMMISSION_ABI, provider);
const rocket = new Contract(deployment.rocketTokenAddress, ERC20_ABI, provider);

const [factoryOwner, factoryAdmin, projectCount, project, projectIdByToken] = await Promise.all([
  factory.owner(),
  factory.admins(deployment.adminWallet),
  factory.projectCount(),
  factory.projects(BigInt(deployment.rocketProjectId || 1)),
  factory.projectIdByToken(deployment.rocketTokenAddress),
]);

assert(sameAddress(factoryOwner, deployment.deployer), `factory owner mismatch: ${factoryOwner}`);
assert(factoryAdmin === true || sameAddress(factoryOwner, deployment.adminWallet), "admin wallet is not factory admin/owner");
assert(projectCount >= BigInt(deployment.rocketProjectId || 1), `projectCount too low: ${projectCount}`);
assert(sameAddress(project.token, deployment.rocketTokenAddress), `project token mismatch: ${project.token}`);
assert(project.symbol === "ROCKET", `project symbol mismatch: ${project.symbol}`);
assert(projectIdByToken === BigInt(deployment.rocketProjectId || 1), `projectIdByToken mismatch: ${projectIdByToken}`);

const [tokenName, tokenSymbol, decimals, totalSupply, tokenCreator, tokenFactory] = await Promise.all([
  rocket.name(),
  rocket.symbol(),
  rocket.decimals(),
  rocket.totalSupply(),
  rocket.creator(),
  rocket.factory(),
]);

assert(tokenSymbol === "ROCKET", `token symbol mismatch: ${tokenSymbol}`);
assert(tokenName.length > 0, "token name empty");
assert(decimals === 18n || decimals === 18, `token decimals mismatch: ${decimals}`);
assert(totalSupply > 0n, "token totalSupply is zero");
assert(sameAddress(tokenCreator, project.creator), `token creator mismatch: ${tokenCreator} vs ${project.creator}`);
assert(sameAddress(tokenFactory, deployment.factoryAddress), `token factory mismatch: ${tokenFactory}`);

const [vaultOwner, positionCount, commissionOwner, commissionAdmin, withdrawalCount] = await Promise.all([
  vault.owner(),
  vault.positionCount(),
  commission.owner(),
  commission.admins(deployment.adminWallet),
  commission.withdrawalCount(),
]);

assert(sameAddress(vaultOwner, deployment.deployer), `vault owner mismatch: ${vaultOwner}`);
assert(sameAddress(commissionOwner, deployment.deployer), `commission owner mismatch: ${commissionOwner}`);
assert(commissionAdmin === true || sameAddress(commissionOwner, deployment.adminWallet), "admin wallet is not commission admin/owner");

let pairAddress = ZeroAddress;
const pancakeFactoryAddress = process.env.VITE_PANCAKE_FACTORY_ADDRESS || "0x6725F303b657a9451d8BA641348b6761A6CC7a17";
const wbnbAddress = process.env.VITE_WBNB_ADDRESS || "0xae13d989dac2f0debff460ac112a837c89baa7cd";
try {
  const pancakeFactory = new Contract(pancakeFactoryAddress, PANCAKE_FACTORY_ABI, provider);
  pairAddress = await pancakeFactory.getPair(deployment.rocketTokenAddress, wbnbAddress);
} catch (error) {
  console.warn(`pancake pair lookup skipped: ${error instanceof Error ? error.message : String(error)}`);
}

assert(Number(project.status) === 2, `ROCKET project should be launched, got status=${project.status}`);
assert(positionCount > 0n, "LP vault should contain at least one locked position");
assert(pairAddress !== ZeroAddress, "Pancake pair should exist for ROCKET/WBNB");

console.log(JSON.stringify({
  factory: deployment.factoryAddress,
  lpVault: deployment.lpVaultAddress,
  commissionVault: deployment.commissionVaultAddress,
  rocketToken: deployment.rocketTokenAddress,
  rocketProjectId: String(projectIdByToken),
  rocketTotalSupply: formatUnits(totalSupply, Number(decimals)),
  projectStatus: Number(project.status),
  lpPositionCount: String(positionCount),
  withdrawalCount: String(withdrawalCount),
  pancakePair: pairAddress,
}, null, 2));

console.log("chain v3 smoke ok");
