import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import TokenDetail from "./pages/TokenDetail";
import WalletDetail from "./pages/WalletDetail";
import Create from "./pages/Create";
import MyTokens from "./pages/MyTokens";
import MyLp from "./pages/MyLp";
import Share from "./pages/Share";
import Nodes from "./pages/Nodes";
import GoldenDogRanking from "./pages/GoldenDogRanking";
import Api from "./pages/Api";
import LpLaunch from "./pages/LpLaunch";
import AdminQueue from "./pages/AdminQueue";
import NotFound from "./pages/NotFound";
import LogoClickEffect from "./components/LogoClickEffect";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <LogoClickEffect />
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/token/:symbol" element={<TokenDetail />} />
      <Route path="/wallet/:address" element={<WalletDetail />} />
      <Route path="/create" element={<Create />} />
      <Route path="/my-tokens" element={<MyTokens />} />
      <Route path="/my-lp" element={<MyLp />} />
      <Route path="/share" element={<Share />} />
      <Route path="/nodes" element={<Nodes />} />
      <Route path="/golden-dog-ranking" element={<GoldenDogRanking />} />
      <Route path="/api" element={<Api />} />
      <Route path="/api-docs" element={<Api />} />
      <Route path="/admin" element={<AdminQueue />} />
      <Route path="/lp-launch/:symbol" element={<LpLaunch />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </TooltipProvider>
);

export default App;
