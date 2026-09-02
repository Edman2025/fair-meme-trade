import { useState, useMemo } from "react";
import Header from "@/components/Header";
import ScrollingBanner from "@/components/ScrollingBanner";

import Footer from "@/components/Footer";
import AnnouncementScroller from "@/components/AnnouncementScroller";

import MarketTabs from "@/components/MarketTabs";
import TokenCard from "@/components/TokenCard";
import FilterPanel, { FilterState } from "@/components/FilterPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, FileText, ExternalLink, Radio } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMvp } from "@/contexts/MvpContext";
import { useNavigate } from "react-router-dom";
import { useChain } from "@/contexts/ChainContext";

const Index = () => {
  const [activeTab, setActiveTab] = useState("launched");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    hasDevCleared: false,
    hasMedia: false,
    poolMin: "",
    poolMax: "",
    marketCapMin: "",
    marketCapMax: "",
    holdersMin: "",
    holdersMax: "",
    lpMin: "",
    lpMax: "",
    volumeMin: "",
    volumeMax: "",
    devPoolMin: "",
    devPoolMax: "",
    createdTimeMin: "",
    createdTimeMax: "",
    top10HoldersMin: "",
    top10HoldersMax: "",
    devHoldingsMin: "",
    devHoldingsMax: "",
  });
  const [displayCount, setDisplayCount] = useState(6);
  const { t } = useLanguage();
  const { tokens, lpPositions, isTokenFeedLoading, tokenFeedError } = useMvp();
  const { activeChain } = useChain();
  const navigate = useNavigate();
  // Filter and search logic
  const filteredTokens = useMemo(() => {
    let result = tokens;

    // Filter by search query
    if (searchQuery) {
      result = result.filter(
        (token) =>
          token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.contractAddress.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by tab
    if (activeTab === "building") {
      result = result.filter((token) => token.status === "building");
    } else if (activeTab === "pending") {
      result = result.filter((token) => token.status === "pending");
    } else if (activeTab === "myLp") {
      const lpSymbols = new Set(lpPositions.map((position) => position.tokenSymbol));
      result = result.filter((token) => lpSymbols.has(token.symbol));
    } else if (activeTab === "dividends") {
      result = result.filter((token) => token.category === "usStock");
    } else if (activeTab === "following") {
      result = result.filter((token) => token.isFollowing);
    } else if (activeTab === "smartMoney") {
      result = result.filter((token) => (token.smartMoneyMentions || 0) > 0);
    } else if (activeTab === "launched") {
      result = result.filter((token) => token.status === "launched" && token.category === "meme");
    }

    // Filter by holders
    if (filters.holdersMin) {
      result = result.filter((token) => token.holders >= parseInt(filters.holdersMin));
    }
    if (filters.holdersMax) {
      result = result.filter((token) => token.holders <= parseInt(filters.holdersMax));
    }

    // Filter by LP count
    if (filters.lpMin) {
      result = result.filter((token) => token.lpCount >= parseInt(filters.lpMin));
    }
    if (filters.lpMax) {
      result = result.filter((token) => token.lpCount <= parseInt(filters.lpMax));
    }

    return result;
  }, [searchQuery, activeTab, filters, lpPositions, tokens]);

  const displayedTokens = filteredTokens.slice(0, displayCount);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <ScrollingBanner />

      <main className="container px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${activeChain.key === "robinhood-mainnet" ? "bg-emerald-400" : "bg-amber-400"}`} />
            <div>
              <p className="font-semibold">{activeChain.chainName}</p>
              <p className="text-sm text-muted-foreground">
                {activeChain.protocol === "pons-v2" ? "PONS V2 链上项目 · 价格与储备直接读取 bonding curve" : "Fair Meme V3 · PancakeSwap V2"}
              </p>
            </div>
          </div>
          <a
            href={activeChain.blockExplorerUrls[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Radio className="h-4 w-4" />
            Chain explorer
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Create Token Section */}
        <div className="mb-8">
          <div className="flex gap-6 items-stretch">
            {/* Left side - Create Token and Search */}
            <div className="max-w-[614px] flex flex-col justify-between h-full">
              <div className="space-y-2">
                <Button
                  size="lg"
                  className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
                  onClick={() => navigate("/create")}
                >
                  <Plus className="mr-2 h-5 w-5" />
                  {activeChain.protocol === "pons-v2" ? "PONS 发射入口" : t("createToken")}
                </Button>
                <div className="flex gap-2 text-sm text-muted-foreground items-center">
                  <FileText className="h-4 w-4" />
                  <a href="#" className="hover:text-primary transition-smooth">
                    {t("howToCreate")}
                  </a>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex items-center gap-2 w-full">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t("searchPlaceholder")}
                    className="pl-10 h-12 bg-card/50 border-border/50 focus:border-primary/50 transition-smooth"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button size="lg" className="h-12">
                  <Search className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Right side - Announcement Scroller */}
            <div className="flex-1 hidden lg:block">
              <AnnouncementScroller />
            </div>
          </div>
        </div>

        {/* Market Tabs */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="w-full sm:flex-1">
              <MarketTabs activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
            <FilterPanel onFilterChange={setFilters} />
          </div>
        </div>

        {/* Token Grid */}
        {isTokenFeedLoading ? (
          <div className="py-16 text-center text-muted-foreground">正在读取 {activeChain.chainName} 真实链上项目...</div>
        ) : displayedTokens.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedTokens.map((token) => (
                <TokenCard 
                  key={`${token.chainKey}-${token.contractAddress}`}
                  {...token}
                />
              ))}
            </div>

            {/* Load More */}
            {displayCount < filteredTokens.length && (
              <div className="mt-8 text-center">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="hover:border-primary/50 transition-smooth"
                  onClick={() => setDisplayCount(displayCount + 6)}
                >
                  {t("loadMore")} ({filteredTokens.length - displayCount} more)
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">
              {tokenFeedError || `当前筛选条件下没有 ${activeChain.chainName} 项目`}
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                setSearchQuery("");
                setFilters({
                  hasDevCleared: false,
                  hasMedia: false,
                  poolMin: "",
                  poolMax: "",
                  marketCapMin: "",
                  marketCapMax: "",
                  holdersMin: "",
                  holdersMax: "",
                  lpMin: "",
                  lpMax: "",
                  volumeMin: "",
                  volumeMax: "",
                  devPoolMin: "",
                  devPoolMax: "",
                  createdTimeMin: "",
                  createdTimeMax: "",
                  top10HoldersMin: "",
                  top10HoldersMax: "",
                  devHoldingsMin: "",
                  devHoldingsMax: "",
                });
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </main>
      
      <Footer />

    </div>
  );
};

export default Index;
