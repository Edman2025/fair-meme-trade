import { useState } from "react";
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
  const [mediaFailed, setMediaFailed] = useState(false);
  const fallback = symbol?.slice(0, 2).toUpperCase() || value?.slice(0, 2).toUpperCase() || "?";
  const showMedia = Boolean(value && isMediaUrl(value) && !mediaFailed);

  return (
    <div className={cn("overflow-hidden rounded-full bg-gradient-primary flex items-center justify-center font-bold", className)}>
      {showMedia ? (
        isVideoUrl(value) ? (
          <video src={value} className="h-full w-full object-cover" muted loop playsInline autoPlay onError={() => setMediaFailed(true)} />
        ) : (
          <img src={value} alt={symbol ? `${symbol} logo` : "Token logo"} className="h-full w-full object-cover" onError={() => setMediaFailed(true)} />
        )
      ) : (
        <span className={textClassName}>{fallback}</span>
      )}
    </div>
  );
};

export default TokenLogo;
