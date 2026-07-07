import { FastifyInstance, FastifyReply } from "fastify";
import { and, asc, desc, eq } from "drizzle-orm";
import { parseUnits } from "ethers";
import { db } from "../db/client";
import { apiKeys, chainTransactions, commissions, indexedEvents, indexerState, lpPositions, nodeApplications, orders, reviewQueue, tokens, withdrawals } from "../db/schema";
import { depositCommissionOnChain, markProjectLaunchedOnChain, payWithdrawalOnChain, reviewProjectOnChain, reviewWithdrawalOnChain } from "../lib/chainExecutor";
import { hashApiKey, newApiKey } from "../lib/auth";
import { isApiKeyRequest, requireAdmin, requireApiKeyScope, requireUser, requireWalletWrite, sendAuthError } from "../lib/http";
import { env } from "../env";
import { getHolderAnalytics } from "../lib/holderAnalytics";

const sendRouteError = (reply: FastifyReply, error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("Authentication required") || message.includes("Admin wallet required") || message.includes("jwt")) {
    return reply.code(401).send({ error: message });
  }
  return reply.code(500).send({ error: message });
};

export const registerCoreRoutes = async (app: FastifyInstance) => {
  app.get("/api/health", async () => ({ ok: true, service: "fair-meme-trade-api" }));

  app.get("/api/tokens", async (request, reply) => {
    if (isApiKeyRequest(request)) {
      try {
        await requireApiKeyScope(request, "read");
      } catch (error) {
        return sendAuthError(reply, error);
      }
    }
    return db.select().from(tokens).orderBy(desc(tokens.createdAt));
  });
  app.get<{ Params: { symbol: string } }>("/api/tokens/:symbol", async (request, reply) => {
    const [token] = await db.select().from(tokens).where(eq(tokens.symbol, request.params.symbol.toUpperCase())).limit(1);
    if (!token) return reply.code(404).send({ error: "Token not found" });
    return token;
  });
  app.get<{ Params: { symbol: string }; Querystring: { limit?: string } }>("/api/tokens/:symbol/holders", async (request, reply) => {
    const [token] = await db.select().from(tokens).where(eq(tokens.symbol, request.params.symbol.toUpperCase())).limit(1);
    if (!token) return reply.code(404).send({ error: "Token not found" });
    const [creationEvent] = await db.select().from(indexedEvents).where(and(
      eq(indexedEvents.tokenAddress, token.tokenAddress),
      eq(indexedEvents.eventName, "TokenCreated"),
    )).orderBy(asc(indexedEvents.blockNumber)).limit(1);
    const fromBlock = creationEvent?.blockNumber || Math.max(0, Number(token.projectId || 0));
    try {
      return await getHolderAnalytics({
        tokenAddress: token.tokenAddress,
        fromBlock,
        limit: Number(request.query.limit || 10),
        candidateAddresses: [token.creatorAddress],
      });
    } catch (error) {
      return sendRouteError(reply, error, "Holder analytics failed");
    }
  });

  app.post<{ Body: { txHash: string; action: string; tokenAddress?: string; walletAddress?: string; status?: string; payload?: unknown } }>("/api/chain-transactions", async (request, reply) => {
    try {
      if (!request.body.walletAddress) throw new Error("walletAddress is required");
      await requireWalletWrite(request, request.body.walletAddress, "trade");
    } catch (error) {
      return sendAuthError(reply, error);
    }
    const [tx] = await db.insert(chainTransactions).values({
      txHash: request.body.txHash,
      action: request.body.action,
      tokenAddress: request.body.tokenAddress,
      walletAddress: request.body.walletAddress?.toLowerCase(),
      status: request.body.status || "submitted",
      payload: request.body.payload,
    }).onConflictDoUpdate({
      target: chainTransactions.txHash,
      set: { status: request.body.status || "submitted", payload: request.body.payload, updatedAt: new Date() },
    }).returning();
    return tx;
  });

  app.get("/api/chain-transactions", async () => db.select().from(chainTransactions).orderBy(desc(chainTransactions.createdAt)));
  app.get("/api/indexed-events", async () => db.select().from(indexedEvents).orderBy(desc(indexedEvents.blockNumber), desc(indexedEvents.logIndex)));
  app.get("/api/indexer/status", async () => {
    const activeAddresses = new Set([env.factoryAddress, env.lpVaultAddress, env.commissionVaultAddress].filter(Boolean).map((address) => address.toLowerCase()));
    const states = (await db.select().from(indexerState)).filter((state) => activeAddresses.has(state.contractAddress.toLowerCase()));
    const latestSeen = Math.max(0, ...states.map((state) => state.latestSeenBlock));
    return states.map((state) => ({
      ...state,
      lagBlocks: Math.max(0, latestSeen - state.lastIndexedBlock),
      rpcUrl: env.rpcUrl,
    }));
  });

  app.get<{ Querystring: { owner?: string } }>("/api/lp-positions", async (request) => {
    if (request.query.owner) {
      return db.select().from(lpPositions).where(eq(lpPositions.ownerAddress, request.query.owner.toLowerCase())).orderBy(desc(lpPositions.createdAt));
    }
    return db.select().from(lpPositions).orderBy(desc(lpPositions.createdAt));
  });

  app.get<{ Querystring: { wallet?: string } }>("/api/commissions", async (request) => {
    if (request.query.wallet) {
      return db.select().from(commissions).where(eq(commissions.walletAddress, request.query.wallet.toLowerCase())).orderBy(desc(commissions.createdAt));
    }
    return db.select().from(commissions).orderBy(desc(commissions.createdAt));
  });

  app.get<{ Querystring: { wallet?: string } }>("/api/ledger/commissions", async (request) => {
    const rows = request.query.wallet
      ? await db.select().from(commissions).where(eq(commissions.walletAddress, request.query.wallet.toLowerCase())).orderBy(desc(commissions.createdAt))
      : await db.select().from(commissions).orderBy(desc(commissions.createdAt));
    const withdrawalRows = request.query.wallet
      ? await db.select().from(withdrawals).where(eq(withdrawals.walletAddress, request.query.wallet.toLowerCase())).orderBy(desc(withdrawals.createdAt))
      : await db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt));
    const totals = rows.reduce<Record<string, { deposited: number; available: number; pending: number; paid: number; rejected: number }>>((acc, row) => {
      const key = row.tokenAddress.toLowerCase();
      acc[key] ||= { deposited: 0, available: 0, pending: 0, paid: 0, rejected: 0 };
      const amount = Number(row.amount);
      acc[key].deposited += amount;
      acc[key].available += amount;
      return acc;
    }, {});
    for (const withdrawal of withdrawalRows) {
      const key = withdrawal.tokenAddress.toLowerCase();
      totals[key] ||= { deposited: 0, available: 0, pending: 0, paid: 0, rejected: 0 };
      const amount = Number(withdrawal.amount);
      if (withdrawal.status === "completed") {
        totals[key].paid += amount;
        totals[key].available -= amount;
      } else if (withdrawal.status === "rejected" || withdrawal.status === "failed") {
        totals[key].rejected += amount;
      } else {
        totals[key].pending += amount;
        totals[key].available -= amount;
      }
      totals[key].available = Math.max(0, Number(totals[key].available.toFixed(12)));
    }
    return { rows, withdrawals: withdrawalRows, totals };
  });

  app.get<{ Querystring: { wallet?: string } }>("/api/withdrawals", async (request) => {
    if (request.query.wallet) {
      return db.select().from(withdrawals).where(eq(withdrawals.walletAddress, request.query.wallet.toLowerCase())).orderBy(desc(withdrawals.createdAt));
    }
    return db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt));
  });

  app.get<{ Querystring: { wallet?: string } }>("/api/node-applications", async (request) => {
    if (request.query.wallet) {
      return db.select().from(nodeApplications).where(eq(nodeApplications.walletAddress, request.query.wallet.toLowerCase())).orderBy(desc(nodeApplications.createdAt));
    }
    return db.select().from(nodeApplications).orderBy(desc(nodeApplications.createdAt));
  });

  app.get("/api/admin/review-queue", async (request, reply) => {
    try {
      requireAdmin(request);
      return db.select().from(reviewQueue).orderBy(desc(reviewQueue.createdAt));
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.post<{ Params: { id: string }; Body: { note?: string } }>("/api/admin/review-queue/:id/approve", async (request, reply) => {
    try {
      const user = requireAdmin(request);
      const [currentItem] = await db.select().from(reviewQueue).where(eq(reviewQueue.id, Number(request.params.id))).limit(1);
      if (!currentItem) return reply.code(404).send({ error: "Review item not found" });
      let txHash: string | undefined;
      if (currentItem.type === "token") {
        const projectId = Number(currentItem.targetId) || (await db.select().from(tokens).where(eq(tokens.symbol, currentItem.targetId.toUpperCase())).limit(1))[0]?.projectId;
        if (!projectId) return reply.code(400).send({ error: "Token projectId not found" });
        txHash = await reviewProjectOnChain(projectId, true, request.body.note || "");
        await db.update(tokens).set({ status: "submitted" }).where(eq(tokens.projectId, projectId));
      }
      if (currentItem.type === "withdrawal") {
        const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.id, Number(currentItem.targetId))).limit(1);
        if (!withdrawal?.chainWithdrawalId) return reply.code(400).send({ error: "Withdrawal is not linked to an on-chain CommissionVault withdrawalId" });
        txHash = await reviewWithdrawalOnChain(withdrawal.chainWithdrawalId, true);
      }
      const [item] = await db.update(reviewQueue).set({
        status: txHash ? "submitted" : "approved",
        reviewerAddress: user.address,
        reviewerNote: request.body.note,
        txHash,
        reviewedAt: new Date(),
      }).where(eq(reviewQueue.id, Number(request.params.id))).returning();
      if (currentItem.type === "node") {
        await db.update(nodeApplications).set({ status: "approved", reviewedAt: new Date() }).where(eq(nodeApplications.id, Number(currentItem.targetId)));
      }
      return item;
    } catch (error) {
      return sendRouteError(reply, error, "Approve failed");
    }
  });

  app.post<{ Params: { id: string }; Body: { note?: string } }>("/api/admin/review-queue/:id/reject", async (request, reply) => {
    try {
      const user = requireAdmin(request);
      const [currentItem] = await db.select().from(reviewQueue).where(eq(reviewQueue.id, Number(request.params.id))).limit(1);
      if (!currentItem) return reply.code(404).send({ error: "Review item not found" });
      let txHash: string | undefined;
      if (currentItem.type === "token") {
        const projectId = Number(currentItem.targetId) || (await db.select().from(tokens).where(eq(tokens.symbol, currentItem.targetId.toUpperCase())).limit(1))[0]?.projectId;
        if (!projectId) return reply.code(400).send({ error: "Token projectId not found" });
        txHash = await reviewProjectOnChain(projectId, false, request.body.note || "");
        await db.update(tokens).set({ status: "submitted" }).where(eq(tokens.projectId, projectId));
      }
      if (currentItem.type === "withdrawal") {
        const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.id, Number(currentItem.targetId))).limit(1);
        if (!withdrawal?.chainWithdrawalId) return reply.code(400).send({ error: "Withdrawal is not linked to an on-chain CommissionVault withdrawalId" });
        txHash = await reviewWithdrawalOnChain(withdrawal.chainWithdrawalId, false);
      }
      const [item] = await db.update(reviewQueue).set({
        status: txHash ? "submitted" : "rejected",
        reviewerAddress: user.address,
        reviewerNote: request.body.note,
        txHash,
        reviewedAt: new Date(),
      }).where(eq(reviewQueue.id, Number(request.params.id))).returning();
      if (currentItem.type === "node") {
        await db.update(nodeApplications).set({ status: "rejected", reviewedAt: new Date() }).where(eq(nodeApplications.id, Number(currentItem.targetId)));
      }
      return item;
    } catch (error) {
      return sendRouteError(reply, error, "Reject failed");
    }
  });

  app.post<{ Params: { projectId: string }; Body: { note?: string } }>("/api/admin/projects/:projectId/launch", async (request, reply) => {
    try {
      requireAdmin(request);
      const projectId = Number(request.params.projectId);
      const [token] = await db.select().from(tokens).where(eq(tokens.projectId, projectId)).limit(1);
      if (!token) return reply.code(404).send({ error: "Project not found" });
      if (token.status !== "pending") {
        return reply.code(400).send({ error: `Project must be approved before launch; current status is ${token.status}` });
      }
      const txHash = await markProjectLaunchedOnChain(projectId, request.body.note || "");
      await db.update(tokens).set({ status: "submitted" }).where(eq(tokens.projectId, projectId));
      return { txHash, projectId, status: "submitted" };
    } catch (error) {
      return sendRouteError(reply, error, "Launch failed");
    }
  });

  app.post<{ Params: { id: string } }>("/api/admin/withdrawals/:id/pay", async (request, reply) => {
    try {
      requireAdmin(request);
      const dbWithdrawalId = Number(request.params.id);
      const [withdrawal] = await db.select().from(withdrawals).where(eq(withdrawals.id, dbWithdrawalId)).limit(1);
      if (!withdrawal?.chainWithdrawalId) return reply.code(400).send({ error: "Withdrawal is not linked to an on-chain CommissionVault withdrawalId" });
      if (withdrawal.status !== "approved" && withdrawal.status !== "submitted") {
        return reply.code(400).send({ error: `Withdrawal must be approved before payment; current status is ${withdrawal.status}` });
      }
      const txHash = await payWithdrawalOnChain(withdrawal.chainWithdrawalId);
      await db.update(withdrawals).set({ status: "submitted", txHash }).where(eq(withdrawals.id, dbWithdrawalId));
      return { txHash, withdrawalId: dbWithdrawalId, chainWithdrawalId: withdrawal.chainWithdrawalId, status: "submitted" };
    } catch (error) {
      return sendRouteError(reply, error, "Payment failed");
    }
  });

  app.post<{ Body: { name: string; scopes?: string[] } }>("/api/api-keys", async (request, reply) => {
    try {
      const user = requireUser(request);
      const key = newApiKey();
      const [record] = await db.insert(apiKeys).values({
        ownerAddress: user.address,
        name: request.body.name,
        keyHash: hashApiKey(key),
        prefix: key.slice(0, 10),
        scopes: request.body.scopes || ["read", "trade"],
      }).returning();
      return { ...record, key };
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.delete<{ Params: { id: string } }>("/api/api-keys/:id", async (request, reply) => {
    try {
      const user = requireUser(request);
      const [record] = await db.update(apiKeys).set({ active: false }).where(and(
        eq(apiKeys.id, Number(request.params.id)),
        eq(apiKeys.ownerAddress, user.address),
      )).returning();
      if (!record) return reply.code(404).send({ error: "API key not found" });
      return record;
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.post<{ Body: { walletAddress: string } }>("/api/node-applications", async (request, reply) => {
    try {
      await requireWalletWrite(request, request.body.walletAddress);
    } catch (error) {
      return sendAuthError(reply, error);
    }
    const [application] = await db.insert(nodeApplications).values({ walletAddress: request.body.walletAddress.toLowerCase() }).returning();
    await db.insert(reviewQueue).values({
      type: "node",
      targetId: String(application.id),
      title: `节点申请: ${request.body.walletAddress}`,
    });
    return application;
  });

  app.post<{ Body: { walletAddress: string; amount: string; tokenAddress: string } }>("/api/withdrawals", async (request, reply) => {
    const walletAddress = request.body.walletAddress.toLowerCase();
    try {
      await requireWalletWrite(request, walletAddress);
    } catch (error) {
      return sendAuthError(reply, error);
    }
    return reply.code(400).send({
      error: "Withdrawal requests must be submitted on-chain with CommissionVault.requestWithdrawal; the indexer will create the backend withdrawal record.",
    });
  });

  app.post<{ Body: { walletAddress: string; tokenAddress: string; amount: string; source?: string } }>("/api/commission-deposits", async (request, reply) => {
    try {
      if (isApiKeyRequest(request)) {
        await requireApiKeyScope(request, "admin");
      } else {
        requireAdmin(request);
      }
      const amount = parseUnits(request.body.amount, 18);
      const source = request.body.source || "server";
      const txHash = await depositCommissionOnChain(
        request.body.walletAddress.toLowerCase(),
        request.body.tokenAddress,
        amount,
        source,
      );
      return { txHash, status: "submitted" };
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.post<{ Body: { walletAddress: string; tokenAddress: string; orderType: string; side: string; amount: string; triggerPrice?: string; trailingPercent?: string; payload?: unknown } }>("/api/orders", async (request, reply) => {
    try {
      await requireWalletWrite(request, request.body.walletAddress, "trade");
      const [order] = await db.insert(orders).values({
        walletAddress: request.body.walletAddress.toLowerCase(),
        tokenAddress: request.body.tokenAddress,
        orderType: request.body.orderType,
        side: request.body.side,
        amount: request.body.amount,
        triggerPrice: request.body.triggerPrice,
        trailingPercent: request.body.trailingPercent,
        payload: request.body.payload,
      }).returning();
      return order;
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.get<{ Querystring: { wallet?: string } }>("/api/orders", async (request) => {
    if (request.query.wallet) {
      return db.select().from(orders).where(eq(orders.walletAddress, request.query.wallet.toLowerCase())).orderBy(desc(orders.createdAt));
    }
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  });
};
