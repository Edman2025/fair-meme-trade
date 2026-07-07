import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { verifyMessage } from "ethers";
import { eq, lt } from "drizzle-orm";
import { db } from "../db/client";
import { walletSessions } from "../db/schema";
import { env } from "../env";

export interface AuthUser {
  address: string;
  isAdmin: boolean;
}

export const makeNonce = () => crypto.randomBytes(24).toString("hex");

export const makeLoginMessage = (address: string, nonce: string) => [
  "Fair Meme Trade login",
  `Wallet: ${address}`,
  `Nonce: ${nonce}`,
  "This signature only proves wallet ownership.",
].join("\n");

export const issueToken = (address: string) => jwt.sign({ address: address.toLowerCase() }, env.jwtSecret, { expiresIn: "7d" });

export const verifyToken = (token: string): AuthUser => {
  const payload = jwt.verify(token, env.jwtSecret) as { address: string };
  const address = payload.address.toLowerCase();
  return { address, isAdmin: env.adminWallets.includes(address) };
};

export const verifyWalletSignature = async (sessionId: number, signature: string) => {
  const now = new Date();
  await db.delete(walletSessions).where(lt(walletSessions.expiresAt, now));
  const [session] = await db.select().from(walletSessions).where(eq(walletSessions.id, sessionId)).limit(1);
  if (!session || session.consumedAt) {
    throw new Error("Invalid or consumed nonce");
  }
  if (session.expiresAt.getTime() <= now.getTime()) {
    throw new Error("Nonce expired");
  }
  const message = makeLoginMessage(session.address, session.nonce);
  let recovered = "";
  try {
    recovered = verifyMessage(message, signature).toLowerCase();
  } catch {
    throw new Error("Invalid wallet signature");
  }
  if (recovered !== session.address.toLowerCase()) {
    throw new Error("Signature does not match wallet");
  }
  await db.update(walletSessions).set({ consumedAt: new Date() }).where(eq(walletSessions.id, sessionId));
  return session.address.toLowerCase();
};

export const hashApiKey = (key: string) => crypto.createHash("sha256").update(key).digest("hex");
export const newApiKey = () => `fmt_${crypto.randomBytes(24).toString("base64url")}`;
