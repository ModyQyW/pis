import { StrictMode, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { TooltipProvider } from "./components/ui/tooltip";
import { getLocale, subscribeLocale } from "./lib/i18n";
import "./styles.css";

function LocaleRoot() {
  useSyncExternalStore(subscribeLocale, getLocale);
  return <App />;
}

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <LocaleRoot />
    </TooltipProvider>
  </StrictMode>,
);
