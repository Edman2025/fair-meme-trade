import { useState, useRef, useEffect } from "react";
import { formatUnits } from "ethers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMvp } from "@/contexts/MvpContext";
import { useToast } from "@/hooks/use-toast";
import { Shield, Zap, Settings, TrendingUp, TrendingDown } from "lucide-react";
import { canUseRealChain } from "@/lib/chainConfig";
import { quoteBnbToToken, quoteTokenToBnb, swapExactBnbForTokens, swapExactTokensForBnb, getTokenBalance, type PancakeQuote } from "@/lib/pancakeSwap";
import { getNativeBalance } from "@/lib/walletAdapter";
import { apiRequest } from "@/lib/backendApi";
import { enableDemoFallback } from "@/lib/runtimeFlags";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdvancedTradingPanelProps {
  tokenSymbol: string;
  tokenPrice: number;
}

const AdvancedTradingPanel = ({ tokenSymbol, tokenPrice }: AdvancedTradingPanelProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isConnected, walletAddress, recordTrade, submitChainTransaction, getTokenBySymbol } = useMvp();
  const token = getTokenBySymbol(tokenSymbol);
  const tokenAddress = token?.contractAddress || "";
  
  // Trading settings
  const [mevProtection, setMevProtection] = useState(true);
  const [priorityFee, setPriorityFee] = useState(0.001);
  const [buySlippage, setBuySlippage] = useState(1);
  const [sellSlippage, setSellSlippage] = useState(1);
  const [slippageMode, setSlippageMode] = useState<"auto" | "manual">("auto");
  const [showSlippageInput, setShowSlippageInput] = useState(false);
  
  // Buy/Sell inputs
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [payCurrency, setPayCurrency] = useState("BNB");
  const [bnbBalance, setBnbBalance] = useState("");
  const [tokenBalance, setTokenBalance] = useState("");
  const [buyQuote, setBuyQuote] = useState<PancakeQuote | null>(null);
  const [sellQuote, setSellQuote] = useState<PancakeQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);

  const recordDexChainTransaction = async (
    txHash: string,
    side: "buy" | "sell",
    amount: string,
    minOut: string,
  ) => {
    if (!walletAddress || !tokenAddress) return;
    await apiRequest("/api/chain-transactions", {
      method: "POST",
      body: JSON.stringify({
        txHash,
        action: "dexSwap",
        tokenAddress,
        walletAddress,
        status: "submitted",
        payload: {
          side,
          amount,
          minOut,
          router: "PancakeSwapV2",
        },
      }),
    });
  };
  const [isSwapping, setIsSwapping] = useState(false);
  
  // Limit order states
  const [limitBuyPrice, setLimitBuyPrice] = useState("");
  const [limitBuyAmount, setLimitBuyAmount] = useState("");
  const [limitBuyPriceImpact, setLimitBuyPriceImpact] = useState(5);
  const [doubleProfit, setDoubleProfit] = useState(false);
  
  const [limitSellPrice, setLimitSellPrice] = useState("");
  const [limitSellPercent, setLimitSellPercent] = useState("");
  
  // Stop loss/Take profit
  const [stopLossPercent, setStopLossPercent] = useState("");
  const [stopLossSellPercent, setStopLossSellPercent] = useState("");

  // Ref for click outside detection
  const slippageInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSlippageInput && slippageInputRef.current && !slippageInputRef.current.contains(event.target as Node)) {
        setShowSlippageInput(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSlippageInput]);

  useEffect(() => {
    let cancelled = false;
    const loadBalances = async () => {
      if (!isConnected || !walletAddress) {
        setBnbBalance("");
        setTokenBalance("");
        return;
      }
      try {
        const balanceHex = await getNativeBalance(walletAddress);
        if (!cancelled) setBnbBalance(Number(formatUnits(BigInt(balanceHex), 18)).toFixed(6));
      } catch {
        if (!cancelled) setBnbBalance("");
      }
      if (!tokenAddress) {
        setTokenBalance("");
        return;
      }
      try {
        const balance = await getTokenBalance(tokenAddress, walletAddress);
        if (!cancelled) setTokenBalance(Number(formatUnits(balance, 18)).toFixed(6));
      } catch {
        if (!cancelled) setTokenBalance("");
      }
    };
    loadBalances();
    return () => {
      cancelled = true;
    };
  }, [isConnected, walletAddress, tokenAddress]);

  useEffect(() => {
    let cancelled = false;
    const loadQuote = async () => {
      if (!canUseRealChain() || payCurrency !== "BNB" || !tokenAddress || !buyAmount || Number(buyAmount) <= 0) {
        setBuyQuote(null);
        return;
      }
      setIsQuoting(true);
      try {
        const quote = await quoteBnbToToken(tokenAddress, buyAmount, buySlippage);
        if (!cancelled) setBuyQuote(quote);
      } catch {
        if (!cancelled) setBuyQuote(null);
      } finally {
        if (!cancelled) setIsQuoting(false);
      }
    };
    loadQuote();
    return () => {
      cancelled = true;
    };
  }, [buyAmount, buySlippage, payCurrency, tokenAddress]);

  useEffect(() => {
    let cancelled = false;
    const loadQuote = async () => {
      if (!canUseRealChain() || !tokenAddress || !sellAmount || Number(sellAmount) <= 0) {
        setSellQuote(null);
        return;
      }
      setIsQuoting(true);
      try {
        const quote = await quoteTokenToBnb(tokenAddress, sellAmount, sellSlippage);
        if (!cancelled) setSellQuote(quote);
      } catch {
        if (!cancelled) setSellQuote(null);
      } finally {
        if (!cancelled) setIsQuoting(false);
      }
    };
    loadQuote();
    return () => {
      cancelled = true;
    };
  }, [sellAmount, sellSlippage, tokenAddress]);

  const handleBuy = async () => {
    if (!isConnected) {
      toast({ title: "请先连接钱包", description: "请使用真实钱包连接后提交交易。", variant: "destructive" });
      return;
    }
    if (!buyAmount) {
      toast({ title: t("error"), description: "Please enter buy amount", variant: "destructive" });
      return;
    }
    setIsSwapping(true);
    try {
      if (canUseRealChain() && payCurrency === "BNB" && tokenAddress) {
        const result = await swapExactBnbForTokens(tokenAddress, buyAmount, buySlippage);
        try {
          await recordDexChainTransaction(result.txHash, "buy", buyAmount, result.quote.minOut);
        } catch (recordError) {
          toast({
            title: "交易已提交，后端记录待同步",
            description: recordError instanceof Error ? recordError.message : "请稍后在链交易列表确认。",
            variant: "destructive",
          });
        }
        recordTrade({ tokenSymbol, side: "buy", amount: buyAmount, currency: payCurrency }, {
          id: `dex-${Date.now()}`,
          action: "trade",
          tokenSymbol,
          txHash: result.txHash,
          status: "submitted",
          createdAt: new Date().toLocaleString(),
          mode: "wallet",
          payload: JSON.stringify({ side: "buy", amount: buyAmount, currency: payCurrency, minOut: result.quote.minOut }),
        });
        toast({ title: t("success"), description: `PancakeSwap 买入已提交: ${result.txHash.slice(0, 10)}...` });
        setBuyAmount("");
        return;
      }
      if (!enableDemoFallback) {
        throw new Error("缺少真实 PancakeSwap 交易配置，线上环境不会生成演示买入。");
      }
      const tx = await submitChainTransaction("trade", tokenSymbol, JSON.stringify({
        side: "buy",
        amount: buyAmount,
        currency: payCurrency,
        slippage: buySlippage,
        mevProtection,
        priorityFee,
      }));
      recordTrade({ tokenSymbol, side: "buy", amount: buyAmount, currency: payCurrency }, tx);
      toast({
        title: t("success"),
        description: tx.mode === "wallet" ? `买入交易已提交: ${tx.txHash.slice(0, 10)}...` : `开发演示买入交易: ${tx.txHash.slice(0, 10)}...`,
      });
    } catch (error) {
      toast({ title: "交易失败", description: error instanceof Error ? error.message : "PancakeSwap 交易提交失败", variant: "destructive" });
    } finally {
      setIsSwapping(false);
    }
  };

  const handleSell = async () => {
    if (!isConnected) {
      toast({ title: "请先连接钱包", description: "请使用真实钱包连接后提交交易。", variant: "destructive" });
      return;
    }
    if (!sellAmount) {
      toast({ title: t("error"), description: "Please enter sell amount", variant: "destructive" });
      return;
    }
    setIsSwapping(true);
    try {
      if (canUseRealChain() && tokenAddress) {
        const result = await swapExactTokensForBnb(tokenAddress, sellAmount, sellSlippage);
        try {
          await recordDexChainTransaction(result.txHash, "sell", sellAmount, result.quote.minOut);
        } catch (recordError) {
          toast({
            title: "交易已提交，后端记录待同步",
            description: recordError instanceof Error ? recordError.message : "请稍后在链交易列表确认。",
            variant: "destructive",
          });
        }
        recordTrade({ tokenSymbol, side: "sell", amount: sellAmount, currency: tokenSymbol }, {
          id: `dex-${Date.now()}`,
          action: "trade",
          tokenSymbol,
          txHash: result.txHash,
          status: "submitted",
          createdAt: new Date().toLocaleString(),
          mode: "wallet",
          payload: JSON.stringify({ side: "sell", amount: sellAmount, minOut: result.quote.minOut }),
        });
        toast({ title: t("success"), description: `PancakeSwap 卖出已提交: ${result.txHash.slice(0, 10)}...` });
        setSellAmount("");
        return;
      }
      if (!enableDemoFallback) {
        throw new Error("缺少真实 PancakeSwap 交易配置，线上环境不会生成演示卖出。");
      }
      const tx = await submitChainTransaction("trade", tokenSymbol, JSON.stringify({
        side: "sell",
        amount: sellAmount,
        currency: tokenSymbol,
        slippage: sellSlippage,
        mevProtection,
        priorityFee,
      }));
      recordTrade({ tokenSymbol, side: "sell", amount: sellAmount, currency: tokenSymbol }, tx);
      toast({
        title: t("success"),
        description: tx.mode === "wallet" ? `卖出交易已提交: ${tx.txHash.slice(0, 10)}...` : `开发演示卖出交易: ${tx.txHash.slice(0, 10)}...`,
      });
    } catch (error) {
      toast({ title: "交易失败", description: error instanceof Error ? error.message : "PancakeSwap 交易提交失败", variant: "destructive" });
    } finally {
      setIsSwapping(false);
    }
  };

  const handleAddLiquidity = () => {
    navigate(`/lp-launch/${tokenSymbol}`);
  };

  const handleViewLiquidity = () => {
    navigate("/my-lp");
  };

  const handleLimitBuy = async () => {
    if (!walletAddress || !tokenAddress) {
      toast({ title: "无法创建订单", description: "请先连接钱包并等待 token 合约地址同步。", variant: "destructive" });
      return;
    }
    if (!enableDemoFallback) {
      const order = await apiRequest<{ id: number }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          tokenAddress,
          orderType: "limit",
          side: "buy",
          amount: limitBuyAmount,
          triggerPrice: limitBuyPrice,
          payload: { priceImpact: limitBuyPriceImpact, doubleProfit },
        }),
      });
      toast({ title: t("success"), description: `限价买单已写入后端订单 #${order.id}` });
      return;
    }
    const tx = await submitChainTransaction("limitOrder", tokenSymbol, JSON.stringify({
      side: "buy",
      triggerPrice: limitBuyPrice,
      amount: limitBuyAmount,
      priceImpact: limitBuyPriceImpact,
      doubleProfit,
    }));
    toast({ 
      title: t("success"), 
      description: `限价买单已进入队列: ${tx.txHash.slice(0, 10)}...` 
    });
  };

  const handleLimitSell = async () => {
    if (!walletAddress || !tokenAddress) {
      toast({ title: "无法创建订单", description: "请先连接钱包并等待 token 合约地址同步。", variant: "destructive" });
      return;
    }
    if (!enableDemoFallback) {
      const order = await apiRequest<{ id: number }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          tokenAddress,
          orderType: "limit",
          side: "sell",
          amount: limitSellPercent || "0",
          triggerPrice: limitSellPrice,
          payload: { sellPercent: limitSellPercent },
        }),
      });
      toast({ title: t("success"), description: `限价卖单已写入后端订单 #${order.id}` });
      return;
    }
    const tx = await submitChainTransaction("limitOrder", tokenSymbol, JSON.stringify({
      side: "sell",
      triggerPrice: limitSellPrice,
      sellPercent: limitSellPercent,
    }));
    toast({ 
      title: t("success"), 
      description: `限价卖单已进入队列: ${tx.txHash.slice(0, 10)}...` 
    });
  };

  const handleRiskOrder = async () => {
    if (!walletAddress || !tokenAddress) {
      toast({ title: "无法创建订单", description: "请先连接钱包并等待 token 合约地址同步。", variant: "destructive" });
      return;
    }
    if (!enableDemoFallback) {
      const order = await apiRequest<{ id: number }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          tokenAddress,
          orderType: "risk",
          side: "sell",
          amount: stopLossSellPercent || "0",
          trailingPercent: stopLossPercent,
          payload: { pullbackPercent: stopLossPercent, sellPercent: stopLossSellPercent },
        }),
      });
      toast({ title: "风控单已设置", description: `风控单已写入后端订单 #${order.id}` });
      return;
    }
    const tx = await submitChainTransaction("riskOrder", tokenSymbol, JSON.stringify({
      pullbackPercent: stopLossPercent,
      sellPercent: stopLossSellPercent,
    }));
    toast({
      title: "风控单已设置",
      description: `移动止盈止损已进入队列: ${tx.txHash.slice(0, 10)}...`,
    });
  };

  const setPercentage = (percent: number) => {
    if (payCurrency !== "BNB" || !bnbBalance) return;
    setBuyAmount((Number(bnbBalance) * percent / 100).toFixed(6));
  };

  const setSellPercentage = (percent: number) => {
    if (!tokenBalance) return;
    setSellAmount((Number(tokenBalance) * percent / 100).toFixed(6));
  };

  return (
    <Card className="border-border/50 bg-gradient-card backdrop-blur-sm">
      <div className="p-6 space-y-6">
        {/* Trading Settings */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            {canUseRealChain()
              ? "已配置合约地址，检测到注入钱包时会尝试提交真实链上交易。"
              : "未配置合约地址，线上环境不会提交演示交易。"}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <Label>MEV保护</Label>
            </div>
            <Switch checked={mevProtection} onCheckedChange={setMevProtection} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-secondary" />
                优先费
              </Label>
              <span className="text-sm text-muted-foreground">{priorityFee} BNB</span>
            </div>
            <Slider
              value={[priorityFee * 1000]}
              onValueChange={(v) => setPriorityFee(v[0] / 1000)}
              max={10}
              step={0.1}
              className="w-full"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>滑点</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant={slippageMode === "auto" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSlippageMode("auto");
                    setShowSlippageInput(false);
                    setBuySlippage(1);
                    setSellSlippage(1);
                  }}
                  className="h-7 px-3 text-xs"
                >
                  自动
                </Button>
                <Button
                  variant={slippageMode === "manual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSlippageMode("manual");
                    setShowSlippageInput(true);
                  }}
                  className="h-7 px-3 text-xs"
                >
                  手动{slippageMode === "manual" && ` ${buySlippage}%`}
                </Button>
              </div>
            </div>
            {showSlippageInput && (
              <div ref={slippageInputRef} className="flex items-center gap-2">
                <Input
                  type="number"
                  value={buySlippage}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setBuySlippage(value);
                    setSellSlippage(value);
                  }}
                  className="flex-1"
                  placeholder="输入滑点百分比"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            )}
          </div>
        </div>

        {/* Trading Tabs */}
        <Tabs defaultValue="spot" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="spot" className="flex-1">现货交易</TabsTrigger>
            <TabsTrigger value="limit" className="flex-1">限价委托</TabsTrigger>
          </TabsList>

          {/* Spot Trading */}
          <TabsContent value="spot" className="space-y-4 mt-4">
            {/* Buy Section */}
            <div className="space-y-3">
              <Label>买入金额</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1"
                />
                <Select value={payCurrency} onValueChange={setPayCurrency}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BNB">BNB</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                余额: {payCurrency === "BNB" ? (bnbBalance || "连接钱包后读取") : "暂未接入 USDT 余额"} {payCurrency}
              </p>
              <div className="flex gap-2">
                {[25, 50, 75, 100].map((percent) => (
                  <Button
                    key={percent}
                    variant="outline"
                    size="sm"
                    onClick={() => setPercentage(percent)}
                    disabled={payCurrency !== "BNB" || !bnbBalance}
                    className="flex-1"
                  >
                    {percent}%
                  </Button>
                ))}
              </div>
              {payCurrency === "BNB" && (
                <div className="rounded-lg border border-border/60 bg-background/30 p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pancake 预计获得</span>
                    <span>{isQuoting ? "报价中..." : buyQuote ? `${Number(buyQuote.amountOut).toLocaleString()} ${tokenSymbol}` : "暂无报价"}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">最小获得</span>
                    <span>{buyQuote ? `${Number(buyQuote.minOut).toLocaleString()} ${tokenSymbol}` : "-"}</span>
                  </div>
                </div>
              )}
              <Button onClick={handleBuy} disabled={isSwapping} className="w-full bg-success hover:bg-success/90">
                <TrendingUp className="h-4 w-4 mr-2" />
                {isSwapping ? "提交中..." : "买入"}
              </Button>
            </div>

            {/* Sell Section */}
            <div className="space-y-3">
              <Label>卖出数量</Label>
              <Input
                type="number"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">持仓: {tokenBalance || "连接钱包后读取"} {tokenSymbol}</p>
              <div className="flex gap-2">
                {[25, 50, 75, 100].map((percent) => (
                  <Button
                    key={percent}
                    variant="outline"
                    size="sm"
                    onClick={() => setSellPercentage(percent)}
                    disabled={!tokenBalance}
                    className="flex-1"
                  >
                    {percent}%
                  </Button>
                ))}
              </div>
              <div className="rounded-lg border border-border/60 bg-background/30 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pancake 预计获得</span>
                  <span>{isQuoting ? "报价中..." : sellQuote ? `${Number(sellQuote.amountOut).toLocaleString()} BNB` : "暂无报价"}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">最小获得</span>
                  <span>{sellQuote ? `${Number(sellQuote.minOut).toLocaleString()} BNB` : "-"}</span>
                </div>
              </div>
              <Button onClick={handleSell} disabled={isSwapping} className="w-full bg-destructive hover:bg-destructive/90">
                <TrendingDown className="h-4 w-4 mr-2" />
                {isSwapping ? "提交中..." : "卖出"}
              </Button>
            </div>

            {/* Liquidity Section */}
            <div className="space-y-2 pt-4 border-t border-border/50">
              <Button variant="outline" className="w-full" onClick={handleAddLiquidity}>
                添加流动性
              </Button>
              <Button variant="outline" className="w-full" onClick={handleViewLiquidity}>
                撤回流动性
              </Button>
            </div>
          </TabsContent>

          {/* Limit Orders */}
          <TabsContent value="limit" className="space-y-4 mt-4">
            {/* Limit Buy */}
            <div className="space-y-3 p-4 bg-card/30 rounded-lg">
              <h4 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" />
                限价买入
              </h4>
              <div className="space-y-2">
                <Label>触发价格 (USD)</Label>
                <Input
                  type="number"
                  value={limitBuyPrice}
                  onChange={(e) => setLimitBuyPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>买入金额 ({payCurrency})</Label>
                <Input
                  type="number"
                  value={limitBuyAmount}
                  onChange={(e) => setLimitBuyAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>价格影响上限 (%)</Label>
                <Input
                  type="number"
                  value={limitBuyPriceImpact}
                  onChange={(e) => setLimitBuyPriceImpact(Number(e.target.value))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>翻倍出本</Label>
                <Switch checked={doubleProfit} onCheckedChange={setDoubleProfit} />
              </div>
              <Button onClick={handleLimitBuy} className="w-full">
                创建限价买单
              </Button>
            </div>

            {/* Limit Sell */}
            <div className="space-y-3 p-4 bg-card/30 rounded-lg">
              <h4 className="font-semibold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                限价卖出
              </h4>
              <div className="space-y-2">
                <Label>触发价格 (USD)</Label>
                <Input
                  type="number"
                  value={limitSellPrice}
                  onChange={(e) => setLimitSellPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>卖出百分比 (%)</Label>
                <Input
                  type="number"
                  value={limitSellPercent}
                  onChange={(e) => setLimitSellPercent(e.target.value)}
                  placeholder="0-100"
                />
              </div>
              <Button onClick={handleLimitSell} className="w-full">
                创建限价卖单
              </Button>
            </div>

            {/* Stop Loss / Take Profit */}
            <div className="space-y-3 p-4 bg-card/30 rounded-lg">
              <h4 className="font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4 text-accent" />
                移动止盈止损
              </h4>
              <div className="space-y-2">
                <Label>高点回落 (%)</Label>
                <Input
                  type="number"
                  value={stopLossPercent}
                  onChange={(e) => setStopLossPercent(e.target.value)}
                  placeholder="10"
                />
              </div>
              <div className="space-y-2">
                <Label>卖出比例 (%)</Label>
                <Input
                  type="number"
                  value={stopLossSellPercent}
                  onChange={(e) => setStopLossSellPercent(e.target.value)}
                  placeholder="50"
                />
              </div>
              <Button className="w-full" onClick={handleRiskOrder}>
                设置止损止盈
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
};

export default AdvancedTradingPanel;
