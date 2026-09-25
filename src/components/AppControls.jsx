import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { C, schoolOrBrandLogo } from "@/shared/theme";

/** Legacy-compatible button used across PSMS pages (shadcn Button underneath). */
export function Btn({ children, onClick, color, small, danger, outline, disabled, style: sx, type, className }) {
  const variant = danger ? "destructive" : outline ? "outline" : "default";
  const size = small ? "sm" : "default";
  const customColor =
    !danger && !outline && color
      ? { background: color, borderColor: color, color: "#fff" }
      : outline && color
        ? { borderColor: color, color }
        : undefined;
  return (
    <Button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      variant={variant}
      size={size}
      className={cn("font-semibold shadow-sm", className)}
      style={{ ...customColor, ...sx }}
    >
      {children}
    </Button>
  );
}

export function Sel({ label, value, onChange, options, width, className, selectClassName, touchFriendly }) {
  const fullW = width === "100%";
  return (
    <div
      className={className || undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        minWidth: fullW ? 0 : undefined,
        width: fullW ? "100%" : undefined,
      }}
    >
      {label && <Label>{label}</Label>}
      <select
        className={cn(
          "rounded-md border border-input bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          touchFriendly ? "min-h-11 py-2.5 text-base" : "h-7 py-1",
          selectClassName
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: width || "auto",
          maxWidth: "100%",
          boxSizing: "border-box",
          cursor: "pointer",
          ...(touchFriendly ? { WebkitAppearance: "menulist" } : {}),
        }}
      >
        {options.map((o) => (
          <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>
            {typeof o === "string" ? o : o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Inp({ label, value, onChange, type = "text", width, className, ...rest }) {
  return (
    <div className={cn("flex flex-col gap-1 min-w-0", className)} style={{ width: width || undefined, maxWidth: "100%" }}>
      {label && <Label>{label}</Label>}
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: width || "auto", maxWidth: "100%", boxSizing: "border-box" }}
        {...rest}
      />
    </div>
  );
}

export function SchoolHeader({ settings, subtitle, rightText, session, printOrder }) {
  const dateStr = new Date().toLocaleDateString("en-PK", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
  const dateTime = rightText ? null : (
    <>
      {session && <div style={{ fontWeight: 600 }}>Session: {session}</div>}
      <div>Date: {dateStr}</div>
      <div>Time: {timeStr}</div>
    </>
  );
  if (printOrder) {
    return (
      <div
        className="print-header-universal"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "14px 20px",
          borderBottom: `2px solid ${C.navy}`,
          marginBottom: 14,
          flexWrap: "wrap",
          background: "#fafbfc",
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <img
            src={schoolOrBrandLogo(settings.logo)}
            style={{ width: 112, height: 112, borderRadius: 8, objectFit: "cover", border: `1px solid ${C.navy}` }}
            alt="School logo"
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: C.navy, letterSpacing: "0.02em" }}>
            {settings.schoolName || "School Name"}
          </div>
          {subtitle && <div style={{ fontSize: 13, color: C.gray, marginTop: 4, fontWeight: 600 }}>{subtitle}</div>}
        </div>
        <div style={{ fontSize: 11, color: C.gray, textAlign: "right", lineHeight: 1.5 }}>
          {rightText ? (
            <>
              {String(rightText)
                .split(" | ")
                .map((p, i) => (
                  <div key={i} style={{ fontWeight: i === 0 ? 700 : 500 }}>
                    {p}
                  </div>
                ))}
              {session && (
                <div style={{ fontWeight: 600, marginTop: 2 }}>Session: {session}</div>
              )}
            </>
          ) : (
            dateTime
          )}
        </div>
      </div>
    );
  }
  return (
    <div
      className="print-header-universal"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 18px",
        borderBottom: `2px solid ${C.navy}`,
        marginBottom: 10,
      }}
    >
      <img
        src={schoolOrBrandLogo(settings.logo)}
        style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
        alt=""
      />
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{settings.schoolName}</div>
        {subtitle && <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ fontSize: 11, color: C.gray, textAlign: "right" }}>
        {rightText ? (
          <>
            {String(rightText)
              .split(" | ")
              .map((p, i) => (
                <div key={i} style={{ fontWeight: i === 0 ? 700 : 500 }}>
                  {p}
                </div>
              ))}
            {session && <div style={{ fontWeight: 600, marginTop: 2 }}>Session: {session}</div>}
          </>
        ) : (
          dateTime
        )}
      </div>
    </div>
  );
}
