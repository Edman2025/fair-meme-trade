import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Droplet,
  ExternalLink,
  Copy,
  Heart,
  Share2,
  ArrowLeft,
  Twitter,
  Send
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TokenChart from "@/components/TokenChart";
import AdvancedTradingPanel from "@/components/AdvancedTradingPanel";
import ChartToolbar from "@/components/ChartToolbar";
import ChartBottomTabs from "@/components/ChartBottomTabs";
import OrderBook from "@/components/OrderBook";
import TokenLogo from "@/components/TokenLogo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMvp } from "@/contexts/MvpContext";
import { getExplorerAddressUrl } from "@/lib/chainConfig";
import { useChain } from "@/contexts/ChainContext";
import PonsTradingPanel from "@/components/PonsTradingPanel";

const TokenDetail = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { getTokenBySymbol, loadTokenByAddress, toggleFollow } = useMvp();
  const { activeChain } = useChain();
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [isResolvingToken, setIsResolvingToken] = useState(false);
  const [resolveAttemptedFor, setResolveAttemptedFor] = useState("");
  
  const token = getTokenBySymbol(symbol);
  const resolveKey = `${activeChain.key}:${symbol || ""}`;
  useEffect(() => {
    if (token || resolveAttemptedFor === resolveKey || activeChain.key !== "robinhood-mainnet" || !/^0x[a-fA-F0-9]{40}$/.test(symbol || "")) return;
    setResolveAttemptedFor(resolveKey);
    setIsResolvingToken(true);
    void loadTokenByAddress(symbol || "")
      .catch(() => undefined)
      .finally(() => setIsResolvingToken(false));
  }, [activeChain.key, loadTokenByAddress, resolveAttemptedFor, resolveKey, symbol, token]);

  useEffect(() => {
    if (token?.protocol !== "pons-v2") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadTokenByAddress(token.contractAddress).catch(() => undefined);
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadTokenByAddress, token?.contractAddress, token?.protocol]);

  if (!token) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 mb-6">
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </Button>
          <div className="rounded border border-dashed border-border p-8 text-center">
            <h1 className="text-2xl font-bold mb-3">{isResolvingToken ? "正在读取链上项目" : "项目未找到"}</h1>
            <p className="mb-6 break-all text-muted-foreground">
              {isResolvingToken
                ? `${symbol || ""} 正在从 PONS V2 合约读取项目与 curve 状态。`
                : `${(symbol || "").toUpperCase()} 未在当前链找到对应项目，请确认网络与合约地址。`}
            </p>
            <Button onClick={() => navigate("/")}>返回市场</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  const isPositive = token.change24h >= 0;
  
  const creatorWallet = token.creatorWallet;

  // Format address: first 4 chars + ... + last 6 chars
  const formatAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-6)}`;
  };

  const handleCopyAddress = (address: string, type: string) => {
    navigator.clipboard.writeText(address);
    toast({
      title: t("success"),
      description: `${type} address copied to clipboard`,
    });
  };

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const text = `Check out ${token.name} (${token.symbol}) on ${activeChain.chainName}!`;
    
    if (platform === "twitter") {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
    } else if (platform === "telegram") {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank");
    }
    
    toast({ title: "Shared!", description: `Shared on ${platform}` });
  };

  const handleCreatorWalletClick = () => {
    navigate(`/wallet/${creatorWallet}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      
      <main className="container mx-auto px-4 py-4">
        {/* Token Header - Comprehensive Info */}
        <div className="mb-4">
          <div className="mb-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-start">
            <div className="flex min-w-0 items-start gap-3">
              <TokenLogo value={token.logo} symbol={token.symbol} className="h-14 w-14 shrink-0 text-3xl sm:h-16 sm:w-16 sm:text-4xl" />
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1 className="min-w-0 break-all text-2xl font-bold sm:text-3xl">{token.symbol}/{token.lpPairToken}</h1>
                  <Button
                    variant={token.isFollowing ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      toggleFollow(token.symbol);
                      toast({ title: token.isFollowing ? "已取消关注" : "已加入关注" });
                    }}
                  >
                    <Heart className={`h-4 w-4 ${token.isFollowing ? "fill-current" : ""}`} />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleShare("twitter")}>
                    <Twitter className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleShare("telegram")}>
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                    <a href={token.launchTxHash ? `${activeChain.blockExplorerUrls[0]}/tx/${token.launchTxHash}` : getExplorerAddressUrl(token.contractAddress, activeChain)} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">CA:</span>
                    <span className="text-sm font-mono text-foreground">{formatAddress(token.contractAddress)}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyAddress(token.contractAddress, "Contract")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                      <a href={getExplorerAddressUrl(token.contractAddress, activeChain)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                    <div className="flex flex-wrap items-center gap-2 sm:ml-2">
                      <Badge variant="outline" className="text-xs">协议: {token.protocol === "pons-v2" ? "PONS V2" : "Fair Meme V3"}</Badge>
                      <Badge variant="outline" className="text-xs">基础费: {((token.feeBps || 100) / 100).toFixed(2)}%</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">DEV:</span>
                    <span 
                      className="text-sm font-mono text-foreground cursor-pointer hover:text-primary transition-colors" 
                      onClick={handleCreatorWalletClick}
                    >
                      {formatAddress(creatorWallet)}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyAddress(creatorWallet, "Creator wallet")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                      <a href={getExplorerAddressUrl(creatorWallet, activeChain)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Price, 24h Change, and Project Description */}
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <div className="flex flex-col items-start gap-1 lg:items-end">
                <div className="text-2xl font-bold">{token.currentPrice || "等待同步"}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{token.name}</span>
                  {token.marketMetricsReady && token.change24hReady !== false ? (
                    <div className={`flex items-center gap-1 ${isPositive ? "text-success" : "text-destructive"}`}>
                      {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                      <span className="font-semibold text-lg">{isPositive ? "+" : ""}{token.change24h.toFixed(2)}%</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">{token.protocol === "pons-v2" ? "24h 未聚合" : "指标同步中"}</span>
                  )}
                </div>
              </div>
              
              {/* Project Description */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs">
                    项目说明
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="absolute right-0 mt-2 w-80 p-4 bg-card rounded-lg border border-border/50 shadow-lg z-10">
                  <p className="text-sm text-muted-foreground leading-relaxed">{token.description}</p>
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <h4 className="font-semibold mb-2">项目规则</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>{token.protocol === "pons-v2" ? `PONS curve 基础费 ${((token.feeBps || 0) / 100).toFixed(2)}%，创建者附加费 ${((token.creatorTaxBps || 0) / 100).toFixed(2)}%` : "平台收取每笔交易1%作为手续费"}</li>
                      {token.hasDividend && <li>持币分红: 每笔交易2%分配给持币者</li>}
                      {token.hasBurn && <li>燃烧机制: 每笔交易2%自动销毁</li>}
                      {token.hasMarketing && <li>营销基金: 每笔交易2%用于市场推广</li>}
                    </ul>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Key Stats Grid - Enhanced */}
            <div className="grid grid-cols-2 gap-3 rounded border border-border/50 bg-card/50 p-3 sm:grid-cols-3 lg:w-[22rem]">
              <div>
                <p className="text-xs text-muted-foreground mb-1">代币总量</p>
                <p className="text-sm font-bold">{token.totalSupply}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">LP人数</p>
                <p className="text-sm font-bold">{token.protocol === "pons-v2" ? "未聚合" : token.lpCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">持有人数</p>
                <p className="text-sm font-bold">{token.protocol === "pons-v2" ? "未聚合" : token.holders.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("marketCap")}</p>
                <p className="text-sm font-bold">{token.marketCap}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">池子金额</p>
                <p className="text-sm font-bold text-secondary">{token.poolAmount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">24h交易额</p>
                <p className="text-sm font-bold">{token.volume24h}</p>
              </div>
            </div>
          </div>
        </div>

        {token.protocol === "pons-v2" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="min-w-0 border-y border-border py-6 lg:col-span-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">PONS V2 launch state</p>
                  <h2 className="mt-1 text-xl font-semibold">{token.graduated ? "已毕业至 Uniswap V4" : "Bonding curve 交易中"}</h2>
                </div>
                <span className="text-2xl font-bold text-emerald-400">{token.graduated ? "100%" : `${token.graduationProgress?.toFixed(2) || "0.00"}%`}</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-emerald-400" style={{ width: `${token.graduated ? 100 : Math.max(0, Math.min(100, token.graduationProgress || 0))}%` }} />
              </div>
              <div className="mt-8 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
                <div className="min-w-0 bg-background p-4"><p className="text-xs text-muted-foreground">Token</p><p className="mt-2 break-all font-mono text-sm">{token.contractAddress}</p></div>
                <div className="min-w-0 bg-background p-4"><p className="text-xs text-muted-foreground">Curve</p><p className="mt-2 break-all font-mono text-sm">{token.curveAddress}</p></div>
                <div className="bg-background p-4"><p className="text-xs text-muted-foreground">Quote asset</p><p className="mt-2 font-semibold">{token.lpPairToken}</p></div>
                <div className="bg-background p-4"><p className="text-xs text-muted-foreground">流动性策略</p><p className="mt-2 font-semibold">毕业后永久锁定 V4 position</p></div>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">PONS 行情来自当前 curve 储备。24 小时 K 线和持仓聚合尚未建立时不展示推算或占位数据。</p>
            </div>
            <div className="lg:col-span-4">
              <PonsTradingPanel tokenSymbol={token.contractAddress} />
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left - Chart Toolbar */}
          <div className={isToolbarCollapsed ? 'lg:col-span-1' : 'lg:col-span-2'}>
            <ChartToolbar onCollapseChange={setIsToolbarCollapsed} />
          </div>

          {/* Center - Chart and Data */}
          <div className={`space-y-4 transition-all duration-300 ${isToolbarCollapsed ? 'lg:col-span-8' : 'lg:col-span-7'}`}>
            <TokenChart symbol={token.symbol} />
            <ChartBottomTabs tokenSymbol={token.symbol} />
          </div>

          {/* Right - Advanced Trading Panel */}
          <div className="lg:col-span-3 space-y-4">
            <AdvancedTradingPanel tokenSymbol={token.symbol} tokenPrice={Number(token.currentPrice.replace(/[^0-9.]/g, "")) || 0} />
            <OrderBook symbol={token.symbol} />
          </div>
        </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default TokenDetail;
