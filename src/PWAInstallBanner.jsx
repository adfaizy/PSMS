import React, { useState, useEffect, useCallback } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const DISMISS_KEY = "psms_pwa_install_dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function detectPlatform() {
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return { isIOS, isAndroid, isMobile };
}

const PWAInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [{ isIOS, isMobile }] = useState(detectPlatform);

  const dismiss = useCallback(() => {
    setShowBanner(false);
    setIosHint(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || window.__TAURI__) return;
    if (isStandalone()) return;

    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw && Date.now() - Number(raw) < 7 * 24 * 60 * 60 * 1000) return;
    } catch {
      /* ignore */
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIosHint(false);
      setShowBanner(true);
    };

    const handleInstalled = () => {
      setDeferredPrompt(null);
      setShowBanner(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    // iOS Safari never fires beforeinstallprompt — show Add to Home Screen tip
    if (isIOS) {
      const t = window.setTimeout(() => {
        if (!isStandalone()) {
          setIosHint(true);
          setShowBanner(true);
        }
      }, 1800);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.removeEventListener("appinstalled", handleInstalled);
      };
    }

    // Desktop / Android: if install event never comes, still offer a soft tip after delay
    const tipTimer = window.setTimeout(() => {
      setShowBanner((open) => open || false);
    }, 4000);

    return () => {
      window.clearTimeout(tipTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [isIOS]);

  const handleInstallClick = async () => {
    if (iosHint || isIOS) {
      // Keep banner open with instructions — user must use Share → Add to Home Screen
      setIosHint(true);
      setShowBanner(true);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (!showBanner || window.__TAURI__ || isStandalone()) return null;

  const canNativeInstall = Boolean(deferredPrompt) && !isIOS;

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-[1000] border-primary/20 bg-card shadow-lg sm:left-auto sm:right-4 sm:max-w-md">
      <CardContent className="flex items-start gap-3 p-3 sm:p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {isIOS ? <Share className="size-5" /> : <Download className="size-5" />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold">Install Punjab-SMS</p>
          {isIOS || iosHint ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              On iPhone/iPad: tap <strong>Share</strong> → <strong>Add to Home Screen</strong> → Add.
              Works offline after install.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isMobile
                ? "Install on your phone for a full-screen app experience."
                : "Install on Windows/Mac for a desktop app shortcut."}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {canNativeInstall ? (
            <Button size="sm" onClick={() => void handleInstallClick()}>
              Install
            </Button>
          ) : null}
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={dismiss}>
            <X className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PWAInstallBanner;
