import { useEffect, useState } from "react";
import App from "./App.jsx";
import { SplashScreen } from "./SplashScreen.jsx";

/** Visible splash (logo static + progress bar) before fade-out */
const SPLASH_MIN_MS = 1400;
const SPLASH_FADE_MS = 480;

export default function Root() {
  const isHostedWeb =
    typeof window !== "undefined" &&
    !window.Capacitor;
  const splashMinMs = isHostedWeb ? 900 : SPLASH_MIN_MS;
  const [showSplash, setShowSplash] = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setSplashExiting(true), splashMinMs);
    const t2 = window.setTimeout(() => setShowSplash(false), splashMinMs + SPLASH_FADE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [splashMinMs]);

  return (
    <>
      {showSplash && <SplashScreen exiting={splashExiting} progressDurationMs={splashMinMs} />}
      <App />
    </>
  );
}
