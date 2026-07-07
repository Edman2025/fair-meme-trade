import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SlidersHorizontal } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export interface FilterState {
  hasDevCleared: boolean;
  hasMedia: boolean;
  poolMin: string;
  poolMax: string;
  marketCapMin: string;
  marketCapMax: string;
  holdersMin: string;
  holdersMax: string;
  lpMin: string;
  lpMax: string;
  volumeMin: string;
  volumeMax: string;
  devPoolMin: string;
  devPoolMax: string;
  createdTimeMin: string;
  createdTimeMax: string;
  top10HoldersMin: string;
  top10HoldersMax: string;
  devHoldingsMin: string;
  devHoldingsMax: string;
}

interface FilterPanelProps {
  onFilterChange: (filters: FilterState) => void;
}

const FilterPanel = ({ onFilterChange }: FilterPanelProps) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
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

  const handleReset = () => {
    const resetFilters: FilterState = {
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
    };
    setFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  const handleApply = () => {
    onFilterChange(filters);
    setOpen(false);
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          {t("filters")}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("filters")}</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 py-6">
          {/* Boolean Filters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="dev-cleared">{t("devCleared")}</Label>
              <Switch 
                id="dev-cleared" 
                checked={filters.hasDevCleared}
                onCheckedChange={(checked) => setFilters({ ...filters, hasDevCleared: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="media">{t("hasMedia")}</Label>
              <Switch 
                id="media" 
                checked={filters.hasMedia}
                onCheckedChange={(checked) => setFilters({ ...filters, hasMedia: checked })}
              />
            </div>
          </div>

          {/* Range Filters */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("poolAmount")} (BNB)</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Min" 
                  type="number" 
                  value={filters.poolMin}
                  onChange={(e) => setFilters({ ...filters, poolMin: e.target.value })}
                />
                <Input 
                  placeholder="Max" 
                  type="number" 
                  value={filters.poolMax}
                  onChange={(e) => setFilters({ ...filters, poolMax: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("marketCap")}</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Min" 
                  type="number" 
                  value={filters.marketCapMin}
                  onChange={(e) => setFilters({ ...filters, marketCapMin: e.target.value })}
                />
                <Input 
                  placeholder="Max" 
                  type="number" 
                  value={filters.marketCapMax}
                  onChange={(e) => setFilters({ ...filters, marketCapMax: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("holders")}</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Min" 
                  type="number" 
                  value={filters.holdersMin}
                  onChange={(e) => setFilters({ ...filters, holdersMin: e.target.value })}
                />
                <Input 
                  placeholder="Max" 
                  type="number" 
                  value={filters.holdersMax}
                  onChange={(e) => setFilters({ ...filters, holdersMax: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("lpCount")}</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Min" 
                  type="number" 
                  value={filters.lpMin}
                  onChange={(e) => setFilters({ ...filters, lpMin: e.target.value })}
                />
                <Input 
                  placeholder="Max" 
                  type="number" 
                  value={filters.lpMax}
                  onChange={(e) => setFilters({ ...filters, lpMax: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("volume24h")}</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Min" 
                  type="number" 
                  value={filters.volumeMin}
                  onChange={(e) => setFilters({ ...filters, volumeMin: e.target.value })}
                />
                <Input 
                  placeholder="Max" 
                  type="number" 
                  value={filters.volumeMax}
                  onChange={(e) => setFilters({ ...filters, volumeMax: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>DEV加池子金额 (BNB)</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Min" 
                  type="number" 
                  value={filters.devPoolMin}
                  onChange={(e) => setFilters({ ...filters, devPoolMin: e.target.value })}
                />
                <Input 
                  placeholder="Max" 
                  type="number" 
                  value={filters.devPoolMax}
                  onChange={(e) => setFilters({ ...filters, devPoolMax: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>代幣创建时间</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="开始日期" 
                  type="date" 
                  value={filters.createdTimeMin}
                  onChange={(e) => setFilters({ ...filters, createdTimeMin: e.target.value })}
                />
                <Input 
                  placeholder="结束日期" 
                  type="date" 
                  value={filters.createdTimeMax}
                  onChange={(e) => setFilters({ ...filters, createdTimeMax: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>前10持仓大户 (%)</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Min" 
                  type="number" 
                  value={filters.top10HoldersMin}
                  onChange={(e) => setFilters({ ...filters, top10HoldersMin: e.target.value })}
                />
                <Input 
                  placeholder="Max" 
                  type="number" 
                  value={filters.top10HoldersMax}
                  onChange={(e) => setFilters({ ...filters, top10HoldersMax: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>DEV持仓 (%)</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Min" 
                  type="number" 
                  value={filters.devHoldingsMin}
                  onChange={(e) => setFilters({ ...filters, devHoldingsMin: e.target.value })}
                />
                <Input 
                  placeholder="Max" 
                  type="number" 
                  value={filters.devHoldingsMax}
                  onChange={(e) => setFilters({ ...filters, devHoldingsMax: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleReset}>
              {t("reset")}
            </Button>
            <Button className="flex-1 bg-gradient-primary" onClick={handleApply}>
              Apply {t("filters")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FilterPanel;
