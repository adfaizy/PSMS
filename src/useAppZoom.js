import { useCallback, useEffect, useState } from "react";

const ZOOM_KEY = "psms_ui_zoom_factor";
const DESIGN_WIDTH = 1366;
const DESIGN_HEIGHT = 800;
const ZOOM_MIN = 0.65;
const ZOOM_MAX = 1.4;
const ZOOM_STEP = 0.05;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function readFactor() {
  try {
    const raw = window.localStorage.getItem(ZOOM_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0.5 && n <= 2) return n;
  } catch {}
  return 1;
}

/** Auto scale from viewport so the same layout shrinks/grows with the screen. */
export function calcAutoScale(width = window.innerWidth, height = window.innerHeight) {
  // Phones keep responsive layout at 100%; tablets/desktops scale with viewport.
  if (width < 640) return 1;
  const byW = width / DESIGN_WIDTH;
  const byH = height / DESIGN_HEIGHT;
  return clamp(Math.min(byW, byH), 0.72, 1.2);
}

/**
 * Auto viewport zoom × user factor (persisted).
 * Zoom in/out adjusts the factor; Reset returns factor to 1 (pure auto).
 */
export function useAppZoom() {
  const [factor, setFactor] = useState(() => (typeof window !== "undefined" ? readFactor() : 1));
  const [autoScale, setAutoScale] = useState(() =>
    typeof window !== "undefined" ? calcAutoScale() : 1
  );

  useEffect(() => {
    const update = () => setAutoScale(calcAutoScale());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(ZOOM_KEY, String(factor));
    } catch {}
  }, [factor]);

  const zoom = clamp(autoScale * factor, ZOOM_MIN, ZOOM_MAX);

  useEffect(() => {
    document.documentElement.style.setProperty("--psms-zoom", String(zoom));
    return () => {
      document.documentElement.style.removeProperty("--psms-zoom");
    };
  }, [zoom]);

  const zoomIn = useCallback(() => {
    setFactor((f) => clamp(Math.round((f + ZOOM_STEP) * 100) / 100, 0.5, 2));
  }, []);

  const zoomOut = useCallback(() => {
    setFactor((f) => clamp(Math.round((f - ZOOM_STEP) * 100) / 100, 0.5, 2));
  }, []);

  const resetZoom = useCallback(() => setFactor(1), []);

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIn, zoomOut, resetZoom]);

  return {
    zoom,
    autoScale,
    factor,
    zoomIn,
    zoomOut,
    resetZoom,
    canZoomIn: zoom < ZOOM_MAX - 0.001,
    canZoomOut: zoom > ZOOM_MIN + 0.001,
    percent: Math.round(zoom * 100),
  };
}
