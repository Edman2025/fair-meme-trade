import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Star, TrendingUp, User } from "lucide-react";
import { useMvp } from "@/contexts/MvpContext";

interface ChartToolbarProps {
  onCollapseChange?: (collapsed: boolean) => void;
}

const ChartToolbar = ({ onCollapseChange }: ChartToolbarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { tokens, walletAddress } = useMvp();

  const handleToggle = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onCollapseChange?.(collapsed);
  };

  const toToolbarToken = (token: (typeof tokens)[number]) => ({
    symbol: token.symbol,
    logo: token.logo,
    change: `${token.change24h >= 0 ? "+" : ""}${token.change24h.toFixed(1)}%`,
    price: token.currentPrice,
    marketCap: token.marketCap,
  });

  const favoriteTokens = tokens.filter((token) => token.isFollowing).map(toToolbarToken);
  const hotTokens = [...tokens]
    .filter((token) => token.status === "launched")
    .sort((a, b) => Number.parseFloat(b.volume24h.replace(/[^\d.]/g, "")) - Number.parseFloat(a.volume24h.replace(/[^\d.]/g, "")))
    .slice(0, 5)
    .map(toToolbarToken);
  const myTokens = walletAddress
    ? tokens.filter((token) => token.creatorWallet.toLowerCase() === walletAddress.toLowerCase()).map(toToolbarToken)
    : [];

  const renderTokenList = (items: ReturnType<typeof toToolbarToken>[], emptyText: string) => (
    items.length > 0 ? items.map((token) => (
      <div
        key={token.symbol}
        className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback>{token.logo || token.symbol.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-medium text-sm">{token.symbol}</span>
            <span className={`text-xs ${token.change.startsWith("+") ? "text-success" : "text-destructive"}`}>
              {token.change}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{token.price}</span>
            <span>{token.marketCap}</span>
          </div>
        </div>
      </div>
    )) : (
      <div className="rounded border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
        {emptyText}
      </div>
    )
  );

  if (isCollapsed) {
    return (
      <div className="sticky top-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleToggle(false)}
          className="z-10"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-border/50 bg-gradient-card backdrop-blur-sm p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleToggle(true)}
        className="absolute right-2 top-2 h-6 w-6"
      >
        <ChevronLeft className="h-3 w-3" />
      </Button>

      <Tabs defaultValue="following" className="w-full mt-6">
        <TabsList className="w-full grid grid-cols-3 mb-4">
          <TabsTrigger value="following" className="text-xs">
            <Star className="h-3 w-3 mr-1" />
            关注
          </TabsTrigger>
          <TabsTrigger value="hot" className="text-xs">
            <TrendingUp className="h-3 w-3 mr-1" />
            热门
          </TabsTrigger>
          <TabsTrigger value="my" className="text-xs">
            <User className="h-3 w-3 mr-1" />
            我的
          </TabsTrigger>
        </TabsList>

        <TabsContent value="following" className="space-y-2">
          {renderTokenList(favoriteTokens, "暂无关注代币")}
        </TabsContent>

        <TabsContent value="hot" className="space-y-2">
          {renderTokenList(hotTokens, "暂无已上线代币")}
        </TabsContent>

        <TabsContent value="my" className="space-y-2">
          {renderTokenList(myTokens, walletAddress ? "当前钱包暂无创建代币" : "连接钱包后查看我的代币")}
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default ChartToolbar;
