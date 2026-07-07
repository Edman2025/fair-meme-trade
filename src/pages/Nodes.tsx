import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Network, Crown, Trophy, ShieldCheck, Wallet, BadgeCheck, TrendingUp, History, Coins } from "lucide-react";
import ShareContent from "@/components/ShareContent";
import { useMvp } from "@/contexts/MvpContext";
import { apiRequest } from "@/lib/backendApi";

type CommissionLedgerTotal = {
  deposited: number;
  available: number;
  pending: number;
  paid: number;
  rejected: number;
};

const Nodes = () => {
  const { toast } = useToast();
  const { walletAddress: connectedWallet, nodeApplications, submitNodeApplication, isConnected, connectInjectedWallet } = useMvp();
  const [walletAddress, setWalletAddress] = useState(connectedWallet);
  const [ledgerTotals, setLedgerTotals] = useState<Record<string, CommissionLedgerTotal>>({});
  const latestApplication = nodeApplications[0];

  useEffect(() => {
    setWalletAddress(connectedWallet);
  }, [connectedWallet]);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ totals: Record<string, CommissionLedgerTotal> }>("/api/ledger/commissions")
      .then((data) => {
        if (!cancelled) {
          setLedgerTotals(data.totals || {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLedgerTotals({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalLedger = Object.values(ledgerTotals).reduce((sum, row) => sum + Number(row.deposited || 0), 0);
  const paidLedger = Object.values(ledgerTotals).reduce((sum, row) => sum + Number(row.paid || 0), 0);

  const conditions = [
    {
      icon: Network,
      title: "A. 节点总量",
      desc: "全球节点总量限定为 36 个，名额稀缺。",
    },
    {
      icon: Crown,
      title: "B. 基石节点（前 10 名）",
      desc: "前 10 名节点为基石节点，只需完成社区总交易量达到 1000 万美金即可永久享受节点分红和节点代币空投。",
    },
    {
      icon: Trophy,
      title: "C. 竞选节点（第 11–36 个）",
      desc: "每月社区总交易量达到 300 万美金以上即可自动参与当月节点竞选名单，交易量排名前 26 名即可自动获取当月节点分红和后续代币空投资格。已经是基石节点的不重复计算节点奖励，交易量排名会在排除基石节点地址后顺延。",
    },
    {
      icon: ShieldCheck,
      title: "D. 节点申请规则",
      desc: "节点申请必须为无推荐关系的钱包地址申请，无需支付任何费用。",
    },
    {
      icon: Coins,
      title: "E. 节点权益",
      desc: "单个节点享受当月平台佣金收入的 0.5% 分红。",
    },
  ];

  const handleApply = async () => {
    let applicationWallet = walletAddress;
    if (!isConnected) {
      try {
        const signature = await connectInjectedWallet();
        applicationWallet = signature.address;
        setWalletAddress(signature.address);
      } catch (error) {
        toast({
          title: "真实钱包连接失败",
          description: error instanceof Error ? error.message : "请安装或解锁钱包后重试。",
          variant: "destructive",
        });
        return;
      }
    }
    if (!applicationWallet.trim()) {
      toast({ title: "请填写钱包地址", description: "申请前请输入您的钱包地址", variant: "destructive" });
      return;
    }
    try {
      await submitNodeApplication(applicationWallet.trim());
      toast({ title: "申请已提交", description: "节点申请已写入后端审核队列。" });
    } catch (error) {
      toast({
        title: "节点申请失败",
        description: error instanceof Error ? error.message : "请使用当前签名钱包提交申请。",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <Badge className="mb-3 bg-gradient-primary">节点计划</Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
            社区节点
          </h1>
          <p className="text-muted-foreground">参与共建生态，共享平台长期成长红利。</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card className="border-primary/30 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BadgeCheck className="h-4 w-4 text-primary" />
                节点身份标识
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-primary">
                  {latestApplication?.status === "approved" ? "基石节点" : latestApplication?.status === "pending" ? "审核中" : "未申请"}
                </Badge>
                <span className="text-xs text-muted-foreground">{latestApplication ? latestApplication.createdAt : "连接钱包后可申请"}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {latestApplication?.walletAddress || "暂无节点申请记录"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                佣金账本总额
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                {totalLedger.toFixed(6)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">后端 ledger 实时统计</p>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <History className="h-4 w-4 text-primary" />
                已支付佣金
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                {paidLedger.toFixed(6)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">链上支付事件确认后累计</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              节点申请入口
            </CardTitle>
            <CardDescription>无需任何费用，提交无推荐关系的钱包地址即可申请。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wallet">钱包地址</Label>
              <Input
                id="wallet"
                placeholder="请输入您的钱包地址（必须无推荐关系）"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="font-mono"
              />
            </div>
            <Button onClick={handleApply} className="w-full bg-gradient-primary hover:shadow-glow">
              提交节点申请
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>节点条件说明</CardTitle>
            <CardDescription>请仔细阅读以下条件后再提交申请。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {conditions.map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="p-4 border border-border rounded-lg bg-card/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{c.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="mt-10 pt-8 border-t border-border">
          <ShareContent />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Nodes;
