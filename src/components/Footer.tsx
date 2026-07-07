import { Twitter, Send } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-border/50 bg-card/30 backdrop-blur-sm mt-16">
      <div className="container px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
              <span className="text-lg font-bold text-primary-foreground">M</span>
            </div>
            <span className="text-lg font-bold bg-gradient-primary bg-clip-text text-transparent">
              MemeLaunch
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-8 text-sm">
            <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
              隐私政策
            </a>
            <a href="#" className="text-muted-foreground hover:text-primary transition-smooth">
              服务条款
            </a>
          </div>

          {/* Social - Community */}
          <div className="flex gap-3">
            <a
              href="#"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-card hover:bg-primary/20 border border-border/50 hover:border-primary/50 transition-all duration-300"
              title={t("twitter")}
            >
              <Twitter className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-card hover:bg-secondary/20 border border-border/50 hover:border-secondary/50 transition-all duration-300"
              title={t("telegram")}
            >
              <Send className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
