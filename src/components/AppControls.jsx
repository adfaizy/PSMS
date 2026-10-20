import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { schoolOrBrandLogo } from "@/shared/theme";

/** shadcn Button with legacy Btn API (small / danger / outline). */
export function Btn({ children, onClick, color, small, danger, outline, disabled, style: sx, type, className }) {
  const variant = danger ? "destructive" : outline ? "outline" : "default";
  const size = small ? "sm" : "default";
  return (
    <Button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      variant={variant}
      size={size}
      className={cn(className)}
      style={sx}
    >
      {children}
    </Button>
  );
}

/** shadcn NativeSelect + Label with legacy Sel API. */
export function Sel({ label, value, onChange, options, width, className, selectClassName, touchFriendly }) {
  const fullW = width === "100%";
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5",
        fullW && "w-full",
        className
      )}
      style={width && width !== "100%" ? { width } : undefined}
    >
      {label ? <Label>{label}</Label> : null}
      <NativeSelect
        value={value}
        onChange={(e) => onChange(e.target.value)}
        size={touchFriendly ? "default" : "sm"}
        className={cn("w-full max-w-full", fullW && "w-full", selectClassName)}
      >
        {(options || []).map((o) => {
          const optValue = typeof o === "string" ? o : o.value;
          const optLabel = typeof o === "string" ? o : o.label;
          return (
            <NativeSelectOption key={String(optValue)} value={optValue}>
              {optLabel}
            </NativeSelectOption>
          );
        })}
      </NativeSelect>
    </div>
  );
}

/** shadcn Input + Label with legacy Inp API. */
export function Inp({ label, value, onChange, type = "text", width, className, inputClassName, ...rest }) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
      style={width ? { width, maxWidth: "100%" } : undefined}
    >
      {label ? <Label>{label}</Label> : null}
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-8", inputClassName)}
        {...rest}
      />
    </div>
  );
}

/** Print/screen school header built from shadcn Card. */
export function SchoolHeader({ settings, subtitle, rightText, session, printOrder }) {
  const dateStr = new Date().toLocaleDateString("en-PK", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
  const meta = rightText ? (
    <>
      {String(rightText)
        .split(" | ")
        .map((p, i) => (
          <div key={i} className={cn("text-xs text-muted-foreground", i === 0 && "font-semibold text-foreground")}>
            {p}
          </div>
        ))}
      {session ? <div className="mt-0.5 text-xs font-semibold text-muted-foreground">Session: {session}</div> : null}
    </>
  ) : (
    <>
      {session ? <div className="text-xs font-semibold text-muted-foreground">Session: {session}</div> : null}
      <div className="text-xs text-muted-foreground">Date: {dateStr}</div>
      <div className="text-xs text-muted-foreground">Time: {timeStr}</div>
    </>
  );

  if (printOrder) {
    return (
      <Card size="sm" className="print-header-universal mb-3.5 shadow-none">
        <CardContent className="flex flex-wrap items-center gap-5 py-3.5">
          <img
            src={schoolOrBrandLogo(settings.logo)}
            className="size-28 shrink-0 rounded-lg border object-cover"
            alt="School logo"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-bold tracking-wide text-primary">
              {settings.schoolName || "School Name"}
            </div>
            {subtitle ? <div className="mt-1 text-sm font-semibold text-muted-foreground">{subtitle}</div> : null}
          </div>
          <div className="text-right leading-snug">{meta}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm" className="print-header-universal mb-2.5 shadow-none">
      <CardContent className="flex items-center gap-3.5 py-2.5">
        <img
          src={schoolOrBrandLogo(settings.logo)}
          className="size-24 shrink-0 rounded-full object-cover"
          alt=""
        />
        <div className="min-w-0 flex-1 text-center">
          <div className="text-[15px] font-bold text-primary">{settings.schoolName}</div>
          {subtitle ? <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        <div className="text-right">{meta}</div>
      </CardContent>
    </Card>
  );
}
