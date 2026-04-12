import { Lock } from "lucide-react";
import { APP_BRAND_LOGO_URL } from "./branding.js";
import { UI } from "./uiTokens.js";
import "./SplashScreen.css";

export function SplashScreen({ exiting, progressDurationMs = 5000 }) {
  return (
    <div
      className={`app-splash${exiting ? " app-splash--exit" : ""}`}
      style={{ "--splash-progress-ms": `${progressDurationMs}ms` }}
      role="status"
      aria-live="polite"
      aria-label="Loading Punjab School Management System"
    >
      <div className="app-splash__glow" aria-hidden />
      <div className="app-splash__stage">
        <div className="app-splash__logo-wrap">
          <img src={APP_BRAND_LOGO_URL} alt="" className="app-splash__logo" width={UI.logoSplash} height={UI.logoSplash} />
        </div>
      </div>
      <div className="app-splash__progress-block">
        <div
          className="app-splash__progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={exiting ? 100 : undefined}
          aria-label="Loading progress"
        >
          <div className="app-splash__progress-fill" />
        </div>
        <div className="app-splash__loading-label">Loading…</div>
      </div>
      <div className="app-splash__footer">
        <Lock className="app-splash__lock" aria-hidden strokeWidth={2.25} />
        <span>Punjab School Management System</span>
      </div>
    </div>
  );
}
