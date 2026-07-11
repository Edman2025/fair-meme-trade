import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useMvp } from "@/contexts/MvpContext";

const styles = [
  { bgColor: "from-emerald-500 via-green-500 to-teal-500", textColor: "text-white" },
  { bgColor: "from-blue-500 via-cyan-500 to-emerald-500", textColor: "text-white" },
  { bgColor: "from-amber-400 via-orange-500 to-rose-500", textColor: "text-black" },
];

const AnnouncementScroller = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();
  const { tokens } = useMvp();
  const announcements = tokens.slice(0, 4).map((token, index) => {
    const style = styles[index % styles.length];
    return {
      title: token.marketMetricsReady
        ? `${token.symbol} ${token.change24h >= 0 ? "+" : ""}${token.change24h.toFixed(2)}%`
        : token.symbol,
      subtitle: token.status === "launched" ? "已上线项目" : token.status === "building" ? "LP 建设中" : "等待审核",
      date: `${token.name} · ${token.poolAmount || "等待 indexer 同步"}`,
      path: `/token/${token.symbol}`,
      ...style,
    };
  });
  const hasAnnouncements = announcements.length > 0;

  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [announcements.length]);

  const currentAnnouncement = announcements[currentIndex] || {
    title: "等待 indexer 同步",
    subtitle: "暂无真实项目公告",
    date: "创建或审核项目后会自动展示",
    path: "/create",
    bgColor: "from-slate-700 via-slate-600 to-zinc-700",
    textColor: "text-white",
  };

  return (
    <Card className="w-full h-full overflow-hidden border-border/50 relative">
      <div
        className={`h-full bg-gradient-to-r ${currentAnnouncement.bgColor} p-8 flex flex-col justify-center items-center transition-all duration-500 relative`}
      >
        <div className="text-center space-y-2">
          <div className={`text-sm font-semibold ${currentAnnouncement.textColor} opacity-90`}>
            {currentAnnouncement.subtitle}
          </div>
          <div className={`text-4xl font-black ${currentAnnouncement.textColor} tracking-tight`}>
            {currentAnnouncement.title}
          </div>
          <div className={`text-sm ${currentAnnouncement.textColor} opacity-80 mt-2`}>
            {currentAnnouncement.date}
          </div>
          <Button
            onClick={() => navigate(currentAnnouncement.path)}
            className={`mt-4 ${currentAnnouncement.textColor === "text-black" ? "bg-black text-yellow-400 hover:bg-black/90" : "bg-white text-black hover:bg-white/90"} font-bold px-8 py-2 rounded-full`}
          >
            {hasAnnouncements ? "查看项目" : "创建项目"}
          </Button>
        </div>

        {/* Navigation dots */}
        {hasAnnouncements && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {announcements.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? `${currentAnnouncement.textColor === "text-black" ? "bg-black" : "bg-white"} w-6`
                  : `${currentAnnouncement.textColor === "text-black" ? "bg-black/30" : "bg-white/30"}`
              }`}
              aria-label={`Go to announcement ${index + 1}`}
            />
          ))}
        </div>}
      </div>
    </Card>
  );
};

export default AnnouncementScroller;
