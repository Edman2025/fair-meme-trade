import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import { MvpProvider } from "./contexts/MvpContext";
import "./index.css";
import App from "./App.tsx";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MvpProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </MvpProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </StrictMode>
);
