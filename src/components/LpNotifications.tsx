import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Bell } from "lucide-react";

interface LpNotificationsProps {
  launchDeadline: string;
  tradingStartTime: string;
}

export const LpNotifications = ({ launchDeadline, tradingStartTime }: LpNotificationsProps) => {
  const { toast } = useToast();
  const sentRef = useRef({ launch: false, tradingSoon: false, tradingStarted: false });

  useEffect(() => {
    const checkNotifications = () => {
      const now = new Date().getTime();
      const launchTime = new Date(launchDeadline).getTime();
      const tradingTime = new Date(tradingStartTime).getTime();
      
      const launchDiff = launchTime - now;
      const tradingDiff = tradingTime - now;
      
      // 发射截止前1小时提醒
      if (!sentRef.current.launch && launchDiff > 0 && launchDiff <= 60 * 60 * 1000) {
        sentRef.current.launch = true;
        toast({
          title: "⚠️ 发射即将截止",
          description: "距离LP发射截止还有不到1小时，请尽快添加LP！",
          duration: 10000,
        });
      }
      
      // 交易开始提醒
      if (!sentRef.current.tradingSoon && tradingDiff > 0 && tradingDiff <= 5 * 60 * 1000) {
        sentRef.current.tradingSoon = true;
        toast({
          title: "🚀 交易即将开始",
          description: "交易将在5分钟后开始，请做好准备！",
          duration: 10000,
        });
      }
      
      // 交易已开始提醒
      if (!sentRef.current.tradingStarted && tradingDiff <= 0) {
        sentRef.current.tradingStarted = true;
        toast({
          title: "✅ 交易已开始",
          description: "代币交易已正式开始！",
          duration: 10000,
        });
      }
    };

    // 每分钟检查一次
    const interval = setInterval(checkNotifications, 60 * 1000);
    
    // 立即检查一次
    checkNotifications();

    return () => clearInterval(interval);
  }, [launchDeadline, tradingStartTime, toast]);

  return null;
};
