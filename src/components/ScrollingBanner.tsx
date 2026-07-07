import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const ScrollingBanner = () => {
  const [isPaused, setIsPaused] = useState(false);
  const { t } = useLanguage();

  const items = [
    { id: "1", key: "banner1" },
    { id: "2", key: "banner2" },
    { id: "3", key: "banner3" },
    { id: "4", key: "banner4" },
    { id: "5", key: "banner5" },
  ];

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
              <span className="text-sm font-medium">{t(item.key)}</span>
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
