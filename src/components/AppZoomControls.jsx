import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

const btnStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  minWidth: 30,
  minHeight: 30,
  padding: 0,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#fff",
  color: "#1a3a6b",
  cursor: "pointer",
  flexShrink: 0,
  touchAction: "manipulation",
};

/**
 * Zoom − / % / + / reset. Auto-scales with screen; buttons adjust user factor.
 */
export function AppZoomControls({
  percent,
  zoomIn,
  zoomOut,
  resetZoom,
  canZoomIn,
  canZoomOut,
  compact,
}) {
  return (
    <div
      className="app-zoom-controls no-print"
      role="group"
      aria-label="Page zoom"
      title="Zoom follows screen size. Use − / + to adjust. Ctrl+0 resets."
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: compact ? "2px 4px" : "3px 5px",
      }}
    >
      <button
        type="button"
        aria-label="Zoom out"
        disabled={!canZoomOut}
        onClick={zoomOut}
        style={{ ...btnStyle, opacity: canZoomOut ? 1 : 0.4, cursor: canZoomOut ? "pointer" : "not-allowed" }}
      >
        <ZoomOut size={15} strokeWidth={2.25} />
      </button>
      <button
        type="button"
        aria-label={`Zoom ${percent} percent. Click to reset.`}
        onClick={resetZoom}
        style={{
          ...btnStyle,
          width: "auto",
          minWidth: 44,
          padding: "0 6px",
          fontSize: 11,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          border: "none",
          background: "transparent",
          color: "#334155",
        }}
      >
        {percent}%
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        disabled={!canZoomIn}
        onClick={zoomIn}
        style={{ ...btnStyle, opacity: canZoomIn ? 1 : 0.4, cursor: canZoomIn ? "pointer" : "not-allowed" }}
      >
        <ZoomIn size={15} strokeWidth={2.25} />
      </button>
      {!compact && (
        <button type="button" aria-label="Reset zoom" onClick={resetZoom} style={{ ...btnStyle, width: 28, height: 28, minWidth: 28, minHeight: 28 }} title="Reset to auto">
          <RotateCcw size={13} strokeWidth={2.25} />
        </button>
      )}
    </div>
  );
}
