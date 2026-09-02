import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMvp } from "@/contexts/MvpContext";
import { useChain } from "@/contexts/ChainContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/backendApi";
import { buyPonsCurveToken, getPonsAssetBalance, PonsCurveQuote, quotePonsCurve, sellPonsCurveToken } from "@/lib/ponsV2";

const PonsTradingPanel = ({ tokenSymbol }: { tokenSymbol: string }) => {
  const { getTokenBySymbol, isConnected, walletAddress, connectInjectedWallet, recordTrade } = useMvp();
  const { activeChain } = useChain();
  const { toast } = useToast();
  const token = getTokenBySymbol(tokenSymbol);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("1");
  const [quote, setQuote] = useState<PonsCurveQuote | null>(null);
  const [balance, setBalance] = useState("");
  const [busy, setBusy] = useState(false);

  const inputAsset = side === "buy" ? token?.pairTokenAddress : token?.contractAddress;
  const inputDecimals = side === "buy" ? token?.quoteDecimals || 18 : 18;
  const inputSymbol = side === "buy" ? token?.lpPairToken || "ETH" : token?.symbol || "TOKEN";
  const outputSymbol = side === "buy" ? token?.symbol || "TOKEN" : token?.lpPairToken || "ETH";

  useEffect(() => {
    let cancelled = false;
    if (!walletAddress || !inputAsset) {
      setBalance("");
      return;
    }
    getPonsAssetBalance(inputAsset, walletAddress, inputDecimals)
      .then((value) => {
        if (!cancelled) setBalance(value);
      })
      .catch(() => {
        if (!cancelled) setBalance("");
      });
    return () => {
      cancelled = true;
    };
  }, [inputAsset, inputDecimals, walletAddress]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!token?.curveAddress || !amount || Number(amount) <= 0 || token.graduated) {
        setQuote(null);
        return;
      }
      quotePonsCurve({
        curveAddress: token.curveAddress,
        side,
        amount,
        quoteDecimals: token.quoteDecimals || 18,
        slippagePercent: Number(slippage) || 1,
      }).then((value) => {
        if (!cancelled) setQuote(value);
      }).catch(() => {
        if (!cancelled) setQuote(null);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [amount, side, slippage, token]);

  if (!token) return null;
  if (token.graduated) {
    return (
      <Card className="p-5">
        <p className="font-semibold">PONS V2 · Uniswap V4</p>
        <p className="mt-2 text-sm text-muted-foreground">该项目已从 bonding curve 毕业。本站不会把 V4 交易错误发送到 curve 或 Pancake Router。</p>
        <Button asChild className="mt-4 w-full" variant="outline">
          <a href={`https://ponsfamily.com/token/${token.contractAddress}`} target="_blank" rel="noopener noreferrer">
            在 PONS 打开交易
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </Card>
    );
  }

  const submit = async () => {
    if (!amount || Number(amount) <= 0 || !token.curveAddress || !token.pairTokenAddress) return;
    setBusy(true);
    try {
      let activeWallet = walletAddress;
      if (!isConnected) activeWallet = (await connectInjectedWallet()).address;
      const result = side === "buy"
        ? await buyPonsCurveToken({
          curveAddress: token.curveAddress,
          pairTokenAddress: token.pairTokenAddress,
          amount,
          quoteDecimals: token.quoteDecimals || 18,
          slippagePercent: Number(slippage) || 1,
        })
        : await sellPonsCurveToken({
          curveAddress: token.curveAddress,
          tokenAddress: token.contractAddress,
          amount,
          quoteDecimals: token.quoteDecimals || 18,
          slippagePercent: Number(slippage) || 1,
        });
      try {
        await apiRequest("/api/chain-transactions", {
          method: "POST",
          body: JSON.stringify({
            txHash: result.txHash,
            action: "ponsCurveSwap",
            tokenAddress: token.contractAddress,
            walletAddress: activeWallet,
            chainId: activeChain.chainId,
            status: "submitted",
            payload: { side, amount, minOut: result.quote.minOut, curveAddress: token.curveAddress, protocol: "PONS_V2" },
          }),
        });
      } catch {
        // The wallet transaction remains canonical if backend recording is delayed.
      }
      recordTrade({ tokenSymbol: token.symbol, side, amount, currency: inputSymbol }, {
        id: `pons-${Date.now()}`,
        action: "trade",
        tokenSymbol: token.symbol,
        txHash: result.txHash,
        status: "submitted",
        createdAt: new Date().toLocaleString(),
        mode: "wallet",
      });
      toast({ title: "PONS 交易已提交", description: `${result.txHash.slice(0, 10)}...` });
      setAmount("");
    } catch (error) {
      toast({ title: "PONS 交易失败", description: error instanceof Error ? error.message : "请检查余额、授权和滑点。", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-semibold">PONS V2 Curve</p>
          <p className="text-xs text-muted-foreground">真实储备报价 · Robinhood Chain</p>
        </div>
        <span className="text-xs text-emerald-400">{token.graduationProgress?.toFixed(2)}%</span>
      </div>
      <Tabs value={side} onValueChange={(value) => { setSide(value as "buy" | "sell"); setAmount(""); setQuote(null); }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="buy">买入</TabsTrigger>
          <TabsTrigger value="sell">卖出</TabsTrigger>
        </TabsList>
        <TabsContent value={side} className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>支付数量</Label>
              <span className="text-xs text-muted-foreground">余额 {balance ? Number(balance).toLocaleString(undefined, { maximumFractionDigits: 6 }) : "--"} {inputSymbol}</span>
            </div>
            <div className="relative">
              <Input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} className="pr-20" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium">{inputSymbol}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>滑点</Label>
            <div className="relative">
              <Input type="number" min="0.1" max="20" step="0.1" value={slippage} onChange={(event) => setSlippage(event.target.value)} className="pr-10" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">%</span>
            </div>
          </div>
          <div className="min-h-20 border-y border-border py-3 text-sm">
            {quote ? (
              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">预计获得</span><span>{Number(quote.amountOut).toLocaleString(undefined, { maximumFractionDigits: 8 })} {outputSymbol}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">最少获得</span><span>{Number(quote.minOut).toLocaleString(undefined, { maximumFractionDigits: 8 })}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">价格影响</span><span>{quote.priceImpactPercent.toFixed(2)}%</span></div>
              </div>
            ) : (
              <div className="flex h-14 items-center justify-center gap-2 text-muted-foreground"><RefreshCw className="h-4 w-4" />输入数量后读取实时储备</div>
            )}
          </div>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-600/90"
            disabled={busy || !amount || Number(amount) <= 0 || (isConnected && !quote)}
            onClick={() => void submit()}
          >
            {busy
              ? "钱包确认中..."
              : `${isConnected ? "" : "连接钱包并"}${side === "buy" ? "买入" : "卖出"} ${token.symbol}`}
          </Button>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default PonsTradingPanel;
