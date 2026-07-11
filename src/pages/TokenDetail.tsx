import { useState } from "react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMvp } from "@/contexts/MvpContext";
import { getExplorerAddressUrl } from "@/lib/chainConfig";

const TokenDetail = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { getTokenBySymbol, toggleFollow } = useMvp();
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  
  const token = getTokenBySymbol(symbol);
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
            <h1 className="text-2xl font-bold mb-3">项目未找到</h1>
            <p className="text-muted-foreground mb-6">
              {(symbol || "").toUpperCase()} 尚未被后端或 indexer 同步，请稍后刷新。
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
    const text = `Check out ${token.name} (${token.symbol}) on BSC!`;
    
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
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-gradient-primary flex items-center justify-center text-4xl font-bold">
                {token.logo}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-3xl font-bold">{token.symbol}/{token.lpPairToken}</h1>
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
                    <a href="#" target="_blank" rel="noopener noreferrer">
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
                      <a href={getExplorerAddressUrl(token.contractAddress)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge variant="outline" className="text-xs">买入: 1%</Badge>
                      <Badge variant="outline" className="text-xs">卖出: 1%</Badge>
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
                      <a href={getExplorerAddressUrl(creatorWallet)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Price, 24h Change, and Project Description */}
            <div className="flex flex-col items-end gap-3">
              <div className="flex flex-col items-end gap-1">
                <div className="text-2xl font-bold">{token.currentPrice || "等待同步"}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{token.name}</span>
                  {token.marketMetricsReady ? (
                    <div className={`flex items-center gap-1 ${isPositive ? "text-success" : "text-destructive"}`}>
                      {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                      <span className="font-semibold text-lg">{isPositive ? "+" : ""}{token.change24h.toFixed(2)}%</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">指标同步中</span>
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
                      <li>平台收取每笔交易1%作为手续费</li>
                      {token.hasDividend && <li>持币分红: 每笔交易2%分配给持币者</li>}
                      {token.hasBurn && <li>燃烧机制: 每笔交易2%自动销毁</li>}
                      {token.hasMarketing && <li>营销基金: 每笔交易2%用于市场推广</li>}
                    </ul>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Key Stats Grid - Enhanced */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-card/50 rounded-lg border border-border/50">
              <div>
                <p className="text-xs text-muted-foreground mb-1">代币总量</p>
                <p className="text-sm font-bold">{token.totalSupply}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">LP人数</p>
                <p className="text-sm font-bold">{token.lpCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">持有人数</p>
                <p className="text-sm font-bold">{token.holders.toLocaleString()}</p>
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

        {/* Main Content Grid - New Layout */}
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
      </main>

      <Footer />
    </div>
  );
};

export default TokenDetail;
