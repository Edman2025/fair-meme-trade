import { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { walletSessions } from "../db/schema";
import { issueToken, makeLoginMessage, makeNonce, verifyWalletSignature } from "../lib/auth";
import { assertRateLimit } from "../lib/rateLimiter";

export const registerAuthRoutes = async (app: FastifyInstance) => {
  app.post<{ Body: { address: string } }>("/api/auth/nonce", async (request, reply) => {
    try {
      await assertRateLimit({
        namespace: "auth-nonce",
        key: request.ip,
        limit: 12,
        windowMs: 60_000,
        message: "Too many login attempts, please retry in one minute",
      });
    } catch (error) {
      return reply.code(429).send({ error: error instanceof Error ? error.message : "Rate limited" });
    }
    const address = request.body.address.toLowerCase();
    const nonce = makeNonce();
    const [session] = await db.insert(walletSessions).values({
      address,
      nonce,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    }).returning();
    return { sessionId: session.id, nonce, message: makeLoginMessage(address, nonce) };
  });

  app.post<{ Body: { sessionId: number; signature: string } }>("/api/auth/verify", async (request, reply) => {
    let address = "";
    try {
      address = await verifyWalletSignature(request.body.sessionId, request.body.signature);
    } catch (error) {
      return reply.code(401).send({ error: error instanceof Error ? error.message : "Invalid wallet signature" });
    }
    const token = issueToken(address);
    reply.setCookie("session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return { token, address };
  });
};
