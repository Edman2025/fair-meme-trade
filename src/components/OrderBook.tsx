import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { TrendingUp } from "lucide-react";
import { formatTokenPrice, formatAmount } from "@/lib/utils";
import { useMvp } from "@/contexts/MvpContext";

interface OrderBookProps {
  symbol?: string;
}

const OrderBook = ({ symbol = "ROCKET" }: OrderBookProps) => {
  const { t } = useLanguage();
  const { getOrderBook } = useMvp();
  const { buys: buyOrders, sells: sellOrders, currentPrice, change24h } = getOrderBook(symbol);
  const hasDepth = buyOrders.length > 0 || sellOrders.length > 0;

  const OrderRow = ({
    price,
    amount,
    total,
    type,
  }: {
    price: number;
    amount: number;
    total: number;
    type: "buy" | "sell";
  }) => (
    <div
      className={`grid grid-cols-3 gap-2 py-1.5 px-2 text-xs hover:bg-${
        type === "buy" ? "success" : "destructive"
      }/5 cursor-pointer transition-colors`}
    >
      <span className={type === "buy" ? "text-success" : "text-destructive"}>{formatTokenPrice(price)} BNB</span>
      <span className="text-muted-foreground text-right">{formatAmount(amount)}</span>
      <span className="text-muted-foreground text-right">{formatAmount(total)} BNB</span>
    </div>
  );

  return (
    <Card className="border-border/50 bg-gradient-card backdrop-blur-sm">
      <div className="p-6">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          {t("orderBook")}
        </h3>

        {/* Header */}
        <div className="grid grid-cols-3 gap-2 py-2 px-2 text-xs font-medium text-muted-foreground border-b border-border/30 mb-2">
          <span>{t("price")}</span>
          <span className="text-right">{t("amount")}</span>
          <span className="text-right">{t("total")}</span>
        </div>

        {hasDepth ? (
          <>
            <div className="space-y-0.5 mb-4">
              {[...sellOrders].reverse().map((order, idx) => (
                <OrderRow key={`sell-${idx}`} {...order} type="sell" />
              ))}
            </div>

            <div className="py-3 px-2 bg-primary/10 rounded-lg mb-4 text-center">
              <div className="text-xl font-bold text-primary">{currentPrice === null ? "等待 Pair" : `${formatTokenPrice(currentPrice)} BNB`}</div>
              {change24h !== null && (
                <div className={`text-xs flex items-center justify-center gap-1 mt-1 ${change24h >= 0 ? "text-success" : "text-destructive"}`}>
                  <TrendingUp className="h-3 w-3" />
                  <span>{change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%</span>
                </div>
              )}
            </div>

            <div className="space-y-0.5">
              {buyOrders.map((order, idx) => (
                <OrderRow key={`buy-${idx}`} {...order} type="buy" />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            暂无真实订单簿深度。AMM 交易以 PancakeSwap Pair 储备报价为准。
            {currentPrice !== null && (
              <div className="mt-3 text-lg font-bold text-primary">{formatTokenPrice(currentPrice)} BNB</div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default OrderBook;
