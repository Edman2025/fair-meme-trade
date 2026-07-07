import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMvp } from "@/contexts/MvpContext";
import { apiRequest, getStoredAuthToken } from "@/lib/backendApi";
import { Check, Database, ListChecks, RefreshCw, Rocket, ShieldCheck, Wallet, X } from "lucide-react";

type ReviewStatus = "pending" | "submitted" | "approved" | "rejected" | "failed";

interface ReviewItem {
  id: number;
  type: "token" | "node" | "withdrawal";
  targetId: string;
  title: string;
  status: ReviewStatus;
  reviewerNote?: string;
  txHash?: string;
  createdAt: string;
}

interface TokenRow {
  id: number;
  projectId: number;
  symbol: string;
  name: string;
  tokenAddress: string;
  creatorAddress: string;
  status: string;
  createdAt: string;
}

interface IndexerState {
  contractAddress: string;
  lastIndexedBlock: number;
  latestSeenBlock: number;
  failureCount: number;
  lagBlocks: number;
  lastError?: string | null;
  rpcUrl: string;
}

interface ChainTx {
  id: number;
  action: string;
  txHash: string;
  status: string;
  walletAddress?: string;
  createdAt: string;
}

interface Withdrawal {
  id: number;
  chainWithdrawalId?: number;
  walletAddress: string;
  amount: string;
  tokenAddress: string;
  status: string;
  txHash?: string;
  createdAt: string;
}

interface NodeApplication {
  id: number;
  walletAddress: string;
  status: string;
  createdAt: string;
}

interface LpPosition {
  id: number;
  positionId: number | null;
  ownerAddress: string;
  lpTokenAddress: string;
  tokenAddress?: string;
  amount: string;
  withdrawn: string;
  unlockAt?: string;
}

interface IndexedEvent {
  id: number;
  eventName: string;
  txHash: string;
  blockNumber: number;
  tokenAddress?: string;
  walletAddress?: string;
  createdAt: string;
}

const statusText: Record<string, string> = {
  pending: "待审核",
  submitted: "链上提交",
  approved: "已通过",
  rejected: "已拒绝",
  failed: "失败",
  building: "构建中",
  launched: "已上线",
  completed: "已完成",
};

const projectStatusText: Record<string, string> = {
  building: "构建中",
  pending: "待上线",
  launched: "已上线",
  rejected: "已拒绝",
  submitted: "链上提交",
  failed: "失败",
};

const statusVariant = (status: string) => {
  if (status === "rejected" || status === "failed") return "destructive";
  if (status === "approved" || status === "submitted" || status === "launched" || status === "completed") return "secondary";
  return "outline";
};

const short = (value?: string) => value ? `${value.slice(0, 8)}...${value.slice(-6)}` : "-";

const AdminQueue = () => {
  const { toast } = useToast();
  const { isConnected, walletAddress, connectInjectedWallet } = useMvp();
  const [authToken, setAuthToken] = useState(getStoredAuthToken());
  const [isLoading, setIsLoading] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [indexer, setIndexer] = useState<IndexerState[]>([]);
  const [transactions, setTransactions] = useState<ChainTx[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [nodes, setNodes] = useState<NodeApplication[]>([]);
  const [lpPositions, setLpPositions] = useState<LpPosition[]>([]);
  const [events, setEvents] = useState<IndexedEvent[]>([]);

  const stats = useMemo(() => ({
    pending: reviewQueue.filter((item) => item.status === "pending").length,
    submitted: reviewQueue.filter((item) => item.status === "submitted").length,
    failedIndexers: indexer.filter((item) => item.failureCount > 0 || item.lagBlocks > 0).length,
  }), [indexer, reviewQueue]);

  const hasPendingChainState = useMemo(() => (
    reviewQueue.some((item) => item.status === "submitted") ||
    tokens.some((token) => token.status === "submitted") ||
    withdrawals.some((withdrawal) => withdrawal.status === "submitted") ||
    transactions.some((tx) => tx.status === "submitted" || tx.status === "pending")
  ), [reviewQueue, tokens, transactions, withdrawals]);

  const loadAdminData = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setIsLoading(true);
    try {
      const [tokenRows, indexerRows, txRows, withdrawalRows, nodeRows, lpRows, eventRows] = await Promise.all([
        apiRequest<TokenRow[]>("/api/tokens"),
        apiRequest<IndexerState[]>("/api/indexer/status"),
        apiRequest<ChainTx[]>("/api/chain-transactions"),
        apiRequest<Withdrawal[]>("/api/withdrawals"),
        apiRequest<NodeApplication[]>("/api/node-applications"),
        apiRequest<LpPosition[]>("/api/lp-positions"),
        apiRequest<IndexedEvent[]>("/api/indexed-events"),
      ]);
      setTokens(tokenRows);
      setIndexer(indexerRows);
      setTransactions(txRows);
      setWithdrawals(withdrawalRows);
      setNodes(nodeRows);
      setLpPositions(lpRows);
      setEvents(eventRows.slice(0, 100));

      const token = getStoredAuthToken();
      setAuthToken(token);
      if (token) {
        try {
          setReviewQueue(await apiRequest<ReviewItem[]>("/api/admin/review-queue", { token }));
        } catch {
          setReviewQueue([]);
        }
      }
    } catch (error) {
      if (!options.silent) {
        toast({
          title: "后台数据加载失败",
          description: error instanceof Error ? error.message : "请检查后端 API。",
          variant: "destructive",
        });
      }
    } finally {
      if (!options.silent) setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    if (!hasPendingChainState) return;
    const timer = window.setInterval(() => {
      loadAdminData({ silent: true });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hasPendingChainState, loadAdminData]);

  const loginAdmin = async () => {
    try {
      const signature = await connectInjectedWallet();
      const token = getStoredAuthToken();
      setAuthToken(token);
      toast({
        title: signature.mode === "wallet" ? "管理员钱包已连接" : "开发演示钱包已连接",
        description: signature.mode === "wallet" ? short(signature.address) : "线上环境请使用管理员钱包执行审批。",
      });
      await loadAdminData();
    } catch (error) {
      toast({
        title: "管理员登录失败",
        description: error instanceof Error ? error.message : "请确认钱包已解锁。",
        variant: "destructive",
      });
    }
  };

  const approve = async (item: ReviewItem) => {
    try {
      await apiRequest(`/api/admin/review-queue/${item.id}/approve`, {
        method: "POST",
        token: authToken,
        body: JSON.stringify({ note: "后台管理系统审核通过" }),
      });
      toast({ title: "链上审核已提交", description: item.title });
      await loadAdminData();
      window.setTimeout(() => loadAdminData({ silent: true }), 3000);
    } catch (error) {
      toast({ title: "审核失败", description: error instanceof Error ? error.message : "请检查管理员权限。", variant: "destructive" });
    }
  };

  const reject = async (item: ReviewItem) => {
    try {
      await apiRequest(`/api/admin/review-queue/${item.id}/reject`, {
        method: "POST",
        token: authToken,
        body: JSON.stringify({ note: "后台管理系统审核拒绝" }),
      });
      toast({ title: "拒绝已提交", description: item.title, variant: "destructive" });
      await loadAdminData();
      window.setTimeout(() => loadAdminData({ silent: true }), 3000);
    } catch (error) {
      toast({ title: "拒绝失败", description: error instanceof Error ? error.message : "请检查管理员权限。", variant: "destructive" });
    }
  };

  const launchProject = async (projectId: number) => {
    try {
      await apiRequest(`/api/admin/projects/${projectId}/launch`, {
        method: "POST",
        token: authToken,
        body: JSON.stringify({ note: "后台管理系统上线项目" }),
      });
      toast({ title: "上线交易已提交", description: `Project #${projectId}` });
      await loadAdminData();
      window.setTimeout(() => loadAdminData({ silent: true }), 3000);
    } catch (error) {
      toast({ title: "上线失败", description: error instanceof Error ? error.message : "请检查项目状态和管理员权限。", variant: "destructive" });
    }
  };

  const getProjectLaunchState = (status: string) => {
    if (status === "pending") return { disabled: false, label: "上线" };
    if (status === "launched") return { disabled: true, label: "已上线" };
    if (status === "building") return { disabled: true, label: "先审核" };
    if (status === "submitted") return { disabled: true, label: "提交中" };
    return { disabled: true, label: "不可上线" };
  };

  const payWithdrawal = async (id: number) => {
    try {
      await apiRequest(`/api/admin/withdrawals/${id}/pay`, {
        method: "POST",
        token: authToken,
      });
      toast({ title: "提现支付已提交", description: `Withdrawal #${id}` });
      await loadAdminData();
    } catch (error) {
      toast({ title: "支付失败", description: error instanceof Error ? error.message : "请检查提现审批状态和 vault 余额。", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 py-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-gradient-primary">后台管理系统</Badge>
              <Badge variant={authToken ? "secondary" : "outline"}>{authToken ? "已连接管理会话" : "未登录管理员"}</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-bold text-foreground">Fair Meme Trade Admin</h1>
            <p className="mt-2 text-muted-foreground">审核、链上执行、Indexer、提现、节点、LP 与交易状态统一管理。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadAdminData} disabled={isLoading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              刷新
            </Button>
            <Button onClick={loginAdmin} className="gap-2">
              <Wallet className="h-4 w-4" />
              {isConnected ? short(walletAddress) : "连接管理员钱包"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><ListChecks className="h-4 w-4 text-primary" /> 待审核</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{stats.pending}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> 链上提交中</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{stats.submitted}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Rocket className="h-4 w-4 text-primary" /> 项目</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{tokens.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-primary" /> Indexer 异常</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{stats.failedIndexers}</div></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="reviews" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="reviews">审核</TabsTrigger>
            <TabsTrigger value="projects">项目</TabsTrigger>
            <TabsTrigger value="withdrawals">提现</TabsTrigger>
            <TabsTrigger value="nodes">节点</TabsTrigger>
            <TabsTrigger value="lp">LP</TabsTrigger>
            <TabsTrigger value="indexer">Indexer</TabsTrigger>
            <TabsTrigger value="transactions">交易</TabsTrigger>
            <TabsTrigger value="events">事件</TabsTrigger>
          </TabsList>

          <TabsContent value="reviews">
            <Card>
              <CardHeader>
                <CardTitle>审核队列</CardTitle>
                <CardDescription>审批 token/节点/提现；token 与提现会由服务器 admin signer 发链上交易。</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>ID</TableHead><TableHead>类型</TableHead><TableHead>标题</TableHead><TableHead>状态</TableHead><TableHead>Tx</TableHead><TableHead className="text-right">操作</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviewQueue.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.id}</TableCell>
                          <TableCell>{item.type}</TableCell>
                          <TableCell>{item.title}</TableCell>
                          <TableCell><Badge variant={statusVariant(item.status)}>{statusText[item.status] || item.status}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{short(item.txHash)}</TableCell>
                          <TableCell className="text-right">
                            {item.status === "pending" ? (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => reject(item)}><X className="h-4 w-4" /></Button>
                                <Button size="sm" onClick={() => approve(item)}><Check className="h-4 w-4" /></Button>
                              </div>
                            ) : <span className="text-sm text-muted-foreground">已处理</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects">
            <Card>
              <CardHeader><CardTitle>项目管理</CardTitle><CardDescription>查看链上 indexed token，并可提交上线交易。</CardDescription></CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Symbol</TableHead><TableHead>Token</TableHead><TableHead>Owner</TableHead><TableHead>状态</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {tokens.map((token) => (
                        <TableRow key={token.id}>
                          <TableCell>#{token.projectId}</TableCell>
                          <TableCell>{token.symbol}</TableCell>
                          <TableCell className="font-mono text-xs">{short(token.tokenAddress)}</TableCell>
                          <TableCell className="font-mono text-xs">{short(token.creatorAddress)}</TableCell>
                          <TableCell><Badge variant={statusVariant(token.status)}>{projectStatusText[token.status] || token.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            {(() => {
                              const launchState = getProjectLaunchState(token.status);
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={launchState.disabled}
                                  title={token.status === "building" ? "项目需要先在审核队列通过，链上状态变为待上线后才能提交上线交易。" : undefined}
                                  onClick={() => launchProject(token.projectId)}
                                >
                                  {launchState.label}
                                </Button>
                              );
                            })()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals">
            <Card>
              <CardHeader><CardTitle>提现管理</CardTitle><CardDescription>提现审核后可执行 CommissionVault 支付。</CardDescription></CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>链上ID</TableHead><TableHead>钱包</TableHead><TableHead>金额</TableHead><TableHead>Token</TableHead><TableHead>状态</TableHead><TableHead>Tx</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {withdrawals.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.id}</TableCell>
                          <TableCell>{item.chainWithdrawalId ?? <span className="text-muted-foreground">等待链上</span>}</TableCell>
                          <TableCell className="font-mono text-xs">{short(item.walletAddress)}</TableCell>
                          <TableCell>{item.amount}</TableCell>
                          <TableCell className="font-mono text-xs">{short(item.tokenAddress)}</TableCell>
                          <TableCell><Badge variant={statusVariant(item.status)}>{statusText[item.status] || item.status}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{short(item.txHash)}</TableCell>
                          <TableCell className="text-right"><Button size="sm" variant="outline" disabled={item.status !== "approved" || !item.chainWithdrawalId} onClick={() => payWithdrawal(item.id)}>支付</Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nodes">
            <Card>
              <CardHeader><CardTitle>节点申请</CardTitle><CardDescription>节点状态来自后端数据库。</CardDescription></CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>钱包</TableHead><TableHead>状态</TableHead><TableHead>时间</TableHead></TableRow></TableHeader>
                    <TableBody>{nodes.map((item) => <TableRow key={item.id}><TableCell>{item.id}</TableCell><TableCell className="font-mono text-xs">{short(item.walletAddress)}</TableCell><TableCell><Badge variant={statusVariant(item.status)}>{statusText[item.status] || item.status}</Badge></TableCell><TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell></TableRow>)}</TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lp">
            <Card>
              <CardHeader><CardTitle>LP 锁仓</CardTitle><CardDescription>来自 Vault indexer 的锁仓仓位。</CardDescription></CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Position</TableHead><TableHead>Owner</TableHead><TableHead>LP Token</TableHead><TableHead>Project Token</TableHead><TableHead>Amount</TableHead><TableHead>Withdrawn</TableHead><TableHead>Unlock</TableHead></TableRow></TableHeader>
                    <TableBody>{lpPositions.map((item) => <TableRow key={item.id}><TableCell>{item.positionId || item.id}</TableCell><TableCell className="font-mono text-xs">{short(item.ownerAddress)}</TableCell><TableCell className="font-mono text-xs">{short(item.lpTokenAddress)}</TableCell><TableCell className="font-mono text-xs">{short(item.tokenAddress)}</TableCell><TableCell>{item.amount}</TableCell><TableCell>{item.withdrawn}</TableCell><TableCell>{item.unlockAt ? new Date(item.unlockAt).toLocaleString() : "-"}</TableCell></TableRow>)}</TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="indexer">
            <Card>
              <CardHeader><CardTitle>Indexer 状态</CardTitle><CardDescription>长期 worker 的同步进度和 RPC 状态。</CardDescription></CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader><TableRow><TableHead>合约</TableHead><TableHead>Last Indexed</TableHead><TableHead>Latest Seen</TableHead><TableHead>Lag</TableHead><TableHead>Failures</TableHead><TableHead>RPC</TableHead><TableHead>Error</TableHead></TableRow></TableHeader>
                    <TableBody>{indexer.map((item) => <TableRow key={item.contractAddress}><TableCell className="font-mono text-xs">{short(item.contractAddress)}</TableCell><TableCell>{item.lastIndexedBlock}</TableCell><TableCell>{item.latestSeenBlock}</TableCell><TableCell>{item.lagBlocks}</TableCell><TableCell>{item.failureCount}</TableCell><TableCell className="max-w-64 truncate text-xs">{item.rpcUrl}</TableCell><TableCell className="max-w-64 truncate text-xs">{item.lastError || "-"}</TableCell></TableRow>)}</TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader><CardTitle>链交易</CardTitle><CardDescription>后端、前端提交的链上交易状态。</CardDescription></CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Action</TableHead><TableHead>Status</TableHead><TableHead>Wallet</TableHead><TableHead>Tx</TableHead><TableHead>时间</TableHead></TableRow></TableHeader>
                    <TableBody>{transactions.map((tx) => <TableRow key={tx.id}><TableCell>{tx.id}</TableCell><TableCell>{tx.action}</TableCell><TableCell><Badge variant={statusVariant(tx.status)}>{tx.status}</Badge></TableCell><TableCell className="font-mono text-xs">{short(tx.walletAddress)}</TableCell><TableCell className="font-mono text-xs">{short(tx.txHash)}</TableCell><TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell></TableRow>)}</TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader><CardTitle>Indexed Events</CardTitle><CardDescription>最近 100 条链上事件。</CardDescription></CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Event</TableHead><TableHead>Block</TableHead><TableHead>Token</TableHead><TableHead>Wallet</TableHead><TableHead>Tx</TableHead></TableRow></TableHeader>
                    <TableBody>{events.map((event) => <TableRow key={event.id}><TableCell>{event.id}</TableCell><TableCell>{event.eventName}</TableCell><TableCell>{event.blockNumber}</TableCell><TableCell className="font-mono text-xs">{short(event.tokenAddress)}</TableCell><TableCell className="font-mono text-xs">{short(event.walletAddress)}</TableCell><TableCell className="font-mono text-xs">{short(event.txHash)}</TableCell></TableRow>)}</TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminQueue;
