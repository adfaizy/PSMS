import { cn } from "cn"

import { Button } from "@/components/ui/button"
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

function Queue({ children, ...props }) {
  return <Trace {...props}>{children}</Trace>
}

function QueueSection({ children, ...props }) {
  return <TraceCollapsible {...props}>{children}</TraceCollapsible>
}

function QueueSectionTrigger({ className, ...props }) {
  return <TraceCollapsibleTrigger className={className} {...props} />
}

function QueueSectionLabel({ icon, className, children, ...props }) {
  return (
    <TraceLine className={className} {...props}>
      {icon ? <TraceIcon>{icon}</TraceIcon> : null}
      <TraceTitle>{children}</TraceTitle>
    </TraceLine>
  )
}

function QueueSectionContent({ className, children, ...props }) {
  return (
    <TraceCollapsibleContent className={className} {...props}>
      {children}
    </TraceCollapsibleContent>
  )
}

function QueueList({ children, ...props }) {
  return <Trace {...props}>{children}</Trace>
}

function QueueItem({ className, children, ...props }) {
  return (
    <TraceLine className={className} {...props}>
      {children}
    </TraceLine>
  )
}

function QueueItemIndicator({ className, ...props }) {
  return <TraceIcon className={className} {...props} />
}

function QueueItemContent({ className, children, ...props }) {
  return (
    <TraceTitle className={className} {...props}>
      {children}
    </TraceTitle>
  )
}

function QueueItemDescription({ className, children, ...props }) {
  return (
    <TraceDescription className={className} {...props}>
      {children}
    </TraceDescription>
  )
}

function QueueItemActions({ className, ...props }) {
  return <span className={cn("ml-auto flex items-center gap-1", className)} {...props} />
}

function QueueItemAction({ className, ...props }) {
  return <Button type="button" variant="ghost" size="icon-xs" className={className} {...props} />
}

function QueueItemAttachment({ className, ...props }) {
  return <span className={cn("text-xs text-muted-foreground", className)} {...props} />
}

function QueueItemImage({ className, alt = "", ...props }) {
  return <img alt={alt} className={cn("size-8 rounded object-cover", className)} {...props} />
}

function QueueItemFile({ className, ...props }) {
  return <span className={cn("truncate font-mono text-xs", className)} {...props} />
}

export {
  Queue,
  QueueSection,
  QueueSectionTrigger,
  QueueSectionLabel,
  QueueSectionContent,
  QueueList,
  QueueItem,
  QueueItemIndicator,
  QueueItemContent,
  QueueItemDescription,
  QueueItemActions,
  QueueItemAction,
  QueueItemAttachment,
  QueueItemImage,
  QueueItemFile,
}
