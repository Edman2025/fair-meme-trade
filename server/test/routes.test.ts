import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 15_000 });

const mocks = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  insertReturns: [] as unknown[][],
  updateReturns: [] as unknown[][],
  insertCalls: [] as unknown[],
  updateCalls: [] as unknown[],
  chainCalls: [] as unknown[],
  holderCalls: [] as unknown[],
}));

const makeQuery = (result: unknown[]) => ({
  where: () => ({
    limit: async () => result,
    orderBy: () => ({
      limit: async () => result,
      then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
    }),
  }),
  orderBy: () => ({
    limit: async () => result,
    then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  }),
  limit: async () => result,
  then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
});

vi.mock("../src/db/client", () => ({
  db: {
    select: () => ({
      from: () => makeQuery(mocks.selectResults.shift() || []),
    }),
    insert: () => ({
      values: (value: unknown) => {
        mocks.insertCalls.push(value);
        return {
          returning: async () => mocks.insertReturns.shift() || [value],
          onConflictDoNothing: () => ({ returning: async () => mocks.insertReturns.shift() || [value] }),
          onConflictDoUpdate: () => ({ returning: async () => mocks.insertReturns.shift() || [value] }),
        };
      },
    }),
    update: () => ({
      set: (value: unknown) => {
        mocks.updateCalls.push(value);
        return {
          where: () => ({
            returning: async () => mocks.updateReturns.shift() || [value],
            then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve([]).then(resolve, reject),
          }),
        };
      },
    }),
    delete: () => ({ where: async () => [] }),
    transaction: async (callback: (tx: unknown) => unknown) => callback({
      insert: () => ({
        values: (value: unknown) => ({
          returning: async () => mocks.insertReturns.shift() || [value],
        }),
      }),
    }),
  },
}));

vi.mock("../src/env", () => ({
  env: {
    port: 3001,
    databaseUrl: "postgres://test",
    jwtSecret: "test-secret",
    adminWallet: "0xadmin",
    adminWallets: ["0xadmin", "0xsecondadmin"],
    deployerPrivateKey: "",
    rpcUrl: "https://bsc-testnet-rpc.publicnode.com",
    factoryAddress: "0xfactory",
    lpVaultAddress: "0xvault",
    commissionVaultAddress: "0xcommission",
  },
}));

vi.mock("../src/lib/chainExecutor", () => ({
  depositCommissionOnChain: async (...args: unknown[]) => {
    mocks.chainCalls.push({ fn: "depositCommissionOnChain", args });
    return "0xdeposit";
  },
  markProjectLaunchedOnChain: async (...args: unknown[]) => {
    mocks.chainCalls.push({ fn: "markProjectLaunchedOnChain", args });
    return "0xlaunch";
  },
  payWithdrawalOnChain: async (...args: unknown[]) => {
    mocks.chainCalls.push({ fn: "payWithdrawalOnChain", args });
    return "0xpay";
  },
  reviewProjectOnChain: async (...args: unknown[]) => {
    mocks.chainCalls.push({ fn: "reviewProjectOnChain", args });
    return "0xreview";
  },
  reviewWithdrawalOnChain: async (...args: unknown[]) => {
    mocks.chainCalls.push({ fn: "reviewWithdrawalOnChain", args });
    return "0xwithdrawalreview";
  },
}));

vi.mock("../src/lib/holderAnalytics", () => ({
  getHolderAnalytics: async (params: unknown) => {
    mocks.holderCalls.push(params);
    return {
      tokenAddress: "0xtoken",
      holderCount: 1,
      totalSupply: "1000.0",
      totalSupplyRaw: "1000000000000000000000",
      decimals: 18,
      latestBlock: 123,
      scannedFromBlock: 100,
      scannedToBlock: 123,
      truncated: false,
      holders: [{
        rank: 1,
        address: "0xabc",
        balance: "1000.0",
        balanceRaw: "1000000000000000000000",
        percent: 100,
      }],
    };
  },
}));

describe("server routes", () => {
  beforeEach(async () => {
    mocks.selectResults.length = 0;
    mocks.insertReturns.length = 0;
    mocks.updateReturns.length = 0;
    mocks.insertCalls.length = 0;
    mocks.updateCalls.length = 0;
    mocks.chainCalls.length = 0;
    mocks.holderCalls.length = 0;
    const { resetRateLimiterForTests } = await import("../src/lib/rateLimiter");
    resetRateLimiterForTests();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates auth nonces with an explicit expiry", async () => {
    const { buildApp } = await import("../src/app");
    const app = await buildApp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    mocks.insertReturns.push([{ id: 7, address: "0xabc", nonce: "nonce", expiresAt }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/nonce",
      payload: { address: "0xABC" },
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.insertCalls[0]).toMatchObject({ address: "0xabc" });
    expect((mocks.insertCalls[0] as { expiresAt?: Date }).expiresAt).toBeInstanceOf(Date);
    await app.close();
  });

  it("rate-limits auth nonce creation per client address", async () => {
    const { buildApp } = await import("../src/app");
    const app = await buildApp();

    let response = await app.inject({
      method: "POST",
      url: "/api/auth/nonce",
      payload: { address: "0xABC" },
    });
    expect(response.statusCode).toBe(200);

    for (let index = 0; index < 11; index += 1) {
      response = await app.inject({
        method: "POST",
        url: "/api/auth/nonce",
        payload: { address: "0xABC" },
      });
      expect(response.statusCode).toBe(200);
    }

    response = await app.inject({
      method: "POST",
      url: "/api/auth/nonce",
      payload: { address: "0xABC" },
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({
      error: expect.stringContaining("Too many login attempts"),
    });
    expect(mocks.insertCalls).toHaveLength(12);
    await app.close();
  });

  it("returns 401 for malformed wallet signatures without consuming the nonce", async () => {
    const { buildApp } = await import("../src/app");
    const app = await buildApp();
    mocks.selectResults.push([{
      id: 3,
      address: "0x5a3a9252f4c841214210e525f3b1d01974e96682",
      nonce: "nonce",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
    }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/verify",
      payload: {
        sessionId: 3,
        signature: "0x" + "2".repeat(130),
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "Invalid wallet signature" });
    expect(mocks.updateCalls).toHaveLength(0);
    await app.close();
  });

  it("does not audit unknown API keys", async () => {
    const { buildApp } = await import("../src/app");
    const app = await buildApp();
    mocks.selectResults.push([]);

    const response = await app.inject({
      method: "GET",
      url: "/api/tokens",
      headers: { authorization: "Bearer fmt_unknown" },
    });

    expect(response.statusCode).toBe(401);
    expect(mocks.insertCalls).toHaveLength(0);
    await app.close();
  });

  it("rate-limits unknown API keys without writing audit rows", async () => {
    const { buildApp } = await import("../src/app");
    const app = await buildApp();

    let response = await app.inject({
      method: "GET",
      url: "/api/tokens",
      headers: { authorization: "Bearer fmt_unknown" },
    });
    expect(response.statusCode).toBe(401);

    for (let index = 0; index < 19; index += 1) {
      mocks.selectResults.push([]);
      response = await app.inject({
        method: "GET",
        url: "/api/tokens",
        headers: { authorization: "Bearer fmt_unknown" },
      });
      expect(response.statusCode).toBe(401);
    }

    mocks.selectResults.push([]);
    response = await app.inject({
      method: "GET",
      url: "/api/tokens",
      headers: { authorization: "Bearer fmt_unknown" },
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({
      error: "Too many invalid API key attempts",
    });
    expect(mocks.insertCalls).toHaveLength(0);
    await app.close();
  });

  it("does not treat wallet JWT bearer tokens as API keys on public reads", async () => {
    const { buildApp } = await import("../src/app");
    const app = await buildApp();
    mocks.selectResults.push([{ symbol: "ROCKET", tokenAddress: "0xtoken" }]);

    const response = await app.inject({
      method: "GET",
      url: "/api/tokens",
      headers: { authorization: "Bearer ey.wallet.jwt" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ symbol: "ROCKET", tokenAddress: "0xtoken" }]);
    expect(mocks.insertCalls).toHaveLength(0);
    await app.close();
  });

  it("returns token holder analytics from the token creation block", async () => {
    const { buildApp } = await import("../src/app");
    const app = await buildApp();
    mocks.selectResults.push(
      [{ symbol: "ROCKET", tokenAddress: "0xtoken", projectId: 7 }],
      [{ eventName: "TokenCreated", tokenAddress: "0xtoken", blockNumber: 100 }],
    );

    const response = await app.inject({ method: "GET", url: "/api/tokens/ROCKET/holders?limit=5" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      tokenAddress: "0xtoken",
      holderCount: 1,
      holders: [{ rank: 1, address: "0xabc", percent: 100 }],
    });
    expect(mocks.holderCalls[0]).toMatchObject({
      tokenAddress: "0xtoken",
      fromBlock: 100,
      limit: 5,
    });
    await app.close();
  });

  it("creates managed orders when authenticated with a wallet JWT", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    mocks.insertReturns.push([{ id: 9, walletAddress: "0xabc", status: "pending" }]);
    const token = issueToken("0xabc");

    const response = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        walletAddress: "0xABC",
        tokenAddress: "0xtoken",
        orderType: "limit",
        side: "buy",
        amount: "1",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 9, walletAddress: "0xabc" });
    expect(mocks.insertCalls[0]).toMatchObject({ walletAddress: "0xabc", orderType: "limit" });
    await app.close();
  });

  it("rejects anonymous managed order writes", async () => {
    const { buildApp } = await import("../src/app");
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/orders",
      payload: {
        walletAddress: "0xabc",
        tokenAddress: "0xtoken",
        orderType: "limit",
        side: "buy",
        amount: "1",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(mocks.insertCalls).toHaveLength(0);
    await app.close();
  });

  it("rejects wallet JWT writes for a different wallet address", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    const token = issueToken("0xabc");

    const response = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        walletAddress: "0xdef",
        tokenAddress: "0xtoken",
        orderType: "limit",
        side: "buy",
        amount: "1",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(mocks.insertCalls).toHaveLength(0);
    await app.close();
  });

  it("rejects off-chain withdrawal creation even for authenticated wallets", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    const token = issueToken("0xabc");

    const response = await app.inject({
      method: "POST",
      url: "/api/withdrawals",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        walletAddress: "0xABC",
        tokenAddress: "0xtoken",
        amount: "1",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: expect.stringContaining("CommissionVault.requestWithdrawal"),
    });
    expect(mocks.insertCalls).toHaveLength(0);
    await app.close();
  });

  it("does not submit admin withdrawal approval without an on-chain withdrawal id", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    const token = issueToken("0xadmin");
    mocks.selectResults.push(
      [{ id: 12, type: "withdrawal", targetId: "55", status: "pending" }],
      [{ id: 55, walletAddress: "0xabc", chainWithdrawalId: null, status: "pending" }],
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/review-queue/12/approve",
      headers: { authorization: `Bearer ${token}` },
      payload: { note: "approve" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: expect.stringContaining("on-chain CommissionVault withdrawalId"),
    });
    expect(mocks.updateCalls).toHaveLength(0);
    await app.close();
  });

  it("submits admin withdrawal approval through the chain executor", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    const token = issueToken("0xadmin");
    mocks.selectResults.push(
      [{ id: 12, type: "withdrawal", targetId: "55", status: "pending" }],
      [{ id: 55, walletAddress: "0xabc", chainWithdrawalId: 9, status: "pending" }],
    );
    mocks.updateReturns.push([{ id: 12, type: "withdrawal", targetId: "55", status: "submitted", txHash: "0xwithdrawalreview" }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/review-queue/12/approve",
      headers: { authorization: `Bearer ${token}` },
      payload: { note: "approve" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "submitted", txHash: "0xwithdrawalreview" });
    expect(mocks.chainCalls[0]).toMatchObject({
      fn: "reviewWithdrawalOnChain",
      args: [9, true],
    });
    expect(mocks.updateCalls[0]).toMatchObject({
      status: "submitted",
      reviewerAddress: "0xadmin",
      reviewerNote: "approve",
      txHash: "0xwithdrawalreview",
    });
    await app.close();
  });

  it("submits admin withdrawal rejection through the chain executor", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    const token = issueToken("0xadmin");
    mocks.selectResults.push(
      [{ id: 13, type: "withdrawal", targetId: "56", status: "pending" }],
      [{ id: 56, walletAddress: "0xabc", chainWithdrawalId: 10, status: "pending" }],
    );
    mocks.updateReturns.push([{ id: 13, type: "withdrawal", targetId: "56", status: "submitted", txHash: "0xwithdrawalreview" }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/review-queue/13/reject",
      headers: { authorization: `Bearer ${token}` },
      payload: { note: "reject" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "submitted", txHash: "0xwithdrawalreview" });
    expect(mocks.chainCalls[0]).toMatchObject({
      fn: "reviewWithdrawalOnChain",
      args: [10, false],
    });
    expect(mocks.updateCalls[0]).toMatchObject({
      status: "submitted",
      reviewerAddress: "0xadmin",
      reviewerNote: "reject",
      txHash: "0xwithdrawalreview",
    });
    await app.close();
  });

  it("submits admin token approval through the chain executor", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    const token = issueToken("0xadmin");
    mocks.selectResults.push([{ id: 21, type: "token", targetId: "42", status: "pending" }]);
    mocks.updateReturns.push([{ id: 21, type: "token", targetId: "42", status: "submitted", txHash: "0xreview" }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/review-queue/21/approve",
      headers: { authorization: `Bearer ${token}` },
      payload: { note: "looks real" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "submitted", txHash: "0xreview" });
    expect(mocks.chainCalls[0]).toMatchObject({
      fn: "reviewProjectOnChain",
      args: [42, true, "looks real"],
    });
    expect(mocks.updateCalls).toContainEqual(expect.objectContaining({ status: "submitted" }));
    expect(mocks.updateCalls).toContainEqual(expect.objectContaining({
      status: "submitted",
      reviewerAddress: "0xadmin",
      reviewerNote: "looks real",
      txHash: "0xreview",
    }));
    await app.close();
  });

  it("submits admin token rejection through the chain executor after resolving symbol target ids", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    const token = issueToken("0xadmin");
    mocks.selectResults.push(
      [{ id: 22, type: "token", targetId: "ROCKET", status: "pending" }],
      [{ symbol: "ROCKET", projectId: 7 }],
    );
    mocks.updateReturns.push([{ id: 22, type: "token", targetId: "ROCKET", status: "submitted", txHash: "0xreview" }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/review-queue/22/reject",
      headers: { authorization: `Bearer ${token}` },
      payload: { note: "bad metadata" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "submitted", txHash: "0xreview" });
    expect(mocks.chainCalls[0]).toMatchObject({
      fn: "reviewProjectOnChain",
      args: [7, false, "bad metadata"],
    });
    expect(mocks.updateCalls).toContainEqual(expect.objectContaining({ status: "submitted" }));
    expect(mocks.updateCalls).toContainEqual(expect.objectContaining({
      status: "submitted",
      reviewerAddress: "0xadmin",
      reviewerNote: "bad metadata",
      txHash: "0xreview",
    }));
    await app.close();
  });

  it("does not submit admin token approval when project id cannot be resolved", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    const token = issueToken("0xadmin");
    mocks.selectResults.push(
      [{ id: 23, type: "token", targetId: "MISSING", status: "pending" }],
      [],
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/review-queue/23/approve",
      headers: { authorization: `Bearer ${token}` },
      payload: { note: "approve" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Token projectId not found",
    });
    expect(mocks.chainCalls).toHaveLength(0);
    expect(mocks.updateCalls).toHaveLength(0);
    await app.close();
  });

  it("does not submit admin withdrawal payment without an on-chain withdrawal id", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    const token = issueToken("0xadmin");
    mocks.selectResults.push([{ id: 55, walletAddress: "0xabc", chainWithdrawalId: null, status: "approved" }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/withdrawals/55/pay",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: expect.stringContaining("on-chain CommissionVault withdrawalId"),
    });
    expect(mocks.updateCalls).toHaveLength(0);
    await app.close();
  });

  it("does not submit admin withdrawal payment before approval", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    const token = issueToken("0xadmin");
    mocks.selectResults.push([{ id: 55, walletAddress: "0xabc", chainWithdrawalId: 9, status: "pending" }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/withdrawals/55/pay",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: expect.stringContaining("must be approved"),
    });
    expect(mocks.chainCalls).toHaveLength(0);
    expect(mocks.updateCalls).toHaveLength(0);
    await app.close();
  });

  it("submits admin withdrawal payment after approval", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    const token = issueToken("0xadmin");
    mocks.selectResults.push([{ id: 55, walletAddress: "0xabc", chainWithdrawalId: 9, status: "approved" }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/withdrawals/55/pay",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      txHash: "0xpay",
      withdrawalId: 55,
      chainWithdrawalId: 9,
      status: "submitted",
    });
    expect(mocks.chainCalls[0]).toMatchObject({
      fn: "payWithdrawalOnChain",
      args: [9],
    });
    expect(mocks.updateCalls[0]).toMatchObject({ status: "submitted", txHash: "0xpay" });
    await app.close();
  });

  it("audits recognized API keys with missing scopes", async () => {
    const { buildApp } = await import("../src/app");
    const app = await buildApp();
    mocks.selectResults.push([{ id: 4, ownerAddress: "0xabc", scopes: ["read"], active: true }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/commission-deposits",
      headers: { authorization: "Bearer fmt_known" },
      payload: {
        walletAddress: "0xabc",
        tokenAddress: "0xtoken",
        amount: "1",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(mocks.insertCalls[0]).toMatchObject({
      apiKeyId: 4,
      walletAddress: "0xabc",
      path: "/api/commission-deposits",
      scope: "admin",
      status: "rejected",
    });
    await app.close();
  });

  it("allows admin-scoped API keys to submit commission deposits and writes allowed audit", async () => {
    const { buildApp } = await import("../src/app");
    const app = await buildApp();
    mocks.selectResults.push([{ id: 5, ownerAddress: "0xadmin", scopes: ["admin"], active: true }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/commission-deposits",
      headers: { authorization: "Bearer fmt_admin" },
      payload: {
        walletAddress: "0xABC",
        tokenAddress: "0xtoken",
        amount: "1.5",
        source: "test",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ txHash: "0xdeposit", status: "submitted" });
    expect(mocks.updateCalls[0]).toMatchObject({ lastUsedAt: expect.any(Date) });
    expect(mocks.insertCalls[0]).toMatchObject({
      apiKeyId: 5,
      walletAddress: "0xadmin",
      path: "/api/commission-deposits",
      scope: "admin",
      status: "allowed",
    });
    expect(mocks.chainCalls[0]).toMatchObject({
      fn: "depositCommissionOnChain",
      args: ["0xabc", "0xtoken", expect.any(BigInt), "test"],
    });
    await app.close();
  });

  it("subtracts pending and completed withdrawals from commission ledger availability", async () => {
    const { buildApp } = await import("../src/app");
    const app = await buildApp();
    mocks.selectResults.push(
      [
        { tokenAddress: "0xtoken", amount: "10", walletAddress: "0xabc", status: "available" },
        { tokenAddress: "0xtoken", amount: "2", walletAddress: "0xabc", status: "available" },
      ],
      [
        { tokenAddress: "0xtoken", amount: "3", walletAddress: "0xabc", status: "pending" },
        { tokenAddress: "0xtoken", amount: "4", walletAddress: "0xabc", status: "completed" },
        { tokenAddress: "0xtoken", amount: "1", walletAddress: "0xabc", status: "rejected" },
      ],
    );

    const response = await app.inject({ method: "GET", url: "/api/ledger/commissions?wallet=0xABC" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      totals: {
        "0xtoken": {
          deposited: 12,
          available: 5,
          pending: 3,
          paid: 4,
          rejected: 1,
        },
      },
    });
    await app.close();
  });

  it("returns 401 instead of 500 for unauthenticated admin mutations", async () => {
    const { buildApp } = await import("../src/app");
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/projects/1/launch",
      payload: { note: "test" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "Authentication required" });
    await app.close();
  });

  it("submits admin project launch through the chain executor", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    const token = issueToken("0xadmin");
    mocks.selectResults.push([{ id: 1, projectId: 42, status: "pending" }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/projects/42/launch",
      headers: { authorization: `Bearer ${token}` },
      payload: { note: "launch smoke" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ txHash: "0xlaunch", projectId: 42, status: "submitted" });
    expect(mocks.chainCalls[0]).toMatchObject({
      fn: "markProjectLaunchedOnChain",
      args: [42, "launch smoke"],
    });
    await app.close();
  });

  it("rejects project launch before approval", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    const token = issueToken("0xadmin");
    mocks.selectResults.push([{ id: 1, projectId: 44, status: "building" }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/projects/44/launch",
      headers: { authorization: `Bearer ${token}` },
      payload: { note: "too early" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "Project must be approved before launch; current status is building" });
    expect(mocks.chainCalls).toHaveLength(0);
    await app.close();
  });

  it("allows secondary admin wallets from ADMIN_WALLETS", async () => {
    const { buildApp } = await import("../src/app");
    const { issueToken } = await import("../src/lib/auth");
    const app = await buildApp();
    const token = issueToken("0xsecondadmin");
    mocks.selectResults.push([{ id: 1, projectId: 43, status: "pending" }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/projects/43/launch",
      headers: { authorization: `Bearer ${token}` },
      payload: { note: "secondary admin" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ txHash: "0xlaunch", projectId: 43, status: "submitted" });
    await app.close();
  });

  it("filters indexer status to the active deployment addresses", async () => {
    const { buildApp } = await import("../src/app");
    const app = await buildApp();
    mocks.selectResults.push([
      { id: 1, contractAddress: "0xold", lastIndexedBlock: 1, latestSeenBlock: 10, failureCount: 0 },
      { id: 2, contractAddress: "0xfactory", lastIndexedBlock: 10, latestSeenBlock: 10, failureCount: 0 },
      { id: 3, contractAddress: "0xvault", lastIndexedBlock: 9, latestSeenBlock: 10, failureCount: 0 },
      { id: 4, contractAddress: "0xcommission", lastIndexedBlock: 8, latestSeenBlock: 10, failureCount: 0 },
    ]);

    const response = await app.inject({ method: "GET", url: "/api/indexer/status" });
    const body = response.json<Array<{ contractAddress: string; lagBlocks: number }>>();

    expect(response.statusCode).toBe(200);
    expect(body.map((row) => row.contractAddress)).toEqual(["0xfactory", "0xvault", "0xcommission"]);
    expect(body.map((row) => row.lagBlocks)).toEqual([0, 1, 2]);
    await app.close();
  });
});
