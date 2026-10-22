import * as React from "react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

function ChainOfThought({ open, defaultOpen, onOpenChange, className, children, ...props }) {
  return (
    <Trace className={className} {...props}>
      <TraceCollapsible open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        {children}
      </TraceCollapsible>
    </Trace>
  )
}

function ChainOfThoughtHeader({ icon, className, children, ...props }) {
  return (
    <TraceCollapsibleTrigger className={className} {...props}>
      <TraceLine>
        {icon ? <TraceIcon>{icon}</TraceIcon> : null}
        <TraceTitle>{children}</TraceTitle>
      </TraceLine>
    </TraceCollapsibleTrigger>
  )
}

function ChainOfThoughtContent({ className, children, ...props }) {
  return (
    <TraceCollapsibleContent keepMounted className={className} {...props}>
      <Trace>{children}</Trace>
    </TraceCollapsibleContent>
  )
}

const STATUS = { active: "running", pending: "pending", complete: undefined }

function ChainOfThoughtStep({ status, icon, label, description, className, children, ...props }) {
  return (
    <TraceLine status={STATUS[status] ?? status} className={className} {...props}>
      {icon ? <TraceIcon>{icon}</TraceIcon> : null}
      {label ? <TraceTitle>{label}</TraceTitle> : null}
      {description ? <TraceDescription>{description}</TraceDescription> : null}
      {children}
    </TraceLine>
  )
}

function ChainOfThoughtSearchResults({ className, ...props }) {
  return <div className={cn("flex flex-wrap gap-1.5", className)} {...props} />
}

function ChainOfThoughtSearchResult({ className, children, ...props }) {
  return (
    <Badge variant="secondary" className={className} {...props}>
      {children}
    </Badge>
  )
}

function ChainOfThoughtImage({ className, alt = "", ...props }) {
  return <img alt={alt} className={cn("max-w-full rounded-md border", className)} {...props} />
}

export {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
  ChainOfThoughtSearchResults,
  ChainOfThoughtSearchResult,
  ChainOfThoughtImage,
}
