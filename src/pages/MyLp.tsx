import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CountdownTimer } from "@/components/CountdownTimer";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useMvp } from "@/contexts/MvpContext";
import { withdrawVaultPosition } from "@/lib/pancakeSwap";
import { enableDemoFallback } from "@/lib/runtimeFlags";
import TokenLogo from "@/components/TokenLogo";
import { 
  ArrowLeft,
  Copy,
  Droplet,
  TrendingUp,
  Calendar,
  Lock,
  Globe,
  Twitter,
  Send,
  Users
} from "lucide-react";

const MyLp = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { lpPositions, tokens, withdrawLp } = useMvp();
  const [activeTab, setActiveTab] = useState<"launch" | "trading">("launch");

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: t("copied"),
      description: t("copiedToClipboard"),
    });
  };

  const handleWithdraw = async (positionId: string, projectName: string, onChainPositionId?: number) => {
    try {
      if (onChainPositionId) {
        const result = await withdrawVaultPosition(onChainPositionId);
        toast({
          title: "LP 提取交易已提交",
          description: `${projectName}: ${result.txHash.slice(0, 10)}...`,
        });
        return;
      }
      if (!enableDemoFallback) {
        throw new Error("该 LP 仓位尚未同步链上 positionId，请等待 indexer 回写后再提取。");
      }
      withdrawLp(positionId);
      toast({
        title: t("success"),
        description: `${projectName} LP提取成功！`,
      });
    } catch (error) {
      toast({
        title: "LP 提取失败",
        description: error instanceof Error ? error.message : "请检查钱包和锁仓到期时间。",
        variant: "destructive",
      });
    }
  };

  const mvpProjects = lpPositions.map((position) => {
    const token = tokens.find((item) => item.symbol === position.tokenSymbol || item.contractAddress.toLowerCase() === position.tokenAddress?.toLowerCase());
    const displaySymbol = token?.symbol || position.tokenSymbol || "UNKNOWN";
    const displayName = token?.name || `LP ${displaySymbol}`;
    const contractAddress = token?.contractAddress || position.tokenAddress || position.lpTokenAddress || "";
    return {
      id: position.id,
      logo: token?.logo || displaySymbol.slice(0, 2).toUpperCase(),
      name: displayName,
      symbol: displaySymbol,
      totalSupply: token?.totalSupply || "-",
      contractAddress,
      creatorLpAmount: position.userLpAmount,
      creatorLpValue: position.userLpValue,
      totalLaunchLp: token?.totalSupply || "-",
      minPerPerson: "1份",
      maxPerPerson: "1份",
      totalSlots: 100,
      claimedSlots: Math.min(token?.lpCount || 0, 100),
      launchDeadline: token?.launchDeadline || "等待 indexer 同步",
      tradingStartTime: token?.tradingStartTime || "等待 indexer 同步",
      lockPeriod: `${token?.lockPeriodDays || 30}天`,
      releaseType: token?.releaseType === "oneTime" ? "once" : "linear",
      releaseLinearDays: token?.releaseLinearDays || 0,
      marketingTax: token?.hasMarketing ? 2 : 0,
      dividendTax: token?.hasDividend ? 3 : 0,
      burnTax: token?.hasBurn ? 1 : 0,
      description: token?.description || "该 LP 仓位来自后端/indexer，项目元数据仍在同步。",
      website: token?.website,
      twitter: token?.twitter,
      telegram: token?.telegram,
      ...position,
    };
  });

  const launchProjects = mvpProjects.filter((project) => project.phase === "launch");
  const tradingProjects = mvpProjects.filter((project) => project.phase === "trading");

  const renderLpProject = (project: (typeof mvpProjects)[number]) => (
    <Card key={project.id} className="p-6 space-y-6">
      {/* 项目基本信息 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <TokenLogo value={project.logo} symbol={project.symbol} className="h-16 w-16 shrink-0 text-xl" />
          <div>
            <h2 className="text-2xl font-bold text-foreground">{project.name}</h2>
            <p className="text-muted-foreground">{project.symbol}</p>
          </div>
        </div>
        <Badge className="bg-accent/20 text-accent">
          {activeTab === "launch" ? "发射阶段" : "交易中"}
        </Badge>
      </div>

      <Separator />

      {/* 代币信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">代币总供应量</span>
            <span className="font-semibold">{project.totalSupply}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">合约地址</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{project.contractAddress ? `${project.contractAddress.slice(0, 10)}...` : "-"}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={!project.contractAddress}
                onClick={() => handleCopy(project.contractAddress)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">发起方LP数量</span>
            <span className="font-semibold">{project.creatorLpAmount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">发起方LP金额</span>
            <span className="font-semibold text-primary">{project.creatorLpValue}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">发射合约LP总量</span>
            <span className="font-semibold">{project.totalLaunchLp}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">单人可添加LP</span>
            <span className="font-semibold">{project.minPerPerson} - {project.maxPerPerson}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">发射名额</span>
            <span className="font-semibold">
              {project.claimedSlots}/{project.totalSlots}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">发射截止日期</span>
            <span className="font-semibold flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {project.launchDeadline}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* 倒计时 */}
      {activeTab === "launch" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CountdownTimer 
              targetDate={project.launchDeadline}
              label="距离发射截止"
            />
            <CountdownTimer 
              targetDate={project.tradingStartTime}
              label="距离交易开始"
            />
            <CountdownTimer 
              targetDate={project.lockEndDate}
              label="距离锁仓到期"
            />
          </div>
          <Separator />
        </>
      )}

      {/* LP锁仓信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-4 bg-card/50 rounded-lg border border-border/50">
          <Lock className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">LP锁仓时间</p>
            <p className="font-semibold">{project.lockPeriod}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-card/50 rounded-lg border border-border/50">
          <TrendingUp className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">释放方式</p>
            <p className="font-semibold">
              {project.releaseType === "once" ? "一次性释放" : `${project.releaseLinearDays}天线性释放`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-card/50 rounded-lg border border-border/50">
          <Calendar className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">锁仓到期日</p>
            <p className="font-semibold">{project.lockEndDate}</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* 我的LP信息 */}
      <div className="bg-primary/5 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Droplet className="h-5 w-5 text-primary" />
          我的LP信息
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">LP代币数量</p>
            <p className="text-lg font-bold text-foreground">{project.userLpAmount}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">LP金额</p>
            <p className="text-lg font-bold text-primary">{project.userLpValue}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">预期可提取</p>
            <p className="text-lg font-bold text-success">{project.expectedWithdraw}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">已提取金额</p>
            <p className="text-lg font-bold text-foreground">{project.withdrawnAmount}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">收益率</p>
            <p className="text-lg font-bold text-success">+{project.roi}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">锁仓截止日期</p>
            <p className="text-sm font-semibold">{project.lockEndDate}</p>
          </div>
          {project.releaseType === "linear" && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">线性释放截止日期</p>
              <p className="text-sm font-semibold">{project.linearReleaseEndDate}</p>
            </div>
          )}
        </div>

        <Button
          onClick={() => handleWithdraw(project.id, project.name, project.onChainPositionId)}
          className="w-full"
          size="lg"
        >
          提取LP
        </Button>
      </div>

      <Separator />

      {/* 项目介绍 */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">项目介绍</h3>
        <p className="text-muted-foreground leading-relaxed">
          {project.description}
        </p>
      </div>

      {/* 税收详情 */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">税收详情</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-card/50 rounded-lg border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">营销税</p>
            <p className="text-2xl font-bold text-primary">{project.marketingTax}%</p>
          </div>
          <div className="p-4 bg-card/50 rounded-lg border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">分红税</p>
            <p className="text-2xl font-bold text-success">{project.dividendTax}%</p>
          </div>
          <div className="p-4 bg-card/50 rounded-lg border border-border/50">
            <p className="text-sm text-muted-foreground mb-1">销毁税</p>
            <p className="text-2xl font-bold text-destructive">{project.burnTax}%</p>
          </div>
        </div>
      </div>

      {/* 项目链接 */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">项目链接</h3>
        <div className="flex flex-wrap gap-3">
          {project.website && (
            <Button
              variant="outline"
              onClick={() => window.open(project.website, "_blank")}
              className="gap-2"
            >
              <Globe className="h-4 w-4" />
              官网
            </Button>
          )}
          {project.twitter && (
            <Button
              variant="outline"
              onClick={() => window.open(project.twitter, "_blank")}
              className="gap-2"
            >
              <Twitter className="h-4 w-4" />
              Twitter
            </Button>
          )}
          {project.telegram && (
            <Button
              variant="outline"
              onClick={() => window.open(project.telegram, "_blank")}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Telegram
            </Button>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Button>

        <div>
          <h1 className="text-3xl font-bold mb-2">我的LP</h1>
          <p className="text-muted-foreground">
            查看和管理您参与的所有LP项目
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "launch" | "trading")}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="launch" className="gap-2">
              <Droplet className="h-4 w-4" />
              发射阶段LP ({launchProjects.length})
            </TabsTrigger>
            <TabsTrigger value="trading" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              开盘后LP ({tradingProjects.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="launch" className="space-y-6 mt-6">
            {launchProjects.length > 0 ? (
              launchProjects.map(renderLpProject)
            ) : (
              <Card className="p-12 text-center">
                <Droplet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无发射阶段LP项目</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="trading" className="space-y-6 mt-6">
            {tradingProjects.length > 0 ? (
              tradingProjects.map(renderLpProject)
            ) : (
              <Card className="p-12 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无开盘后LP项目</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default MyLp;
