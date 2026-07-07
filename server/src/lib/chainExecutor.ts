import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { db } from "../db/client";
import { chainTransactions } from "../db/schema";
import { env } from "../env";

const FACTORY_ABI = [
  "function reviewProject(uint256 projectId,bool approved,string note)",
  "function markLaunched(uint256 projectId)",
];

const COMMISSION_ABI = [
  "function depositFor(address wallet,address token,uint256 amount,string source)",
  "function reviewWithdrawal(uint256 withdrawalId,bool approved)",
  "function payWithdrawal(uint256 withdrawalId)",
];

const provider = new JsonRpcProvider(env.rpcUrl);

const getSigner = () => {
  if (!env.deployerPrivateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY missing on server");
  }
  return new Wallet(env.deployerPrivateKey, provider);
};

const insertSubmittedTx = async (params: {
  txHash: string;
  action: string;
  tokenAddress?: string;
  walletAddress?: string;
  payload?: unknown;
}) => {
  const [record] = await db.insert(chainTransactions).values({
    txHash: params.txHash,
    action: params.action,
    tokenAddress: params.tokenAddress,
    walletAddress: params.walletAddress?.toLowerCase(),
    status: "submitted",
    payload: params.payload,
  }).onConflictDoUpdate({
    target: chainTransactions.txHash,
    set: {
      status: "submitted",
      payload: params.payload,
      updatedAt: new Date(),
    },
  }).returning();
  return record;
};

export const reviewProjectOnChain = async (projectId: number, approved: boolean, note = "") => {
  const contract = new Contract(env.factoryAddress, FACTORY_ABI, getSigner());
  const tx = await contract.reviewProject(projectId, approved, note);
  await insertSubmittedTx({
    txHash: tx.hash,
    action: approved ? "adminReviewProjectApprove" : "adminReviewProjectReject",
    payload: { projectId, approved, note },
  });
  return tx.hash as string;
};

export const markProjectLaunchedOnChain = async (projectId: number, note = "") => {
  const contract = new Contract(env.factoryAddress, FACTORY_ABI, getSigner());
  const tx = await contract.markLaunched(projectId);
  await insertSubmittedTx({
    txHash: tx.hash,
    action: "adminProjectLaunch",
    payload: { projectId, note },
  });
  return tx.hash as string;
};

export const depositCommissionOnChain = async (walletAddress: string, tokenAddress: string, amount: bigint, source: string) => {
  const contract = new Contract(env.commissionVaultAddress, COMMISSION_ABI, getSigner());
  const tx = await contract.depositFor(walletAddress, tokenAddress, amount, source);
  await insertSubmittedTx({
    txHash: tx.hash,
    action: "commissionDeposit",
    tokenAddress,
    walletAddress,
    payload: { walletAddress, tokenAddress, amount: amount.toString(), source },
  });
  return tx.hash as string;
};

export const reviewWithdrawalOnChain = async (withdrawalId: number, approved: boolean) => {
  const contract = new Contract(env.commissionVaultAddress, COMMISSION_ABI, getSigner());
  const tx = await contract.reviewWithdrawal(withdrawalId, approved);
  await insertSubmittedTx({
    txHash: tx.hash,
    action: approved ? "adminReviewWithdrawalApprove" : "adminReviewWithdrawalReject",
    payload: { withdrawalId, approved },
  });
  return tx.hash as string;
};

export const payWithdrawalOnChain = async (withdrawalId: number) => {
  const contract = new Contract(env.commissionVaultAddress, COMMISSION_ABI, getSigner());
  const tx = await contract.payWithdrawal(withdrawalId);
  await insertSubmittedTx({
    txHash: tx.hash,
    action: "adminPayWithdrawal",
    payload: { withdrawalId },
  });
  return tx.hash as string;
};
