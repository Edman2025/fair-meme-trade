import { FastifyReply, FastifyRequest } from "fastify";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { apiAuditLogs, apiKeys } from "../db/schema";
import { hashApiKey, verifyToken } from "./auth";
import { assertRateLimit, RateLimitError } from "./rateLimiter";

export const getBearer = (request: FastifyRequest) => {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
};

export const isApiKeyRequest = (request: FastifyRequest) => {
  const token = getBearer(request);
  return Boolean(token?.startsWith("fmt_"));
};

export const requireUser = (request: FastifyRequest) => {
  const token = getBearer(request) || request.cookies.session;
  if (!token) throw new Error("Authentication required");
  return verifyToken(token);
};

export const requireAdmin = (request: FastifyRequest) => {
  const user = requireUser(request);
  if (!user.isAdmin) throw new Error("Admin wallet required");
  return user;
};

export const requireWalletWrite = async (request: FastifyRequest, walletAddress: string, apiScope?: string) => {
  if (isApiKeyRequest(request)) {
    if (!apiScope) throw new Error("Wallet signature required");
    return requireApiKeyScope(request, apiScope);
  }
  const user = requireUser(request);
  const normalizedWallet = walletAddress.toLowerCase();
  if (!user.isAdmin && user.address !== normalizedWallet) {
    throw new Error("Wallet signature does not match request wallet");
  }
  return user;
};

export const sendAuthError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof RateLimitError) {
    reply.code(429).send({ error: error.message });
    return;
  }
  reply.code(401).send({ error: error instanceof Error ? error.message : "Unauthorized" });
};

export const requireApiKeyScope = async (request: FastifyRequest, scope: string) => {
  const token = getBearer(request);
  if (!token) throw new Error("API key required");
  if (!token.startsWith("fmt_")) throw new Error("API key required");
  const [record] = await db.select().from(apiKeys).where(and(
    eq(apiKeys.keyHash, hashApiKey(token)),
    eq(apiKeys.active, true),
  )).limit(1);
  if (!record) {
    await assertRateLimit({
      namespace: "unknown-api-key",
      key: request.ip,
      limit: 20,
      windowMs: 60_000,
      message: "Too many invalid API key attempts",
    });
    throw new Error("API key scope denied");
  }
  if (!record.scopes.includes(scope)) {
    await db.insert(apiAuditLogs).values({
      apiKeyId: record.id,
      walletAddress: record.ownerAddress,
      path: request.url,
      method: request.method,
      scope,
      status: "rejected",
    });
    throw new Error("API key scope denied");
  }
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, record.id));
  await db.insert(apiAuditLogs).values({
    apiKeyId: record.id,
    walletAddress: record.ownerAddress,
    path: request.url,
    method: request.method,
    scope,
    status: "allowed",
  });
  return record;
};
