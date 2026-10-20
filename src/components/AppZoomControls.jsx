import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const iconBtnClass =
  "size-[30px] min-h-[30px] min-w-[30px] shrink-0 touch-manipulation p-0";

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
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Zoom out"
        disabled={!canZoomOut}
        onClick={zoomOut}
        className={iconBtnClass}
      >
        <ZoomOut size={15} strokeWidth={2.25} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        aria-label={`Zoom ${percent} percent. Click to reset.`}
        onClick={resetZoom}
        className={cn(
          iconBtnClass,
          "h-[30px] w-auto min-w-[44px] border-none bg-transparent px-1.5 text-[11px] font-bold tabular-nums text-slate-700 hover:bg-transparent"
        )}
      >
        {percent}%
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Zoom in"
        disabled={!canZoomIn}
        onClick={zoomIn}
        className={iconBtnClass}
      >
        <ZoomIn size={15} strokeWidth={2.25} />
      </Button>
      {!compact && (
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          aria-label="Reset zoom"
          title="Reset to auto"
          onClick={resetZoom}
          className="size-7 min-h-7 min-w-7 shrink-0 touch-manipulation p-0"
        >
          <RotateCcw size={13} strokeWidth={2.25} />
        </Button>
      )}
    </div>
  );
}
