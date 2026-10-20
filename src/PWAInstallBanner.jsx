import React, { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PWAInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowBanner(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  if (!showBanner || window.__TAURI__) return null;

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-[1000] border-primary/20 bg-card shadow-lg sm:left-auto sm:right-4 sm:max-w-md">
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Download className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install SMS App</p>
          <p className="text-xs text-muted-foreground">
            {isMobile
              ? "Install on your phone for faster access."
              : "Install on your PC for desktop shortcuts."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" onClick={handleInstallClick}>
            Install
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={() => setShowBanner(false)}>
            <X className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PWAInstallBanner;
