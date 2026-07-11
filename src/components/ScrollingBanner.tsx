import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useMvp } from "@/contexts/MvpContext";

const ScrollingBanner = () => {
  const [isPaused, setIsPaused] = useState(false);
  const { tokens } = useMvp();

  const items = tokens.slice(0, 5).map((token) => ({
    id: token.contractAddress,
    text: `${token.symbol} · ${token.status === "launched" ? "已上线" : token.status === "pending" ? "待审核" : "LP 建设中"} · ${token.poolAmount}`,
  }));

  if (!items.length) {
    return (
      <div className="w-full bg-gradient-primary py-3 px-4 text-sm font-medium text-primary-foreground">
        暂无真实项目动态，等待 indexer 同步。
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-primary overflow-hidden">
      <div
        className="flex items-center gap-8 py-3 px-4"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className={`flex gap-8 ${!isPaused ? "animate-scroll" : ""}`}>
          {[...items, ...items].map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="flex items-center gap-2 whitespace-nowrap text-primary-foreground cursor-pointer hover:opacity-80 transition-opacity"
            >
              <span className="text-sm font-medium">{item.text}</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default ScrollingBanner;
