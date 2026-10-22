import { cn } from "cn"

import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

function Task({ children, ...props }) {
  return (
    <Trace {...props}>
      <TraceCollapsible>{children}</TraceCollapsible>
    </Trace>
  )
}

function TaskTrigger({ title, className, children, ...props }) {
  return (
    <TraceCollapsibleTrigger className={className} {...props}>
      <TraceLine>
        <TraceTitle>{title ?? children}</TraceTitle>
      </TraceLine>
    </TraceCollapsibleTrigger>
  )
}

function TaskContent({ className, children, ...props }) {
  return (
    <TraceCollapsibleContent keepMounted className={className} {...props}>
      <Trace>{children}</Trace>
    </TraceCollapsibleContent>
  )
}

function TaskItem({ className, children, ...props }) {
  return (
    <TraceLine className={className} {...props}>
      <TraceTitle>{children}</TraceTitle>
    </TraceLine>
  )
}

function TaskItemFile({ className, children, ...props }) {
  return (
    <code className={cn("rounded bg-muted px-1 py-0.5 font-mono text-xs", className)} {...props}>
      {children}
    </code>
  )
}

export { Task, TaskTrigger, TaskContent, TaskItem, TaskItemFile }
