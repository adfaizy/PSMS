import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Shared responsive shell for SMS module pages.
 * Uses installed shadcn Card / Tabs / Badge only — does not modify ui/* sources.
 */
export function ModulePageShell({
  title,
  description,
  tabs = [],
  tab,
  onTabChange,
  children,
  className,
  contentClassName,
  maxWidthClassName = "max-w-[1400px]",
  actions = null,
  /** When true, skip outer Card (print-heavy modules keep their own panels). */
  bareContent = false,
  hideTitle = false,
}) {
  const hasTabs = Array.isArray(tabs) && tabs.length > 0;

  return (
    <div
      className={cn(
        "psms-page module-page-shell mx-auto w-full min-w-0 space-y-4 pb-8",
        maxWidthClassName,
        className
      )}
    >
      {!hideTitle ? (
        <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 className="m-0 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h2>
            {description ? (
              typeof description === "string" ? (
                <p className="m-0 text-xs text-muted-foreground sm:text-sm">{description}</p>
              ) : (
                description
              )
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}

      {hasTabs ? (
        <Tabs value={tab} onValueChange={onTabChange} className="no-print w-full min-w-0">
          <div className="w-full overflow-x-auto">
            <TabsList className="inline-flex h-9 w-max max-w-none justify-start gap-1 bg-muted p-1">
              {tabs.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="shrink-0 px-3 text-xs sm:text-sm"
                >
                  {t.l}
                  {t.badge != null ? (
                    <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                      {t.badge}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      ) : null}

      {bareContent ? (
        <div className={cn("min-w-0", contentClassName)}>{children}</div>
      ) : (
        <Card size="sm" className={cn("min-w-0 shadow-none", contentClassName)}>
          <CardContent className="min-w-0 pt-(--card-spacing)">{children}</CardContent>
        </Card>
      )}
    </div>
  );
}

export function ModuleSection({ title, description, children, className, action }) {
  return (
    <Card size="sm" className={cn("min-w-0 shadow-none", className)}>
      {(title || description || action) && (
        <CardHeader className="border-b">
          {title ? <CardTitle>{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
          {action || null}
        </CardHeader>
      )}
      <CardContent className={cn("min-w-0", title || description ? "pt-(--card-spacing)" : undefined)}>
        {children}
      </CardContent>
    </Card>
  );
}
