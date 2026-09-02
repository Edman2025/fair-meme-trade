import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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
import { useChain } from "./contexts/ChainContext";

const BscOnlyRoute = ({ children }: { children: ReactNode }) => {
  const { activeChainKey } = useChain();
  return activeChainKey === "bsc-testnet" ? children : <Navigate to="/" replace />;
};

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
      <Route path="/my-tokens" element={<BscOnlyRoute><MyTokens /></BscOnlyRoute>} />
      <Route path="/my-lp" element={<BscOnlyRoute><MyLp /></BscOnlyRoute>} />
      <Route path="/share" element={<BscOnlyRoute><Share /></BscOnlyRoute>} />
      <Route path="/nodes" element={<BscOnlyRoute><Nodes /></BscOnlyRoute>} />
      <Route path="/golden-dog-ranking" element={<BscOnlyRoute><GoldenDogRanking /></BscOnlyRoute>} />
      <Route path="/api" element={<Api />} />
      <Route path="/api-docs" element={<Api />} />
      <Route path="/admin" element={<BscOnlyRoute><AdminQueue /></BscOnlyRoute>} />
      <Route path="/lp-launch/:symbol" element={<BscOnlyRoute><LpLaunch /></BscOnlyRoute>} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </TooltipProvider>
);

export default App;
