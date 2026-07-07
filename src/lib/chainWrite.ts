import { Interface, ZeroAddress, parseUnits } from "ethers";
import { bscTestnetConfig } from "@/lib/chainConfig";
import { getFactoryAbi } from "@/lib/contractAbi";
import { ensureWalletChain, sendValueTransaction } from "@/lib/walletAdapter";

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

  return sendValueTransaction({
    to: bscTestnetConfig.factoryAddress,
    valueHex: "0x0",
    data,
  });
};
