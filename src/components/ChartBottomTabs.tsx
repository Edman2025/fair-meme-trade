import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Droplet, Brain, FileText, Clock, TrendingUp, Edit, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTokenPrice, formatAmount } from "@/lib/utils";
import { useMvp } from "@/contexts/MvpContext";
import { apiRequest } from "@/lib/backendApi";

interface ChartBottomTabsProps {
  tokenSymbol: string;
}

const ChartBottomTabs = ({ tokenSymbol }: ChartBottomTabsProps) => {
  const { toast } = useToast();
  const { trades: mvpTrades, walletAddress, lpPositions, chainTransactions } = useMvp();
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState("");
  const [walletNote, setWalletNote] = useState("");
  const [walletNotes, setWalletNotes] = useState<Record<string, string>>({});
  const [smartMoneyList, setSmartMoneyList] = useState<Set<string>>(new Set());
  const [topHolders, setTopHolders] = useState<Array<{ rank: number; address: string; amount: string; percent: number; pnl: string }>>([]);
  const [holderStatus, setHolderStatus] = useState<"loading" | "ready" | "error">("loading");

  const trades = [
    ...mvpTrades
      .filter((trade) => trade.tokenSymbol === tokenSymbol)
      .map((trade) => ({
        time: trade.timestamp.split(" ").pop() || trade.timestamp,
        type: trade.side,
        price: 0,
        amount: Number(trade.amount) || 0,
        value: Number(trade.amount) || 0,
        wallet: walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "unknown",
      })),
  ];

  useEffect(() => {
    let cancelled = false;
    setHolderStatus("loading");
    apiRequest<{
      holders: Array<{ rank: number; address: string; balance: string; percent: number }>;
    }>(`/api/tokens/${tokenSymbol}/holders?limit=10`)
      .then((data) => {
        if (cancelled) return;
        setTopHolders((data.holders || []).map((holder) => ({
          rank: holder.rank,
          address: `${holder.address.slice(0, 6)}...${holder.address.slice(-4)}`,
          amount: `${formatAmount(Number(holder.balance || 0))} ${tokenSymbol}`,
          percent: Number(holder.percent || 0),
          pnl: "链上余额",
        })));
        setHolderStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setTopHolders([]);
          setHolderStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tokenSymbol]);

  const liquidityPool = lpPositions
    .filter((position) => position.tokenSymbol === tokenSymbol)
    .map((position) => ({
      type: Number(position.withdrawnAmount || 0) > 0 ? "remove" : "add",
      address: walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "unknown",
      amount: Number(position.userLpAmount || 0),
      unit: "LP",
      value: Number(position.userLpValue || 0),
      time: position.lockEndDate,
    }));

  const smartMoney = trades
    .filter((trade) => smartMoneyList.has(trade.wallet))
    .map((trade) => ({
      address: trade.wallet,
      bought: trade.amount,
      unit: tokenSymbol,
      avgPrice: trade.price,
      status: "已标记",
    }));

  const limitOrders = chainTransactions
    .filter((tx) => tx.tokenSymbol === tokenSymbol && (tx.action === "limitOrder" || tx.action === "riskOrder"))
    .map((tx) => ({
      type: tx.action === "limitOrder" ? "limit" : "risk",
      price: 0,
      amount: tx.payload || tx.txHash,
      status: tx.status,
    }));

  const handleOpenNoteDialog = (wallet: string) => {
    setSelectedWallet(wallet);
    setWalletNote(walletNotes[wallet] || "");
    setNoteDialogOpen(true);
  };

  const handleSaveNote = () => {
    setWalletNotes({ ...walletNotes, [selectedWallet]: walletNote });
    toast({
      title: "备注已保存",
      description: `已为钱包 ${selectedWallet} 添加备注`,
    });
    setNoteDialogOpen(false);
  };

  const toggleSmartMoney = (wallet: string) => {
    const newList = new Set(smartMoneyList);
    if (newList.has(wallet)) {
      newList.delete(wallet);
      toast({
        title: "已移除",
        description: `已从聪明钱列表移除`,
      });
    } else {
      newList.add(wallet);
      toast({
        title: "已添加",
        description: `已添加到聪明钱列表`,
      });
    }
    setSmartMoneyList(newList);
  };

  return (
    <>
    <Card className="border-border/50 bg-gradient-card backdrop-blur-sm">
      <Tabs defaultValue="trades" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="trades" className="flex-1">
            <TrendingUp className="h-4 w-4 mr-2" />
            交易
          </TabsTrigger>
          <TabsTrigger value="holders" className="flex-1">
            <Users className="h-4 w-4 mr-2" />
            持币排行
          </TabsTrigger>
          <TabsTrigger value="liquidity" className="flex-1">
            <Droplet className="h-4 w-4 mr-2" />
            流动性池
          </TabsTrigger>
          <TabsTrigger value="smart" className="flex-1">
            <Brain className="h-4 w-4 mr-2" />
            聪明钱
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex-1">
            <FileText className="h-4 w-4 mr-2" />
            委托订单
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1">
            <Clock className="h-4 w-4 mr-2" />
            历史订单
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trades" className="p-3">
          <div className="space-y-1.5">
            <div className="grid grid-cols-[80px_60px_90px_110px_100px_1fr_80px] gap-1.5 px-2 py-1.5 text-xs text-muted-foreground font-semibold border-b border-border/50">
              <div>时间</div>
              <div>类型</div>
              <div>价格</div>
              <div className="text-right">数量</div>
              <div className="text-right">金额</div>
              <div>交易者</div>
              <div className="text-center">操作</div>
            </div>
            {trades.length > 0 ? trades.map((trade, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[80px_60px_90px_110px_100px_1fr_80px] gap-1.5 items-center px-2 py-2 bg-card/30 rounded-lg border border-border/50 hover:bg-card/50 transition-colors"
              >
                <div className="text-xs text-muted-foreground">{trade.time}</div>
                <Badge variant={trade.type === "buy" ? "default" : "destructive"} className="text-xs">
                  {trade.type === "buy" ? "买入" : "卖出"}
                </Badge>
                <div className="text-sm font-medium">${formatTokenPrice(trade.price)}</div>
                <div className="text-sm text-right">{formatAmount(trade.amount)}</div>
                <div className="text-sm font-medium text-right">${formatAmount(trade.value)}</div>
                <div className="flex items-center gap-2">
                  {walletNotes[trade.wallet] ? (
                    <Badge variant="outline" className="text-xs">
                      {walletNotes[trade.wallet]}
                    </Badge>
                  ) : (
                    <span className="text-sm font-mono">{trade.wallet.slice(-6)}</span>
                  )}
                </div>
                <div className="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleOpenNoteDialog(trade.wallet)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => toggleSmartMoney(trade.wallet)}
                  >
                    <Star
                      className={`h-3 w-3 ${
                        smartMoneyList.has(trade.wallet)
                          ? "fill-yellow-500 text-yellow-500"
                          : ""
                      }`}
                    />
                  </Button>
                </div>
              </div>
            )) : (
              <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                暂无真实交易记录，等待链上交易或后端订单同步。
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="holders" className="p-4">
          <div className="space-y-2">
            {topHolders.length > 0 ? topHolders.map((holder) => (
              <div
                key={holder.rank}
                className="flex items-center justify-between p-3 bg-card/30 rounded-lg border border-border/50"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-xs font-bold">
                    #{holder.rank}
                  </div>
                  <p className="text-sm font-mono">{holder.address}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-medium">{holder.amount}</p>
                    <p className="text-xs text-muted-foreground">{holder.percent}%</p>
                  </div>
                  <p className={`text-sm font-semibold ${holder.pnl.startsWith("+") ? "text-success" : holder.pnl.startsWith("-") ? "text-destructive" : "text-muted-foreground"}`}>
                    {holder.pnl}
                  </p>
                </div>
              </div>
            )) : (
              <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {holderStatus === "loading" ? "正在读取链上持币排行..." : holderStatus === "error" ? "持币排行读取失败，请稍后重试。" : "暂无链上持币排行数据。"}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="liquidity" className="p-4">
          <div className="space-y-2">
            {liquidityPool.length > 0 ? liquidityPool.map((lp, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-card/30 rounded-lg border border-border/50"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={lp.type === "add" ? "default" : "destructive"}>
                    {lp.type === "add" ? "添加" : "移除"}
                  </Badge>
                  <p className="text-sm font-mono">{lp.address}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatAmount(lp.amount)} {lp.unit}</p>
                    <p className="text-xs text-muted-foreground">${formatAmount(lp.value)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground w-24">{lp.time}</p>
                </div>
              </div>
            )) : (
              <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                暂无真实 LP 记录。
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="smart" className="p-4">
          <div className="space-y-2">
            {smartMoney.length > 0 ? smartMoney.map((smart, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-card/30 rounded-lg border border-border/50"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{smart.status}</Badge>
                  <p className="text-sm font-mono">{smart.address}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatAmount(smart.bought)} {smart.unit}</p>
                    <p className="text-xs text-muted-foreground">均价: ${formatTokenPrice(smart.avgPrice)}</p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                暂无已标记聪明钱钱包。
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="p-4">
          <div className="space-y-2">
            {limitOrders.length > 0 ? limitOrders.map((order, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-card/30 rounded-lg border border-border/50"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={order.type === "limit" ? "default" : "destructive"}>
                    {order.type === "limit" ? "限价单" : "风控单"}
                  </Badge>
                  <p className="text-sm">来源: {String(order.amount).slice(0, 48)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline">{order.status}</Badge>
                </div>
              </div>
            )) : (
              <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                暂无真实委托订单。
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="p-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center py-8">暂无历史订单</p>
          </div>
        </TabsContent>
      </Tabs>
    </Card>

    <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加钱包备注</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>钱包地址</Label>
            <Input value={selectedWallet} disabled />
          </div>
          <div className="space-y-2">
            <Label>备注名称</Label>
            <Input
              value={walletNote}
              onChange={(e) => setWalletNote(e.target.value)}
              placeholder="输入备注名称"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSaveNote}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default ChartBottomTabs;
