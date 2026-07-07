import { Interface, parseUnits } from "ethers";

export const FAIR_MEME_FACTORY_ABI = [
  "event TokenCreated(uint256 indexed projectId,address indexed token,address indexed creator,string symbol,string metadataURI)",
  "event ProjectReviewed(uint256 indexed projectId,uint8 status)",
  "event TradeRecorded(address indexed token,address indexed trader,bool isBuy,uint256 amountIn,uint256 amountOut)",
  "event LpAdded(address indexed token,address indexed provider,uint256 amount,address pairToken)",
  "function createToken(string name,string symbol,uint256 totalSupply,string metadataURI,address pairToken,uint256 lpDeadline) returns (uint256 projectId,address token)",
  "function reviewProject(uint256 projectId,bool approved)",
  "function markLaunched(uint256 projectId)",
  "function recordTrade(address token,bool isBuy,uint256 amountIn,uint256 amountOut)",
  "function addLp(address token,uint256 amount)",
] as const;

export const FAIR_MEME_FACTORY_V2_ABI = [
  "event TokenCreated(uint256 indexed projectId,address indexed token,address indexed creator,string name,string symbol,string metadataURI,address pairToken,uint256 totalSupply,uint256 lpDeadline)",
  "event ProjectReviewed(uint256 indexed projectId,address indexed reviewer,uint8 status,string note)",
  "event ProjectLaunched(uint256 indexed projectId,address indexed reviewer)",
  "event TradeRecorded(address indexed token,address indexed trader,bool isBuy,uint256 amountIn,uint256 amountOut,uint256 feeAmount)",
  "event LpAdded(address indexed token,address indexed provider,uint256 amount,address pairToken)",
  "function createToken(string name,string symbol,uint256 totalSupply,string metadataURI,address pairToken,uint256 lpDeadline) returns (uint256 projectId,address token)",
  "function reviewProject(uint256 projectId,bool approved,string note)",
  "function markLaunched(uint256 projectId)",
  "function recordTrade(address token,bool isBuy,uint256 amountIn,uint256 amountOut,uint256 feeAmount)",
  "function addLp(address token,uint256 amount)",
] as const;

export const FAIR_MEME_FACTORY_V3_ABI = [
  "event TokenCreated(uint256 indexed projectId,address indexed token,address indexed creator,string name,string symbol,string metadataURI,address pairToken,uint256 totalSupply,uint256 lpDeadline)",
  "event ProjectReviewed(uint256 indexed projectId,address indexed reviewer,uint8 status,string note)",
  "event ProjectLaunched(uint256 indexed projectId,address indexed reviewer)",
  "function createToken(string name,string symbol,uint256 totalSupply,string metadataURI,address pairToken,uint256 lpDeadline) returns (uint256 projectId,address token)",
  "function reviewProject(uint256 projectId,bool approved,string note)",
  "function markLaunched(uint256 projectId)",
] as const;

export const LP_LOCK_VAULT_ABI = [
  "event LpLocked(uint256 indexed positionId,address indexed owner,address indexed lpToken,uint256 amount,uint256 unlockAt)",
  "event LpWithdrawn(uint256 indexed positionId,address indexed owner,uint256 amount)",
  "function lock(address lpToken,uint256 amount,uint256 unlockAt) returns (uint256 positionId)",
  "function withdraw(uint256 positionId)",
] as const;

export const LP_LOCK_VAULT_V2_ABI = [
  "event LpLocked(uint256 indexed positionId,address indexed owner,address indexed lpToken,address projectToken,uint256 amount,uint256 unlockAt)",
  "event LpWithdrawn(uint256 indexed positionId,address indexed owner,address indexed lpToken,uint256 amount)",
  "function lock(address lpToken,address projectToken,uint256 amount,uint256 unlockAt) returns (uint256 positionId)",
  "function withdraw(uint256 positionId)",
  "function getOwnerPositions(address account) view returns (uint256[])",
] as const;

export const LP_LOCK_VAULT_V3_ABI = [
  "event LpLocked(uint256 indexed positionId,address indexed owner,address indexed lpToken,address projectToken,uint256 amount,uint256 unlockAt,uint8 releaseType,uint256 releaseStart,uint256 releaseEnd)",
  "event LpWithdrawn(uint256 indexed positionId,address indexed owner,address indexed lpToken,uint256 amount)",
  "function lock(address lpToken,address projectToken,uint256 amount,uint256 unlockAt,uint8 releaseType,uint256 releaseStart,uint256 releaseEnd) returns (uint256 positionId)",
  "function releasableAmount(uint256 positionId) view returns (uint256)",
  "function releaseAmount(uint256 positionId,uint256 amount)",
  "function withdraw(uint256 positionId)",
  "function getOwnerPositions(address account) view returns (uint256[])",
] as const;

export type FactoryVersion = "V1" | "V2" | "V3";

export const getFactoryAbi = (version: FactoryVersion = "V3") => {
  if (version === "V1") return FAIR_MEME_FACTORY_ABI;
  if (version === "V2") return FAIR_MEME_FACTORY_V2_ABI;
  return FAIR_MEME_FACTORY_V3_ABI;
};

export const buildMvpCalldata = (action: string, payload?: string) => {
  const encoded = new TextEncoder().encode(`${action}:${payload || ""}`);
  return `0x${Array.from(encoded).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

const parsePayload = (payload?: string) => {
  if (!payload) return {};
  try {
    return JSON.parse(payload) as Record<string, string | number | boolean>;
  } catch {
    return {};
  }
};

const toUnits = (value: string | number | boolean | undefined) => {
  const normalized = typeof value === "string" || typeof value === "number" ? String(value || "0") : "0";
  return parseUnits(normalized, 18);
};

export const buildFactoryCalldata = (action: string, tokenAddress?: string, payload?: string) => {
  const parsed = parsePayload(payload);
  const factoryVersion = (import.meta.env.VITE_FACTORY_VERSION || "V3") as FactoryVersion;
  const factoryInterface = new Interface(getFactoryAbi(factoryVersion));

  if (factoryVersion === "V3" && (action === "trade" || action === "addLp")) {
    return null;
  }

  if (action === "trade" && tokenAddress) {
    return factoryInterface.encodeFunctionData("recordTrade", [
      tokenAddress,
      parsed.side === "buy",
      toUnits(parsed.amount),
      0n,
      0n,
    ]);
  }

  if (action === "addLp" && tokenAddress) {
    return factoryInterface.encodeFunctionData("addLp", [
      tokenAddress,
      toUnits(parsed.amount),
    ]);
  }

  return null;
};
