import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Droplet,
  ExternalLink,
  Copy,
  Heart,
  Share2,
  LineChart,
  Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TokenChart from "./TokenChart";
import AdvancedTradingPanel from "./AdvancedTradingPanel";
import OrderBook from "./OrderBook";
import { getExplorerAddressUrl } from "@/lib/chainConfig";
import { apiRequest } from "@/lib/backendApi";

interface TokenDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: {
    logo: string;
    name: string;
    symbol: string;
    totalSupply: string;
    lpCount: number;
    holders: number;
    change24h: number;
    marketCap: string;
    volume24h: string;
    poolAmount: string;
    description: string;
    hasDividend?: boolean;
    hasBurn?: boolean;
    hasMarketing?: boolean;
    contractAddress?: string;
    marketMetricsReady?: boolean;
  };
}

const TokenDetailDialog = ({ open, onOpenChange, token }: TokenDetailDialogProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const isPositive = token.change24h >= 0;
  const hasContractAddress = Boolean(token.contractAddress);
  const [holders, setHolders] = useState<Array<{ rank: number; address: string; balance: string; percent: number }>>([]);
  const [holderStatus, setHolderStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!open || !token.symbol) return;
    let cancelled = false;
    setHolderStatus("loading");
    apiRequest<{ holders: Array<{ rank: number; address: string; balance: string; percent: number }> }>(`/api/tokens/${token.symbol}/holders?limit=10`)
      .then((data) => {
        if (!cancelled) {
          setHolders(data.holders || []);
          setHolderStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHolders([]);
          setHolderStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, token.symbol]);

  const handleCopyAddress = () => {
    if (!token.contractAddress) {
      toast({
        title: "暂无合约地址",
        description: "等待链上创建和 indexer 同步完成。",
        variant: "destructive",
      });
      return;
    }
    navigator.clipboard.writeText(token.contractAddress);
    toast({
      title: t("connect"),
      description: "Contract address copied to clipboard",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-primary flex items-center justify-center text-4xl font-bold">
                {token.logo}
              </div>
              <div>
                <DialogTitle className="text-2xl mb-1">{token.name}</DialogTitle>
                <div className="flex items-center gap-3">
                  <p className="text-muted-foreground">{token.symbol}</p>
                  {token.marketMetricsReady ? (
                    <div className={`flex items-center gap-1 ${isPositive ? "text-success" : "text-destructive"}`}>
                      {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      <span className="font-semibold">{isPositive ? "+" : ""}{token.change24h.toFixed(2)}%</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">指标同步中</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => toast({ title: "Added to favorites" })}>
                <Heart className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => toast({ title: "Share link copied" })}>
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {token.hasDividend && <Badge variant="secondary">{t("dividend")}</Badge>}
          {token.hasBurn && <Badge variant="destructive">{t("burn")}</Badge>}
          {token.hasMarketing && <Badge variant="outline">{t("marketing")}</Badge>}
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-card/50 rounded-lg border border-border/50">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t("marketCap")}</p>
            <p className="text-lg font-bold">{token.marketCap}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t("volume24h")}</p>
            <p className="text-lg font-bold">{token.volume24h}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t("pool")}</p>
            <p className="text-lg font-bold text-secondary">{token.poolAmount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t("supply")}</p>
            <p className="text-lg font-bold">{token.totalSupply}</p>
          </div>
        </div>

        {/* Contract Address */}
        <div className="flex items-center gap-2 p-3 bg-card/30 rounded-lg">
          <p className="text-sm text-muted-foreground flex-1 font-mono">
            {token.contractAddress || "等待链上创建和 indexer 同步"}
          </p>
          <Button variant="ghost" size="icon" onClick={handleCopyAddress}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" asChild disabled={!hasContractAddress}>
            {hasContractAddress ? (
              <a href={getExplorerAddressUrl(token.contractAddress || "")} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <span>
                <ExternalLink className="h-4 w-4" />
              </span>
            )}
          </Button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Chart & Info */}
          <div className="lg:col-span-2 space-y-6">
            <TokenChart symbol={token.symbol} />

            <Tabs defaultValue="transactions" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="transactions" className="flex-1">
                  <LineChart className="h-4 w-4 mr-2" />
                  Transactions
                </TabsTrigger>
                <TabsTrigger value="holders" className="flex-1">
                  <Users className="h-4 w-4 mr-2" />
                  Holders
                </TabsTrigger>
                <TabsTrigger value="info" className="flex-1">
                  <Activity className="h-4 w-4 mr-2" />
                  Info
                </TabsTrigger>
              </TabsList>

              <TabsContent value="transactions" className="mt-4">
                <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  暂无真实交易记录，等待 PancakeSwap 交易和 indexer 同步。
                </div>
              </TabsContent>

              <TabsContent value="holders" className="mt-4">
                {holders.length > 0 ? (
                  <div className="space-y-2">
                    {holders.map((holder) => (
                      <div key={holder.address} className="flex items-center justify-between rounded-lg border border-border/50 bg-card/30 p-3">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">#{holder.rank}</Badge>
                          <span className="font-mono text-sm">{holder.address.slice(0, 6)}...{holder.address.slice(-4)}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {Number(holder.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })} {token.symbol}
                          </p>
                          <p className="text-xs text-muted-foreground">{holder.percent.toFixed(4)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {holderStatus === "loading" ? "正在读取链上持仓排行..." : holderStatus === "error" ? "持仓排行读取失败，请稍后重试。" : "暂无链上持仓排行数据。"}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground">{token.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-1">LP Providers</h4>
                    <div className="flex items-center gap-2">
                      <Droplet className="h-4 w-4 text-muted-foreground" />
                      <span>{token.lpCount}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1">{t("holders")}</h4>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{token.holders}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Trading & Order Book */}
          <div className="space-y-6">
            <AdvancedTradingPanel tokenSymbol={token.symbol} tokenPrice={0} />
            <OrderBook symbol={token.symbol} />
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default TokenDetailDialog;
