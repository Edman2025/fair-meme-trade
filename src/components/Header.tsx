import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, Globe, Menu, Copy, ExternalLink, TrendingUp, TrendingDown, Gift, Award, Eye, EyeOff, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMvp } from "@/contexts/MvpContext";
import goldenDogLogo from "@/assets/golden-dog-logo-1.png";
import { useNavigate, useLocation } from "react-router-dom";
import { apiRequest } from "@/lib/backendApi";
import { enableDemoFallback } from "@/lib/runtimeFlags";

declare global {
  interface Window {
    spawnLogoEffect?: () => void;
  }
}

type EarningsRecord = { date: string; amount: string; value: number; transaction: string };
type PaidEarningsRecord = { date: string; value: number; purpose: string; status: string };
type CommissionLedgerRow = {
  amount: string;
  tokenAddress: string;
  source: string;
  status: string;
  createdAt: string;
};
type CommissionLedgerTotal = {
  deposited: number;
  available: number;
  pending: number;
  paid: number;
  rejected: number;
};

const Header = () => {
  const { language, setLanguage, t } = useLanguage();
  const {
    isConnected,
    connectWallet,
    connectInjectedWallet,
    disconnectWallet,
    walletAddress,
    walletBalances,
    trades,
    walletSignatures,
    chainTransactions,
    indexedEvents,
  } = useMvp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [hideEmptyTokens, setHideEmptyTokens] = useState(false);
  const [minUsdtFilter, setMinUsdtFilter] = useState("");
  const [commissionRows, setCommissionRows] = useState<CommissionLedgerRow[]>([]);
  const [commissionTotals, setCommissionTotals] = useState<Record<string, CommissionLedgerTotal>>({});
  const [isLoadingCommissionRows, setIsLoadingCommissionRows] = useState(false);
  const [commissionRowsError, setCommissionRowsError] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const shortWalletAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setCommissionRows([]);
      setCommissionTotals({});
      setCommissionRowsError("");
      setIsLoadingCommissionRows(false);
      return;
    }
    let cancelled = false;
    setIsLoadingCommissionRows(true);
    setCommissionRowsError("");
    apiRequest<{ rows: CommissionLedgerRow[]; totals: Record<string, CommissionLedgerTotal> }>(`/api/ledger/commissions?wallet=${walletAddress}`)
      .then((data) => {
        if (!cancelled) {
          setCommissionRows(data.rows || []);
          setCommissionTotals(data.totals || {});
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCommissionRows([]);
          setCommissionTotals({});
          setCommissionRowsError(error instanceof Error ? error.message : "佣金账本读取失败");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCommissionRows(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isConnected, walletAddress]);

  const ledgerData: {
    availableAmount: number;
    currentPhase: string;
    earnRecords: EarningsRecord[];
    paidRecords: PaidEarningsRecord[];
    tokenSummaries: Array<{ token: string; available: number; paid: number; count: number }>;
  } = useMemo(() => {
    const tokenSummaries = Object.entries(commissionTotals).map(([token, total]) => ({
      token,
      available: Number((total.available || 0).toFixed(6)),
      paid: Number((total.paid || 0).toFixed(6)),
      count: commissionRows.filter((row) => row.tokenAddress?.toLowerCase() === token.toLowerCase()).length,
    }));
    const totalAvailable = tokenSummaries.reduce((sum, row) => sum + row.available, 0);
    const availableRows = tokenSummaries.filter((row) => row.available > 0);
    const paidRows = tokenSummaries.filter((row) => row.paid > 0);
    return {
      availableAmount: Number(totalAvailable.toFixed(6)),
      currentPhase: commissionRowsError ? "账本读取失败" : tokenSummaries.length > 0 ? "真实佣金账本" : "暂无链上收益",
      earnRecords: availableRows.map((row) => ({
        date: "实时账本",
        amount: `${row.available} ${row.token.slice(0, 6)}...${row.token.slice(-4)}`,
        value: row.available,
        transaction: "available",
      })),
      paidRecords: paidRows.map((row) => ({
        date: "实时账本",
        value: row.paid,
        purpose: `${row.token.slice(0, 6)}...${row.token.slice(-4)}`,
        status: "completed",
      })),
      tokenSummaries,
    };
  }, [commissionRows, commissionRowsError, commissionTotals]);

  // Fee standards data
  const feeStandards = [
    { type: "交易佣金", rate: "1%", description: "每笔交易收取1%佣金" },
    { type: "流动性池费用", rate: "1%", description: "通过代币公平发射阶段添加LP的钱包地址盈利大于1%时，撤回流动性时扣除1%直接添加到永久流动性池" },
  ];

  const handleConnectWallet = async () => {
    if (!isConnected) {
      try {
        const signature = await connectInjectedWallet();
        toast({
          title: signature.mode === "wallet" ? "真实钱包已连接" : "演示钱包已连接",
          description: signature.mode === "wallet"
            ? `${signature.address.slice(0, 6)}...${signature.address.slice(-4)} 已完成签名认证。`
            : "已启用开发演示钱包。",
        });
      } catch (error) {
        if (enableDemoFallback) {
          connectWallet();
        }
        toast({
          title: enableDemoFallback ? "开发演示钱包已启用" : "真实钱包连接失败",
          description: error instanceof Error ? error.message : "请安装或解锁钱包后重试。",
          variant: "destructive",
        });
      }
    } else {
      setIsProfileOpen(true);
    }
  };

  const handleDisconnectWallet = () => {
    disconnectWallet();
    setIsProfileOpen(false);
    toast({
      title: "钱包已断开",
      description: "您的钱包已断开连接",
    });
  };

  const handleWalletSignature = async () => {
    try {
      const signature = await connectInjectedWallet();
      toast({
        title: signature.mode === "wallet" ? "钱包签名完成" : "演示签名已生成",
        description: signature.mode === "wallet" ? "已通过注入钱包完成登录签名。" : "已生成开发演示签名。",
      });
    } catch (error) {
      toast({
        title: "钱包签名失败",
        description: error instanceof Error ? error.message : "请确认钱包是否已解锁。",
        variant: "destructive",
      });
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    toast({
      title: "已复制",
      description: "钱包地址已复制到剪贴板",
    });
  };

  const filteredBalances = walletBalances.filter(item => {
    if (hideEmptyTokens && item.status === "cleared") return false;
    if (minUsdtFilter && parseFloat(item.valueUSDT) < parseFloat(minUsdtFilter)) return false;
    return true;
  });

  const navItems = [
    { key: "market", path: "/" },
    { key: "charts", path: "/token/ROCKET" },
    { key: "createToken", path: null, isDialog: true },
    { key: "node", path: "/nodes" },
    { key: "goldenDogRanking", path: "/golden-dog-ranking" },
    { key: "api", path: "/api-docs" },
    { key: "admin", label: "审核", path: "/admin" },
  ];

  const isActiveRoute = (path: string) => {
    if (path.startsWith("/token/")) {
      return location.pathname.startsWith("/token/");
    }
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div 
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => {
            navigate("/");
            // Trigger floating logo effect
            if (typeof window !== "undefined" && window.spawnLogoEffect) {
              window.spawnLogoEffect();
            }
          }}
        >
          <img 
            src={goldenDogLogo} 
            alt="MemeLaunch Logo" 
            className="h-10 w-10 rounded-lg object-cover transition-all duration-300 group-hover:animate-bounce-hover group-hover:drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
          />
          <span className="bg-gradient-primary bg-clip-text text-xl font-bold text-transparent transition-all duration-300 group-hover:scale-105">
            MemeLaunch
          </span>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Button
              key={item.key}
              variant="ghost"
              onClick={() => item.isDialog ? setIsCreateDialogOpen(true) : navigate(item.path!)}
              className={`text-foreground/80 hover:text-foreground hover:bg-accent/10 transition-smooth ${
                item.path && isActiveRoute(item.path) ? "bg-accent/20 text-foreground font-semibold" : ""
              }`}
            >
              {item.label || t(item.key)}
            </Button>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">{language}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage("EN")}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage("zh-CN")}>
                简体中文
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage("繁体")}>
                繁体中文
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage("日本語")}>
                日本語
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Connect Wallet */}
          <Button
            onClick={handleConnectWallet}
            size="sm"
            className={`gap-2 hidden sm:flex ${
              isConnected
                ? "bg-success hover:bg-success/90"
                : "bg-gradient-primary hover:shadow-glow"
            } transition-smooth`}
          >
            <Wallet className="h-4 w-4" />
          <span>{isConnected ? shortWalletAddress : t("connect")}</span>
        </Button>

          {/* Mobile Menu */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <div className="flex flex-col gap-4 mt-8">
                {navItems.map((item) => (
                  <Button
                    key={item.key}
                    variant="ghost"
                    className={`justify-start text-foreground/80 hover:text-foreground ${
                      item.path && isActiveRoute(item.path) ? "bg-accent/20 text-foreground font-semibold" : ""
                    }`}
                    onClick={() => {
                      if (item.isDialog) {
                        setIsCreateDialogOpen(true);
                      } else {
                        navigate(item.path!);
                      }
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    {item.label || t(item.key)}
                  </Button>
                ))}
                <Button
                  onClick={() => {
                    handleConnectWallet();
                    setIsMobileMenuOpen(false);
                  }}
                  className={`gap-2 ${
                    isConnected
                      ? "bg-success hover:bg-success/90"
                      : "bg-gradient-primary hover:shadow-glow"
                  }`}
                >
                  <Wallet className="h-4 w-4" />
                  {t(isConnected ? "connected" : "connect")}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Create Token Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{t("createToken")}</DialogTitle>
            <DialogDescription>
              选择您要进行的操作
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button
              onClick={() => {
                setIsCreateDialogOpen(false);
                navigate("/create");
              }}
              className="w-full h-16 text-lg bg-gradient-primary hover:shadow-glow"
            >
              创建代币
            </Button>
            <Button
              onClick={() => {
                setIsCreateDialogOpen(false);
                navigate("/my-tokens");
              }}
              variant="outline"
              className="w-full h-16 text-lg"
            >
              我创建的代币
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Personal Center Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              个人中心
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <span className="text-muted-foreground">{walletAddress}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyAddress}>
                <Copy className="h-3 w-3" />
              </Button>
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="fees" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="fees">收费标准</TabsTrigger>
              <TabsTrigger value="balance">钱包余额</TabsTrigger>
              <TabsTrigger value="records">操作记录</TabsTrigger>
              <TabsTrigger value="chain">链上</TabsTrigger>
              <TabsTrigger value="earnings">我的收益</TabsTrigger>
              <TabsTrigger value="settings">设置</TabsTrigger>
            </TabsList>

            {/* 收费标准 */}
            <TabsContent value="fees" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>平台收费标准</CardTitle>
                  <CardDescription>所有交易和操作的费用明细</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {feeStandards.map((fee, index) => (
                      <div key={index} className="flex items-start justify-between p-4 border border-border rounded-lg bg-card/50">
                        <div className="space-y-1">
                          <h4 className="font-medium text-foreground">{fee.type}</h4>
                          <p className="text-sm text-muted-foreground">{fee.description}</p>
                        </div>
                        <div className="text-lg font-bold text-primary">{fee.rate}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chain" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    钱包签名与链上记录
                  </CardTitle>
                  <CardDescription>连接真实注入钱包时会发起签名或交易；线上环境不启用演示钱包。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={handleWalletSignature} className="gap-2 bg-gradient-primary">
                    <Wallet className="h-4 w-4" />
                    发起钱包签名
                  </Button>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-sm text-muted-foreground">签名记录</p>
                      <p className="mt-2 text-2xl font-bold">{walletSignatures.length}</p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-sm text-muted-foreground">链交易</p>
                      <p className="mt-2 text-2xl font-bold">{chainTransactions.length}</p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-sm text-muted-foreground">Indexer 事件</p>
                      <p className="mt-2 text-2xl font-bold">{indexedEvents.length}</p>
                    </div>
                  </div>

                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>时间</TableHead>
                          <TableHead>动作</TableHead>
                          <TableHead>代币</TableHead>
                          <TableHead>交易哈希</TableHead>
                          <TableHead className="text-right">状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chainTransactions.length > 0 ? chainTransactions.slice(0, 8).map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-sm">{tx.createdAt}</TableCell>
                            <TableCell>{tx.action}</TableCell>
                            <TableCell>{tx.tokenSymbol || "平台"}</TableCell>
                            <TableCell className="max-w-48 truncate font-mono text-xs">{tx.txHash}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={tx.status === "failed" ? "destructive" : "secondary"}>{tx.status}</Badge>
                            </TableCell>
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                              暂无链上记录
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 钱包余额 */}
            <TabsContent value="balance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>我的钱包余额</CardTitle>
                  <CardDescription>查看您的代币持仓和操作记录</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Switch id="hide-empty" checked={hideEmptyTokens} onCheckedChange={setHideEmptyTokens} />
                      <Label htmlFor="hide-empty">隐藏已清仓代币</Label>
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    <div className="flex items-center gap-2">
                      <Label htmlFor="min-usdt">最小余额(USDT)</Label>
                      <Input
                        id="min-usdt"
                        type="number"
                        placeholder="0"
                        value={minUsdtFilter}
                        onChange={(e) => setMinUsdtFilter(e.target.value)}
                        className="w-24"
                      />
                    </div>
                  </div>

                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>代币</TableHead>
                          <TableHead className="text-right">持仓数量</TableHead>
                          <TableHead className="text-right">价值(USDT)</TableHead>
                          <TableHead className="text-right">24h涨跌</TableHead>
                          <TableHead className="text-right">状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBalances.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.token}</TableCell>
                            <TableCell className="text-right">{item.balance}</TableCell>
                            <TableCell className="text-right">{item.valueUSDT}</TableCell>
                            <TableCell className="text-right">
                              <span className={item.change24h > 0 ? "text-success flex items-center justify-end gap-1" : "text-destructive flex items-center justify-end gap-1"}>
                                {item.change24h > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                {Math.abs(item.change24h)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={item.status === "holding" ? "text-success" : "text-muted-foreground"}>
                                {item.status === "holding" ? "持仓中" : "已清仓"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 操作记录 */}
            <TabsContent value="records" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>操作记录</CardTitle>
                  <CardDescription>这里展示链上交易哈希、提交状态和 indexer 确认结果。</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>时间</TableHead>
                          <TableHead>代币</TableHead>
                          <TableHead>类型</TableHead>
                          <TableHead className="text-right">数量/金额</TableHead>
                          <TableHead className="text-right">状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trades.length > 0 ? trades.map((trade) => (
                          <TableRow key={trade.id}>
                            <TableCell className="text-sm">{trade.timestamp}</TableCell>
                            <TableCell className="font-medium">{trade.tokenSymbol}</TableCell>
                            <TableCell>
                              <span className={trade.side === "buy" ? "text-success" : "text-destructive"}>
                                {trade.side === "buy" ? "买入" : "卖出"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{trade.amount} {trade.currency}</TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {trade.status === "simulated" ? "演示记录" : trade.status === "confirmed" ? "已确认" : "待确认"}
                            </TableCell>
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                              暂无操作记录
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 我的收益 */}
            <TabsContent value="earnings" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      我的收益
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{ledgerData.availableAmount}</div>
                    <p className="text-sm text-muted-foreground mt-2">状态: {ledgerData.currentPhase}</p>
                    {isLoadingCommissionRows && (
                      <p className="mt-2 text-xs text-muted-foreground">正在从后端佣金账本同步...</p>
                    )}
                    {commissionRowsError && (
                      <p className="mt-2 text-xs text-destructive">{commissionRowsError}</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-accent" />
                      收益用途
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <span className="text-sm">佣金提现</span>
                      <span className="text-xs text-muted-foreground">链上审批</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <span className="text-sm">节点分红</span>
                      <span className="text-xs text-muted-foreground">按账本结算</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>收益规则说明</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <p className="text-muted-foreground">这里读取后端真实佣金账本，金额和状态以 indexer 与后端 ledger 为准：</p>
                    <div className="space-y-2 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <span>交易、邀请、节点奖励进入 commission ledger</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-secondary" />
                        <span>可提现金额按 token 地址分别统计</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-accent" />
                        <span>提现申请需后台审核并由链上事件确认</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-success" />
                        <span>已支付记录会显示为 paid 状态</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                        <span>暂无记录时不会展示占位数据</span>
                      </div>
                      <p className="text-muted-foreground italic">刷新后仍从服务端读取真实状态。</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Token 账本汇总</CardTitle>
                  <CardDescription>按后端 commission ledger 的 token 地址实时汇总。</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Token</TableHead>
                          <TableHead className="text-right">可提现</TableHead>
                          <TableHead className="text-right">已支付</TableHead>
                          <TableHead className="text-right">记录数</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerData.tokenSummaries.length > 0 ? ledgerData.tokenSummaries.map((summary) => (
                          <TableRow key={summary.token}>
                            <TableCell className="font-mono text-xs">
                              {summary.token === "native" ? "native" : `${summary.token.slice(0, 6)}...${summary.token.slice(-4)}`}
                            </TableCell>
                            <TableCell className="text-right text-success">{summary.available}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{summary.paid}</TableCell>
                            <TableCell className="text-right">{summary.count}</TableCell>
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                              {isLoadingCommissionRows ? "正在读取真实账本..." : "暂无 commission ledger 记录"}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="earn" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="earn">可提现记录</TabsTrigger>
                  <TabsTrigger value="spend">已支付记录</TabsTrigger>
                </TabsList>

                <TabsContent value="earn">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="border border-border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>时间</TableHead>
                              <TableHead className="text-right">金额</TableHead>
                              <TableHead className="text-right">数值</TableHead>
                              <TableHead>来源</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ledgerData.earnRecords.length > 0 ? ledgerData.earnRecords.map((record, index) => (
                              <TableRow key={index}>
                                <TableCell className="text-sm">{record.date}</TableCell>
                                <TableCell className="text-right">{record.amount}</TableCell>
                                <TableCell className="text-right text-success font-medium">+{record.value}</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm" className="h-6 gap-1">
                                    {record.transaction}
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )) : (
                              <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                  暂无真实收益记录
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="spend">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="border border-border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>时间</TableHead>
                              <TableHead className="text-right">支付金额</TableHead>
                              <TableHead>用途</TableHead>
                              <TableHead className="text-right">状态</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ledgerData.paidRecords.length > 0 ? ledgerData.paidRecords.map((record, index) => (
                              <TableRow key={index}>
                                <TableCell className="text-sm">{record.date}</TableCell>
                                <TableCell className="text-right text-destructive font-medium">-{record.value}</TableCell>
                                <TableCell>{record.purpose}</TableCell>
                                <TableCell className="text-right">
                                  <span className="text-success">{record.status}</span>
                                </TableCell>
                              </TableRow>
                            )) : (
                              <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                  暂无真实支付记录
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* 设置 */}
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>钱包设置</CardTitle>
                  <CardDescription>管理您的钱包连接</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <h4 className="font-medium">钱包地址</h4>
                      <p className="text-sm text-muted-foreground mt-1">{walletAddress}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCopyAddress}>
                      <Copy className="h-4 w-4 mr-2" />
                      复制
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={handleDisconnectWallet}
                  >
                    <Wallet className="h-4 w-4 mr-2" />
                    断开钱包连接
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Header;
