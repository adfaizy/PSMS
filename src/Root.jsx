import { useEffect, useState } from "react";
import App from "./App.jsx";
import { SplashScreen } from "./SplashScreen.jsx";

/** Short splash so startup feels instant; fade is brief. */
const SPLASH_MIN_MS = 320;
const SPLASH_FADE_MS = 180;

export default function Root() {
  const isHostedWeb =
    typeof window !== "undefined" &&
    !window.Capacitor;
  const splashMinMs = isHostedWeb ? 220 : SPLASH_MIN_MS;
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
