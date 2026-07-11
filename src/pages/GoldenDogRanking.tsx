import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Flame, Crown, Medal, Award } from "lucide-react";
import { useMvp } from "@/contexts/MvpContext";
import TokenLogo from "@/components/TokenLogo";

type Period = "day" | "week" | "month" | "quarter" | "year";
type SortMode = "marketCap" | "volume" | "holders";

const periodLabels: Record<Period, string> = {
  day: "日榜",
  week: "周榜",
  month: "月榜",
  quarter: "季度榜",
  year: "年度榜",
};

const sortLabels: Record<SortMode, string> = {
  marketCap: "按市值",
  volume: "按交易量",
  holders: "按持有人数",
};

const periodMultiplier: Record<Period, number> = {
  day: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

const parseMoney = (value: string): number => {
  const match = value.match(/\$?([\d.]+)([KMB])?/i);
  if (!match) return 0;
  const amount = Number.parseFloat(match[1]);
  const unit = match[2]?.toUpperCase();
  return amount * (unit === "B" ? 1e9 : unit === "M" ? 1e6 : unit === "K" ? 1e3 : 1);
};

const formatMoney = (value: number) => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-orange-600" />;
  return null;
};

const getRankStyle = (rank: number) => {
  if (rank === 1) return "bg-gradient-to-r from-yellow-500/20 to-yellow-500/5 border-yellow-500/50";
  if (rank === 2) return "bg-gradient-to-r from-gray-400/20 to-gray-400/5 border-gray-400/50";
  if (rank === 3) return "bg-gradient-to-r from-orange-600/20 to-orange-600/5 border-orange-600/50";
  return "bg-card border-border";
};

const GoldenDogRanking = () => {
  const navigate = useNavigate();
  const { tokens } = useMvp();
  const [sortMode, setSortMode] = useState<SortMode>("marketCap");
  const [period, setPeriod] = useState<Period>("day");

  const baseDataset = tokens
    .filter((token) => token.status === "launched" && token.marketMetricsReady)
    .map((token) => {
      const dailyVolume = parseMoney(token.volume24h);
      const volumeNum = dailyVolume * periodMultiplier[period];
      return {
        symbol: token.symbol,
        name: token.name,
        logo: token.logo,
        volume: formatMoney(volumeNum),
        volumeNum,
        priceChange: token.change24h,
        marketCap: token.marketCap,
        holders: token.holders,
      };
    });

  const sorted = [...baseDataset]
    .sort((a, b) => {
      if (sortMode === "marketCap") return parseMoney(b.marketCap) - parseMoney(a.marketCap);
      if (sortMode === "holders") return b.holders - a.holders;
      return b.volumeNum - a.volumeNum;
    })
    .map((token, index) => ({ ...token, rank: index + 1 }));

  const totalVolume = sorted.reduce((sum, token) => sum + token.volumeNum, 0);
  const totalMarketCap = sorted.reduce((sum, token) => sum + parseMoney(token.marketCap), 0);
  const totalHolders = sorted.reduce((sum, token) => sum + token.holders, 0);
  const champion = sorted[0]?.symbol || "暂无";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 mb-3">
            <Trophy className="h-10 w-10 text-yellow-500" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
              金狗排行榜
            </h1>
            <Trophy className="h-10 w-10 text-yellow-500" />
          </div>
          <p className="text-muted-foreground">
            平台发射最热门代币 · {sortLabels[sortMode]}{sortMode === "volume" ? ` · ${periodLabels[period]}` : ""}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Flame className="h-4 w-4 text-orange-500" /> 总市值
              </div>
              <div className="text-2xl font-bold">{formatMoney(totalMarketCap)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4 text-green-500" /> {sortMode === "volume" ? periodLabels[period] : ""}总交易量
              </div>
              <div className="text-2xl font-bold">{formatMoney(totalVolume)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Crown className="h-4 w-4 text-yellow-500" /> 总持有人数
              </div>
              <div className="text-2xl font-bold">{totalHolders.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Crown className="h-4 w-4 text-yellow-500" /> 冠军代币
              </div>
              <div className="text-2xl font-bold">{champion}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              热门代币排行榜
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="marketCap">按市值</TabsTrigger>
                <TabsTrigger value="volume">按交易量</TabsTrigger>
                <TabsTrigger value="holders">按持有人数</TabsTrigger>
              </TabsList>
            </Tabs>

            {sortMode === "volume" && (
              <Tabs value={period} onValueChange={(value) => setPeriod(value as Period)}>
                <TabsList className="grid w-full grid-cols-5 mb-6">
                  {(Object.keys(periodLabels) as Period[]).map((key) => (
                    <TabsTrigger key={key} value={key}>{periodLabels[key]}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}

            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs text-muted-foreground border-b">
                <div className="col-span-1">排名</div>
                <div className="col-span-3">代币</div>
                <div className="col-span-2 text-right">交易量</div>
                <div className="col-span-2 text-right">涨幅</div>
                <div className="col-span-2 text-right">市值</div>
                <div className="col-span-2 text-right">持有人数</div>
              </div>

              {sorted.length > 0 ? sorted.map((token) => (
                <div
                  key={token.symbol}
                  onClick={() => navigate(`/token/${token.symbol}`)}
                  className={`grid grid-cols-12 gap-4 px-4 py-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${getRankStyle(token.rank)}`}
                >
                  <div className="col-span-1 flex items-center gap-1">
                    {getRankIcon(token.rank) || (
                      <span className="text-lg font-bold text-muted-foreground">#{token.rank}</span>
                    )}
                  </div>
                  <div className="col-span-11 md:col-span-3 flex items-center gap-3">
                    <TokenLogo value={token.logo} symbol={token.symbol} className="h-10 w-10 shrink-0 text-sm" />
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        {token.symbol}
                        {token.rank <= 3 && <Badge variant="secondary" className="text-xs">金狗</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{token.name}</div>
                    </div>
                  </div>
                  <div className="col-span-6 md:col-span-2 md:text-right">
                    <div className="text-xs text-muted-foreground md:hidden">交易量</div>
                    <div className={`font-bold ${sortMode === "volume" ? "text-primary" : ""}`}>{token.volume}</div>
                  </div>
                  <div className="col-span-6 md:col-span-2 md:text-right">
                    <div className="text-xs text-muted-foreground md:hidden">涨幅</div>
                    <div className={`font-bold ${token.priceChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {token.priceChange >= 0 ? "+" : ""}{token.priceChange.toFixed(1)}%
                    </div>
                  </div>
                  <div className="col-span-6 md:col-span-2 md:text-right">
                    <div className="text-xs text-muted-foreground md:hidden">市值</div>
                    <div className={`font-semibold ${sortMode === "marketCap" ? "text-primary" : ""}`}>{token.marketCap}</div>
                  </div>
                  <div className="col-span-6 md:col-span-2 md:text-right">
                    <div className="text-xs text-muted-foreground md:hidden">持有人数</div>
                    <div className={`font-semibold ${sortMode === "holders" ? "text-primary" : ""}`}>{token.holders.toLocaleString()}</div>
                  </div>
                </div>
              )) : (
                <div className="rounded border border-dashed border-border p-8 text-center text-muted-foreground">
                  暂无可排行的真实市场指标，等待 PancakeSwap 池子、成交和 holder 数据同步。
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default GoldenDogRanking;
