import { useCountdown } from "@/hooks/useCountdown";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  targetDate: string;
  label: string;
  className?: string;
}

export const CountdownTimer = ({ targetDate, label, className = "" }: CountdownTimerProps) => {
  const { days, hours, minutes, seconds, isExpired } = useCountdown(targetDate);
  const hasValidTarget = Number.isFinite(new Date(targetDate).getTime());
  
  // 检查是否少于24小时（警告状态）
  const totalHours = days * 24 + hours;
  const isWarning = totalHours < 24 && !isExpired;
  
  // 根据状态选择颜色
  const colorClass = isWarning ? "text-destructive" : "text-primary";
  const bgClass = isWarning ? "bg-destructive/10" : "bg-primary/10";
  const borderClass = isWarning ? "border-destructive/20" : "border-primary/20";
  const animateClass = isWarning ? "animate-warning-pulse" : "animate-price-pulse";

  if (!hasValidTarget) {
    return (
      <div className={`flex items-center gap-2 rounded border border-dashed border-border p-4 ${className}`}>
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}：等待同步</span>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}: 已截止</span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Clock className={`h-4 w-4 ${isWarning ? colorClass + ' animate-warning-pulse' : colorClass}`} />
        <span className={`text-sm ${isWarning ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
          {label}
          {isWarning && " (即将截止)"}
        </span>
      </div>
      <div className="flex gap-2">
        <div className={`flex flex-col items-center min-w-[60px] p-2 ${bgClass} rounded-lg border ${borderClass}`}>
          <span className={`text-2xl font-bold ${colorClass} ${animateClass}`}>{days}</span>
          <span className="text-xs text-muted-foreground">天</span>
        </div>
        <div className={`flex flex-col items-center min-w-[60px] p-2 ${bgClass} rounded-lg border ${borderClass}`}>
          <span className={`text-2xl font-bold ${colorClass} ${animateClass}`}>{hours}</span>
          <span className="text-xs text-muted-foreground">时</span>
        </div>
        <div className={`flex flex-col items-center min-w-[60px] p-2 ${bgClass} rounded-lg border ${borderClass}`}>
          <span className={`text-2xl font-bold ${colorClass} ${animateClass}`}>{minutes}</span>
          <span className="text-xs text-muted-foreground">分</span>
        </div>
        <div className={`flex flex-col items-center min-w-[60px] p-2 ${bgClass} rounded-lg border ${borderClass}`}>
          <span className={`text-2xl font-bold ${colorClass} ${animateClass}`}>{seconds}</span>
          <span className="text-xs text-muted-foreground">秒</span>
        </div>
      </div>
    </div>
  );
};
