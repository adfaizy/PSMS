import * as React from "react"
import { cn } from "cn"

import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

const PlanContext = React.createContext({ isStreaming: false })

function Plan({ isStreaming = false, open, defaultOpen, onOpenChange, children, ...props }) {
  return (
    <PlanContext.Provider value={{ isStreaming }}>
      <Trace {...props}>
        <TraceCollapsible open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
          {children}
        </TraceCollapsible>
      </Trace>
    </PlanContext.Provider>
  )
}

function PlanHeader({ className, children, ...props }) {
  const { isStreaming } = React.useContext(PlanContext)
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <TraceCollapsibleTrigger className="min-w-0 flex-1" {...props}>
        <TraceLine status={isStreaming ? "running" : undefined}>{children}</TraceLine>
      </TraceCollapsibleTrigger>
    </div>
  )
}

function PlanTitle({ className, children, ...props }) {
  return (
    <TraceTitle className={className} {...props}>
      {children}
    </TraceTitle>
  )
}

function PlanDescription({ className, children, ...props }) {
  return (
    <TraceDescription className={className} {...props}>
      {children}
    </TraceDescription>
  )
}

function PlanTrigger({ children }) {
  return children
}

function PlanAction({ className, ...props }) {
  return <div className={cn("shrink-0", className)} {...props} />
}

function PlanContent({ className, children, ...props }) {
  return (
    <TraceCollapsibleContent className={className} {...props}>
      <Trace>{children}</Trace>
    </TraceCollapsibleContent>
  )
}

function PlanFooter({ className, ...props }) {
  return <div className={cn("flex items-center gap-2 px-1 text-sm text-muted-foreground", className)} {...props} />
}

export { Plan, PlanHeader, PlanTitle, PlanDescription, PlanTrigger, PlanAction, PlanContent, PlanFooter }
