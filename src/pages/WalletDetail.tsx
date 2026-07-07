import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ArrowLeft, Copy, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMvp } from "@/contexts/MvpContext";
import { getExplorerAddressUrl } from "@/lib/chainConfig";

const WalletDetail = () => {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { walletAddress, walletBalances, tokens } = useMvp();
  const resolvedAddress = address || walletAddress;
  const normalizedAddress = resolvedAddress.toLowerCase();

  const handleCopy = () => {
    if (resolvedAddress) {
      navigator.clipboard.writeText(resolvedAddress);
      toast({ title: "Success", description: "Wallet address copied!" });
    }
  };

  const holdings = walletBalances
    .filter((balance) => balance.status === "holding" && Number(balance.valueUSDT) > 0)
    .map((balance) => {
      const token = tokens.find((item) => item.symbol === balance.token);
      const pnl = balance.change24h >= 0 ? `+${balance.change24h.toFixed(2)}%` : `${balance.change24h.toFixed(2)}%`;
      return {
        logo: token?.logo || balance.token.slice(0, 2),
        symbol: balance.token,
        amount: balance.balance,
        value: `$${Number(balance.valueUSDT).toLocaleString()}`,
        pnl,
        pnlValue: "按后端成交同步",
      };
    });

  const createdTokens = tokens.filter((token) => token.creatorWallet.toLowerCase() === normalizedAddress);
  const totalValue = holdings.reduce((sum, holding) => sum + Number(holding.value.replace(/[$,]/g, "")), 0);
  const weightedChange = totalValue > 0
    ? holdings.reduce((sum, holding) => {
        const numericValue = Number(holding.value.replace(/[$,]/g, ""));
        const percent = Number(holding.pnl.replace("%", ""));
        return sum + numericValue * percent;
      }, 0) / totalValue
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>

        {/* Wallet Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">钱包详情</h1>
          
          <div className="flex items-center gap-2 p-4 bg-card/50 rounded-lg border border-border/50 mb-6">
            <p className="flex-1 text-sm font-mono break-all">{resolvedAddress}</p>
            <Button variant="ghost" size="icon" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <a href={getExplorerAddressUrl(resolvedAddress)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>

          {/* Overall Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="p-6 bg-gradient-card border-border/50">
              <p className="text-sm text-muted-foreground mb-2">总资产价值</p>
              <p className="text-3xl font-bold">${totalValue.toLocaleString()}</p>
            </Card>
            <Card className="p-6 bg-gradient-card border-border/50">
              <p className="text-sm text-muted-foreground mb-2">总盈亏</p>
              <p className={`text-3xl font-bold ${weightedChange >= 0 ? "text-success" : "text-destructive"}`}>
                {totalValue > 0 ? `${weightedChange >= 0 ? "+" : ""}${weightedChange.toFixed(2)}%` : "-"}
              </p>
              <p className="text-sm text-muted-foreground">按当前持仓 24h 变化估算</p>
            </Card>
            <Card className="p-6 bg-gradient-card border-border/50">
              <p className="text-sm text-muted-foreground mb-2">持有代币数</p>
              <p className="text-3xl font-bold">{holdings.length}</p>
            </Card>
          </div>
        </div>

        {/* Holdings Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">持有代币</h2>
          <div className="space-y-3">
            {holdings.map((holding) => (
              <Card
                key={holding.symbol}
                className="p-6 bg-gradient-card border-border/50 hover:bg-card/50 transition-all cursor-pointer"
                onClick={() => navigate(`/token/${holding.symbol}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center text-2xl">
                      {holding.logo}
                    </div>
                    <div>
                      <p className="text-xl font-bold">{holding.symbol}</p>
                      <p className="text-sm text-muted-foreground">{holding.amount} tokens</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">{holding.value}</p>
                    <div className={`flex items-center justify-end gap-1 ${
                      holding.pnl.startsWith('+') ? 'text-success' : 'text-destructive'
                    }`}>
                      {holding.pnl.startsWith('+') ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      <span className="text-sm font-semibold">{holding.pnl}</span>
                      <span className="text-sm text-muted-foreground">({holding.pnlValue})</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Created Tokens Section */}
        <div>
          <h2 className="text-2xl font-bold mb-4">已创建代币</h2>
          <div className="space-y-4">
            {createdTokens.length > 0 ? createdTokens.map((token) => (
              <Card
                key={token.symbol}
                className="p-6 bg-gradient-card border-border/50 hover:bg-card/50 transition-all cursor-pointer"
                onClick={() => navigate(`/token/${token.symbol}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-gradient-primary flex items-center justify-center text-4xl">
                      {token.logo}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-1">{token.name}</h3>
                      <div className="flex items-center gap-3">
                        <p className="text-muted-foreground">{token.symbol}</p>
                        <div className={`flex items-center gap-1 ${
                          token.change24h >= 0 ? 'text-success' : 'text-destructive'
                        }`}>
                          {token.change24h >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                          <span className="font-semibold">{token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">{token.status === "building" ? "LP建设中" : token.status === "pending" ? "待开盘" : "已开盘"}</Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">市值</p>
                    <p className="text-lg font-bold">{token.marketCap}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">24h交易额</p>
                    <p className="text-lg font-bold">{token.volume24h}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">池子金额</p>
                    <p className="text-lg font-bold text-secondary">{token.poolAmount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">持有人数</p>
                    <p className="text-lg font-bold">{token.holders}</p>
                  </div>
                </div>
              </Card>
            )) : (
              <Card className="p-8 text-center text-muted-foreground">
                当前钱包暂无创建代币记录
              </Card>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default WalletDetail;
