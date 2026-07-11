import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, Droplet, Globe, Twitter, Send } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";

interface TokenCardProps {
  logo: string;
  name: string;
  symbol: string;
  totalSupply: string;
  lpCount: number;
  holders: number;
  change24h: number;
  currentPrice: string;
  marketCap: string;
  volume24h: string;
  poolAmount: string;
  description: string;
  hasDividend?: boolean;
  hasBurn?: boolean;
  hasMarketing?: boolean;
  website?: string;
  twitter?: string;
  telegram?: string;
  status?: "launched" | "pending" | "building";
  marketMetricsReady?: boolean;
}

const TokenCard = ({
  logo,
  name,
  symbol,
  totalSupply,
  lpCount,
  holders,
  change24h,
  currentPrice,
  marketCap,
  volume24h,
  poolAmount,
  description,
  hasDividend,
  hasBurn,
  hasMarketing,
  website,
  twitter,
  telegram,
  status = "launched",
  marketMetricsReady,
}: TokenCardProps) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isPositive = change24h >= 0;

  const handleClick = () => {
    // 如果是building状态，跳转到LP发射页面
    if (status === "building") {
      navigate(`/lp-launch/${symbol}`);
    } else {
      navigate(`/token/${symbol}`);
    }
  };

  return (
    <Card 
      className="group relative overflow-hidden border border-border/50 bg-gradient-card backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-elegant cursor-pointer"
      onClick={handleClick}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center text-2xl font-bold">
              {logo}
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-smooth">
                {name}
              </h3>
              <p className="text-sm text-muted-foreground">{symbol}</p>
            </div>
          </div>
          <div className="text-right">
            {marketMetricsReady ? (
              <div className={`flex items-center justify-end gap-1 ${isPositive ? "text-success" : "text-destructive"} animate-fade-in`}>
                {isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span className="text-sm font-semibold">
                  {isPositive ? "+" : ""}{change24h.toFixed(2)}%
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">指标同步中</p>
            )}
            <p className="text-sm font-bold text-foreground mt-1 animate-scale-in">{currentPrice}</p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          {hasDividend && (
            <Badge variant="secondary" className="bg-secondary/20">
              {t("dividend")}
            </Badge>
          )}
          {hasBurn && (
            <Badge variant="destructive" className="bg-destructive/20">
              {t("burn")}
            </Badge>
          )}
          {hasMarketing && (
            <Badge variant="outline" className="border-accent/50">
              {t("marketing")}
            </Badge>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("marketCap")}</p>
            <p className="text-sm font-semibold text-foreground">{marketCap}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("volume24h")}</p>
            <p className="text-sm font-semibold text-foreground">{volume24h}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("pool")}</p>
            <p className="text-sm font-semibold text-secondary">{poolAmount}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("supply")}</p>
            <p className="text-sm font-semibold text-foreground">{totalSupply}</p>
          </div>
        </div>

        {/* User Stats */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Droplet className="h-4 w-4" />
            <span>{lpCount} {t("myLp").split(" ")[1] || "LP"}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{holders} {t("holders")}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{description}</p>

        {/* Media Links */}
        {(website || twitter || telegram) && (
          <div className="flex items-center gap-3">
            {website && (
              <a 
                href={website} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-smooth"
              >
                <Globe className="h-4 w-4" />
              </a>
            )}
            {twitter && (
              <a 
                href={twitter} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-smooth"
              >
                <Twitter className="h-4 w-4" />
              </a>
            )}
            {telegram && (
              <a 
                href={telegram} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-smooth"
              >
                <Send className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Hover effect */}
      <div className="absolute inset-0 -z-10 bg-gradient-primary opacity-0 transition-opacity duration-300 group-hover:opacity-5" />
    </Card>
  );
};

export default TokenCard;
