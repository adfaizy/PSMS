import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./responsive.css";
import Root from "./Root.jsx";

/** Keys left by the removed Finance module (see git: FinanceContext + docs). */
function removeLegacyFinanceStorageKeys() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === "financeData" || k.startsWith("finance:") || k.startsWith("finance_")) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore private mode / quota */
  }
}
removeLegacyFinanceStorageKeys();

const isProduction = import.meta.env.PROD;
const base = import.meta.env.BASE_URL || "/";
const withSlash = base.endsWith("/") ? base : `${base}/`;
const swUrl = `${withSlash}sw.js`;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (isProduction) {
      navigator.serviceWorker
        .register(swUrl, { updateViaCache: "none" })
        .catch(() => {
          // ignore registration errors in unsupported environments
        });
      return;
    }

    // Avoid stale production cache while developing locally.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    }).catch(() => {
      // ignore cleanup failures in unsupported environments
    });
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
