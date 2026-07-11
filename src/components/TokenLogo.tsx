import { cn } from "@/lib/utils";

const isMediaUrl = (value: string) => /^(https?:\/\/|\/api\/uploads\/)/i.test(value);
const isVideoUrl = (value: string) => /\.(mp4|webm)(\?|#|$)/i.test(value);

type TokenLogoProps = {
  value: string;
  symbol?: string;
  className?: string;
  textClassName?: string;
};

const TokenLogo = ({ value, symbol, className, textClassName }: TokenLogoProps) => {
  const fallback = symbol?.slice(0, 2).toUpperCase() || value?.slice(0, 2).toUpperCase() || "?";
  return (
    <div className={cn("overflow-hidden rounded-full bg-gradient-primary flex items-center justify-center font-bold", className)}>
      {value && isMediaUrl(value) ? (
        isVideoUrl(value) ? (
          <video src={value} className="h-full w-full object-cover" muted loop playsInline autoPlay />
        ) : (
          <img src={value} alt={symbol ? `${symbol} logo` : "Token logo"} className="h-full w-full object-cover" />
        )
      ) : (
        <span className={textClassName}>{value || fallback}</span>
      )}
    </div>
  );
};

export default TokenLogo;
