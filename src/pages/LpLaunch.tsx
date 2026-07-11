import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { CountdownTimer } from "@/components/CountdownTimer";
import { LpNotifications } from "@/components/LpNotifications";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useMvp } from "@/contexts/MvpContext";
import { canUseRealChain } from "@/lib/chainConfig";
import { addLiquidityEthAndLock, releaseVaultPositionAmount, withdrawVaultPosition } from "@/lib/pancakeSwap";
import { apiRequest } from "@/lib/backendApi";
import { enableDemoFallback } from "@/lib/runtimeFlags";
import TokenLogo from "@/components/TokenLogo";
import { 
  ArrowLeft, 
  Copy, 
  Clock, 
  Lock, 
  TrendingUp, 
  Users,
  Droplet,
  Calendar,
  Globe,
  Twitter,
  Send,
  Info,
  Activity
} from "lucide-react";

const parseLpAmount = (value?: string) => {
  const match = String(value || "0").replace(/,/g, "").match(/[0-9]+(?:\.[0-9]+)?/);
  return match?.[0] || "0";
};

const LpLaunch = () => {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { getTokenBySymbol, lpPositions, addLpPosition, isConnected, connectInjectedWallet, walletAddress } = useMvp();
  const [lpAmount, setLpAmount] = useState("");
  const [bnbAmount, setBnbAmount] = useState("");
  const [isSubmittingLp, setIsSubmittingLp] = useState(false);
  const [isWithdrawingLp, setIsWithdrawingLp] = useState(false);
  const [currency, setCurrency] = useState<"BNB" | "USDT">("BNB");
  
  const token = getTokenBySymbol(symbol);
  const requestedSymbol = (symbol || "").toUpperCase();
  const tokenNotFound = !token || (requestedSymbol && token.symbol.toUpperCase() !== requestedSymbol);
  const userPosition = tokenNotFound ? undefined : lpPositions.find((position) => position.tokenSymbol === token.symbol && position.phase === "launch");
  const tokenPositions = tokenNotFound ? [] : lpPositions.filter((position) => position.tokenSymbol === token.symbol);
  const recentActivities = tokenPositions.slice(0, 5).map((position) => ({
    address: position.lpTokenAddress ? `${position.lpTokenAddress.slice(0, 6)}...${position.lpTokenAddress.slice(-4)}` : "Vault",
    amount: position.userLpAmount,
    type: "LP",
    value: position.userLpValue,
    time: position.lockEndDate,
  }));
  const data = token ? {
    logo: token.logo,
    name: token.name,
    symbol: token.symbol,
    totalSupply: token.totalSupply,
    contractAddress: token.contractAddress,
    creatorLpAmount: userPosition?.userLpAmount || "0 LP",
    creatorLpValue: userPosition?.userLpValue || "0 LP",
    totalLaunchLp: token.totalSupply,
    minPerPerson: "1",
    maxPerPerson: "1,000,000,000",
    totalSlots: 100,
    claimedSlots: Math.min(token.lpCount, 100),
    launchDeadline: token.launchDeadline || "等待 indexer 同步",
    tradingStartTime: token.tradingStartTime || "等待 indexer 同步",
    lockPeriod: `${token.lockPeriodDays || 30}天`,
    releaseType: token.releaseType === "oneTime" ? "once" : "linear",
    releaseLinearDays: token.releaseLinearDays || 0,
    marketingTax: token.hasMarketing ? 2 : 0,
    dividendTax: token.hasDividend ? 3 : 0,
    burnTax: token.hasBurn ? 1 : 0,
    description: token.description,
    website: token.website,
    twitter: token.twitter,
    telegram: token.telegram,
    userLpAmount: userPosition?.userLpAmount || "0",
    userLpValue: userPosition?.userLpValue || "0",
    expectedWithdraw: userPosition?.expectedWithdraw || "0",
    withdrawnAmount: userPosition?.withdrawnAmount || "0",
    roi: userPosition?.roi || 0,
    lockEndDate: userPosition?.lockEndDate || "—",
    linearReleaseEndDate: userPosition?.linearReleaseEndDate || "",
    totalParticipants: tokenPositions.length,
    recentActivities,
  } : null;
  const claimProgress = data ? (data.claimedSlots / data.totalSlots) * 100 : 0;
  const hasUserLp = data ? parseFloat(data.userLpAmount.replace(/,/g, "")) > 0 : false;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: t("copied"),
      description: t("copiedToClipboard"),
    });
  };

  const handleAddLp = async () => {
    if (!isConnected) {
      try {
        const signature = await connectInjectedWallet();
        toast({
          title: signature.mode === "wallet" ? "真实钱包已签名" : "已连接演示钱包",
          description: signature.mode === "wallet" ? "LP 添加将记录到当前钱包地址。" : "已启用开发演示钱包。",
        });
      } catch (error) {
        toast({
          title: "真实钱包连接失败",
          description: error instanceof Error ? error.message : "请安装或解锁钱包后重试。",
          variant: "destructive",
        });
        return;
      }
    }
    if (!lpAmount || parseFloat(lpAmount) === 0) {
      toast({
        title: t("error"),
        description: "请输入LP数量",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(lpAmount.replace(/,/g, ""));
    const min = parseFloat(data.minPerPerson.replace(/,/g, ""));
    const max = parseFloat(data.maxPerPerson.replace(/,/g, ""));

    if (amount < min || amount > max) {
      toast({
        title: t("error"),
        description: `LP数量必须在 ${data.minPerPerson} - ${data.maxPerPerson} 之间`,
        variant: "destructive",
      });
      return;
    }

    if (currency !== "BNB") {
      toast({ title: "暂不支持", description: "当前真实 LP 闭环先支持 BNB 交易对。", variant: "destructive" });
      return;
    }
    if (!bnbAmount || parseFloat(bnbAmount) <= 0) {
      toast({ title: t("error"), description: "请输入 BNB 数量", variant: "destructive" });
      return;
    }

    setIsSubmittingLp(true);
    try {
      if (canUseRealChain() && token.contractAddress) {
        const unlockAt = Math.floor(Date.now() / 1000) + (token.lockPeriodDays || 30) * 24 * 60 * 60;
        const releaseStart = unlockAt;
        const releaseEnd = token.releaseType === "linear"
          ? releaseStart + (token.releaseLinearDays || 0) * 24 * 60 * 60
          : releaseStart;
        const result = await addLiquidityEthAndLock({
          tokenAddress: token.contractAddress,
          tokenAmount: lpAmount.replace(/,/g, ""),
          bnbAmount,
          slippagePercent: 1,
          unlockAt,
          releaseType: token.releaseType === "linear" ? "linear" : "once",
          releaseStart,
          releaseEnd,
        });
        await apiRequest("/api/chain-transactions", {
          method: "POST",
          body: JSON.stringify({
            txHash: result.addLiquidityTxHash,
            action: "addLiquidity",
            tokenAddress: token.contractAddress,
            walletAddress,
            status: "submitted",
            payload: { pairAddress: result.pairAddress, bnbAmount, tokenAmount: lpAmount },
          }),
        });
        if (result.lockTxHash) {
          await apiRequest("/api/chain-transactions", {
            method: "POST",
            body: JSON.stringify({
              txHash: result.lockTxHash,
              action: "lockLp",
              tokenAddress: token.contractAddress,
              walletAddress,
              status: "submitted",
              payload: { pairAddress: result.pairAddress, lpAmount: result.lpAmount, unlockAt, releaseStart, releaseEnd },
            }),
          });
        }
        toast({
          title: result.lockTxHash ? "LP 已添加并提交锁仓" : "LP 添加交易已提交",
          description: result.lockTxHash
            ? `Vault lock: ${result.lockTxHash.slice(0, 10)}...，等待 indexer 同步仓位。`
            : `${result.message}，请等待交易确认后再次锁仓。`,
        });
      } else {
        if (!enableDemoFallback) {
          throw new Error("缺少真实链上配置，线上环境不会创建本地 LP 仓位。");
        }
        addLpPosition(data.symbol, lpAmount, currency, "launch");
        toast({ title: t("success"), description: "LP添加成功！" });
      }
      setLpAmount("");
      setBnbAmount("");
    } catch (error) {
      toast({
        title: "LP 添加失败",
        description: error instanceof Error ? error.message : "请检查钱包、余额和 approve 状态。",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingLp(false);
    }
  };

  const handleWithdraw = async () => {
    if (!userPosition?.onChainPositionId) {
      toast({
        title: "暂无链上锁仓记录",
        description: "请等待 LP Vault 事件被 indexer 同步后再提取。",
        variant: "destructive",
      });
      return;
    }

    setIsWithdrawingLp(true);
    try {
      const releasable = parseLpAmount(userPosition.expectedWithdraw);
      const result = data.releaseType === "linear" && Number(releasable) > 0
        ? await releaseVaultPositionAmount(userPosition.onChainPositionId, releasable)
        : await withdrawVaultPosition(userPosition.onChainPositionId);
      await apiRequest("/api/chain-transactions", {
        method: "POST",
        body: JSON.stringify({
          txHash: result.txHash,
          action: data.releaseType === "linear" && Number(releasable) > 0 ? "releaseLp" : "withdrawLp",
          tokenAddress: token.contractAddress,
          walletAddress: walletAddress || result.account,
          status: "submitted",
          payload: {
            positionId: userPosition.onChainPositionId,
            amount: data.releaseType === "linear" && Number(releasable) > 0 ? releasable : undefined,
          },
        }),
      });
      toast({
        title: "LP 提取交易已提交",
        description: `${result.txHash.slice(0, 10)}...，最终状态以 indexer 回写为准。`,
      });
    } catch (error) {
      toast({
        title: "LP 提取失败",
        description: error instanceof Error ? error.message : "请检查钱包、锁仓时间和可释放数量。",
        variant: "destructive",
      });
    } finally {
      setIsWithdrawingLp(false);
    }
  };

  if (tokenNotFound || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 mb-6">
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </Button>
          <Card className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-3">项目未找到</h1>
            <p className="text-muted-foreground mb-6">
              {requestedSymbol} 正在确认链上交易，页面会在同步完成后自动更新，通常只需几秒。
            </p>
            <Button onClick={() => navigate("/")}>返回市场</Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <LpNotifications 
        launchDeadline={data.launchDeadline}
        tradingStartTime={data.tradingStartTime}
      />
      
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* 返回按钮 */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Button>

        {/* 代币基本信息 */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <TokenLogo value={data.logo} symbol={data.symbol} className="h-16 w-16 shrink-0 text-xl" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">{data.name}</h1>
                <p className="text-muted-foreground">{data.symbol}</p>
              </div>
            </div>
            <Badge className="bg-accent/20 text-accent">发射阶段</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">代币总供应量</span>
                <span className="font-semibold">{data.totalSupply}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">合约地址</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{data.contractAddress.slice(0, 10)}...</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(data.contractAddress)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">发起方LP数量</span>
                <span className="font-semibold">{data.creatorLpAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">发起方LP金额</span>
                <span className="font-semibold text-primary">{data.creatorLpValue}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">发射合约LP总量</span>
                <span className="font-semibold">{data.totalLaunchLp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">单人可添加LP</span>
                <span className="font-semibold">{data.minPerPerson} - {data.maxPerPerson}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">发射截止日期</span>
                <span className="font-semibold flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {data.launchDeadline}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">交易开始时间</span>
                <span className="font-semibold flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {data.tradingStartTime}
                </span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* 发射名额进度 */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                发射名额
              </span>
              <span className="font-semibold">
                {data.claimedSlots}/{data.totalSlots}
              </span>
            </div>
            <Progress value={claimProgress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">
              已认领 {data.claimedSlots} 个，剩余 {data.totalSlots - data.claimedSlots} 个
            </p>
          </div>

          <Separator className="my-6" />

          {/* 倒计时信息 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <CountdownTimer 
              targetDate={data.launchDeadline}
              label="距离发射截止"
            />
            <CountdownTimer 
              targetDate={data.tradingStartTime}
              label="距离交易开始"
            />
            <CountdownTimer 
              targetDate={data.lockEndDate}
              label="距离锁仓到期"
            />
          </div>

          <Separator className="my-6" />

          {/* LP锁仓信息 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-card/50 rounded-lg border border-border/50">
              <Lock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">LP锁仓时间</p>
                <p className="font-semibold">{data.lockPeriod}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-card/50 rounded-lg border border-border/50">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">释放方式</p>
                <p className="font-semibold">
                  {data.releaseType === "once" ? "一次性释放" : `${data.releaseLinearDays}天线性释放`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-card/50 rounded-lg border border-border/50">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">锁仓到期日</p>
                <p className="font-semibold">{data.lockEndDate}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* 实时参与统计 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 参与人数统计 */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              实时参与统计
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">总参与人数</p>
                  <p className="text-3xl font-bold text-primary">{data.totalParticipants}</p>
                </div>
                <Activity className="h-12 w-12 text-primary/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-card/50 rounded-lg border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">已认领名额</p>
                  <p className="text-xl font-bold">{data.claimedSlots}</p>
                </div>
                <div className="p-3 bg-card/50 rounded-lg border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">剩余名额</p>
                  <p className="text-xl font-bold">{data.totalSlots - data.claimedSlots}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* 最近添加记录 */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              最近添加LP
            </h2>
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {data.recentActivities.length > 0 ? data.recentActivities.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border/50 hover:border-primary/20 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm">{activity.address}</span>
                      <Badge variant="outline" className="text-xs">
                        {activity.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {activity.amount} 代币 · {activity.value}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {activity.time}
                  </span>
                </div>
              )) : (
                <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                  暂无真实 LP 锁仓记录
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* 添加LP区域 */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Droplet className="h-5 w-5 text-primary" />
            添加LP
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                LP代币数量
              </label>
              <Input
                type="text"
                placeholder={`最少 ${data.minPerPerson}, 最多 ${data.maxPerPerson}`}
                value={lpAmount}
                onChange={(e) => setLpAmount(e.target.value)}
                className="text-lg"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                BNB 数量
              </label>
              <Input
                type="number"
                placeholder="例如 0.05"
                value={bnbAmount}
                onChange={(e) => setBnbAmount(e.target.value)}
                className="text-lg"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                支付币种
              </label>
              <div className="flex gap-3">
                <Button
                  variant={currency === "BNB" ? "default" : "outline"}
                  onClick={() => setCurrency("BNB")}
                  className="flex-1"
                >
                  BNB
                </Button>
                <Button
                  variant={currency === "USDT" ? "default" : "outline"}
                  onClick={() => setCurrency("USDT")}
                  disabled
                  className="flex-1"
                >
                  USDT
                </Button>
              </div>
            </div>

            <Button
              onClick={handleAddLp}
              disabled={isSubmittingLp}
              className="w-full bg-gradient-primary hover:opacity-90"
              size="lg"
            >
              {isSubmittingLp ? "链上提交中..." : "确认添加LP并锁仓"}
            </Button>

            <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• 添加LP后，代币将被锁定至发射截止日期</p>
                  <p>• 交易开始后，LP将继续锁定{data.lockPeriod}</p>
                  <p>• 锁仓期结束后可提取，支持{data.releaseType === "linear" ? "线性" : "一次性"}释放</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 我的LP信息（如果已添加） */}
        {hasUserLp && (
          <Card className="p-6 border-primary/50">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Droplet className="h-5 w-5 text-primary" />
              我的LP信息
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">LP代币数量</p>
                <p className="text-lg font-bold text-foreground">{data.userLpAmount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">LP金额</p>
                <p className="text-lg font-bold text-primary">{data.userLpValue}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">预期可提取</p>
                <p className="text-lg font-bold text-success">{data.expectedWithdraw}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">已提取金额</p>
                <p className="text-lg font-bold text-foreground">{data.withdrawnAmount}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">收益率</p>
                <p className="text-lg font-bold text-success">+{data.roi}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">锁仓截止日期</p>
                <p className="text-sm font-semibold">{data.lockEndDate}</p>
              </div>
              {data.releaseType === "linear" && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">线性释放截止日期</p>
                  <p className="text-sm font-semibold">{data.linearReleaseEndDate}</p>
                </div>
              )}
            </div>

            <Button
              onClick={handleWithdraw}
              disabled={isWithdrawingLp}
              className="w-full"
              size="lg"
              variant="outline"
            >
              {isWithdrawingLp ? "链上提交中..." : "提取LP"}
            </Button>
          </Card>
        )}

        {/* 项目详情 */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">项目介绍</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            {data.description}
          </p>

          <Separator className="my-6" />

          <h3 className="text-lg font-bold mb-4">税收详情</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-card/50 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">营销税</p>
              <p className="text-2xl font-bold text-primary">{data.marketingTax}%</p>
            </div>
            <div className="p-4 bg-card/50 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">分红税</p>
              <p className="text-2xl font-bold text-success">{data.dividendTax}%</p>
            </div>
            <div className="p-4 bg-card/50 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">销毁税</p>
              <p className="text-2xl font-bold text-destructive">{data.burnTax}%</p>
            </div>
          </div>

          <Separator className="my-6" />

          <h3 className="text-lg font-bold mb-4">项目链接</h3>
          <div className="flex flex-wrap gap-3">
            {data.website && (
              <Button
                variant="outline"
                onClick={() => window.open(data.website, "_blank")}
                className="gap-2"
              >
                <Globe className="h-4 w-4" />
                官网
              </Button>
            )}
            {data.twitter && (
              <Button
                variant="outline"
                onClick={() => window.open(data.twitter, "_blank")}
                className="gap-2"
              >
                <Twitter className="h-4 w-4" />
                Twitter
              </Button>
            )}
            {data.telegram && (
              <Button
                variant="outline"
                onClick={() => window.open(data.telegram, "_blank")}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Telegram
              </Button>
            )}
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default LpLaunch;
