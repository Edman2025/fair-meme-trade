import { Interface, ZeroAddress, parseUnits } from "ethers";
import { bscTestnetConfig } from "@/lib/chainConfig";
import { getFactoryAbi } from "@/lib/contractAbi";
import { ensureWalletChain, sendValueTransaction, waitForTransactionReceipt } from "@/lib/walletAdapter";

export interface CreateTokenOnChainInput {
  name: string;
  symbol: string;
  totalSupply: string;
  metadataURI: string;
  pairToken?: string;
  lpDeadline: Date;
}

export const createTokenOnChain = async (input: CreateTokenOnChainInput) => {
  if (!bscTestnetConfig.factoryAddress) {
    throw new Error("Factory address is not configured");
  }

  await ensureWalletChain(bscTestnetConfig);
  const factoryInterface = new Interface(getFactoryAbi(bscTestnetConfig.factoryVersion));
  const data = factoryInterface.encodeFunctionData("createToken", [
    input.name,
    input.symbol.toUpperCase(),
    parseUnits(input.totalSupply, 18),
    input.metadataURI,
    input.pairToken || ZeroAddress,
    Math.floor(input.lpDeadline.getTime() / 1000),
  ]);

  const transaction = await sendValueTransaction({
    to: bscTestnetConfig.factoryAddress,
    valueHex: "0x0",
    data,
  });
  const receipt = await waitForTransactionReceipt(transaction.txHash);
  let tokenAddress = "";
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== bscTestnetConfig.factoryAddress.toLowerCase()) continue;
    try {
      const parsed = factoryInterface.parseLog(log);
      if (parsed?.name === "TokenCreated") {
        tokenAddress = String(parsed.args.token);
        break;
      }
    } catch {
      // Ignore unrelated Factory logs.
    }
  }
  if (!tokenAddress) throw new Error(`代币已创建，但无法从交易回执解析 TokenCreated：${transaction.txHash}`);
  return { ...transaction, receipt, tokenAddress };
};
