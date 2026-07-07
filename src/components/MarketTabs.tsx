import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Rocket, Clock, Hammer, Droplet, TrendingUp, Star, DollarSign } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface MarketTabsProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

const MarketTabs = ({ activeTab, onTabChange }: MarketTabsProps) => {
  const { t } = useLanguage();
  
  const tabs = [
    { value: "launched", key: "launched", icon: Rocket },
    { value: "pending", key: "pending", icon: Clock },
    { value: "building", key: "lpBuilding", icon: Hammer },
    { value: "myLp", key: "myLp", icon: Droplet },
    { value: "dividends", key: "dividends", icon: TrendingUp },
    { value: "following", key: "following", icon: Star },
    { value: "smartMoney", key: "smartMoney", icon: DollarSign },
  ];

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="w-full justify-start h-auto flex-wrap gap-2 bg-card/50 p-2 rounded-lg border border-border/50">
        {tabs.map(({ value, key, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="gap-2 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground transition-all duration-300 data-[state=active]:shadow-elegant"
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t(key)}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

export default MarketTabs;
