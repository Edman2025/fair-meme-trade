import { Interface, parseUnits } from "ethers";
import { bscTestnetConfig, isAddress } from "@/lib/chainConfig";
import { ensureWalletChain, requestAccounts, sendValueTransaction } from "@/lib/walletAdapter";

const COMMISSION_VAULT_ABI = [
  "function requestWithdrawal(address token,uint256 amount) returns (uint256 withdrawalId)",
] as const;

const commissionVaultInterface = new Interface(COMMISSION_VAULT_ABI);

export const requestCommissionVaultWithdrawal = async (tokenAddress: string, amount: string) => {
  if (!isAddress(bscTestnetConfig.commissionVaultAddress)) {
    throw new Error("CommissionVault 合约地址未配置");
  }
  if (!isAddress(tokenAddress)) {
    throw new Error("提现 token 地址无效");
  }
  const amountWei = parseUnits(amount || "0", 18);
  if (amountWei <= 0n) {
    throw new Error("请输入有效提现金额");
  }

  await ensureWalletChain(bscTestnetConfig);
  await requestAccounts();
  const data = commissionVaultInterface.encodeFunctionData("requestWithdrawal", [tokenAddress, amountWei]);
  return sendValueTransaction({
    to: bscTestnetConfig.commissionVaultAddress!,
    data,
  });
};
