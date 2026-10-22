import * as React from "react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

function parseStack(trace = "") {
  return String(trace)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(?:at\s+)?(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/)
      return {
        raw: line,
        name: match?.[1] || "",
        file: match?.[2] || line,
        line: match?.[3],
        column: match?.[4],
        internal: /node_modules/.test(line),
      }
    })
}

const StackContext = React.createContext({ frames: [], onFilePathClick: undefined })

function StackTrace({ trace = "", open, defaultOpen, onOpenChange, onFilePathClick, children, ...props }) {
  const frames = React.useMemo(() => parseStack(trace), [trace])
  return (
    <StackContext.Provider value={{ frames, onFilePathClick, trace }}>
      <Trace {...props}>
        <TraceCollapsible open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
          {children}
        </TraceCollapsible>
      </Trace>
    </StackContext.Provider>
  )
}

function StackTraceHeader({ className, children, ...props }) {
  return (
    <div className="flex items-start gap-2">
      <TraceCollapsibleTrigger className={cn("min-w-0 flex-1", className)} {...props}>
        <TraceLine status="error">
          <TraceIcon />
          {children}
        </TraceLine>
      </TraceCollapsibleTrigger>
    </div>
  )
}

function StackTraceError({ className, children, ...props }) {
  return (
    <TraceTitle className={className} {...props}>
      {children}
    </TraceTitle>
  )
}

function StackTraceErrorType({ className, ...props }) {
  return <span className={cn("font-medium", className)} {...props} />
}

function StackTraceErrorMessage({ className, ...props }) {
  return <span className={className} {...props} />
}

function StackTraceActions({ className, ...props }) {
  return <div className={cn("flex items-center gap-1", className)} {...props} />
}

function StackTraceCopyButton({ ...props }) {
  const { trace } = React.useContext(StackContext)
  return (
    <Button
      type="button"
      size="xs"
      variant="outline"
      onClick={() => navigator.clipboard?.writeText(trace || "")}
      {...props}
    >
      Copy
    </Button>
  )
}

function StackTraceExpandButton() {
  return null
}

function StackTraceContent(props) {
  return <TraceCollapsibleContent {...props} />
}

function StackTraceFrames({ className, children }) {
  const { frames, onFilePathClick } = React.useContext(StackContext)
  return (
    <ol className={cn("m-0 list-none space-y-1 p-0 font-mono text-xs", className)}>
      {children ??
        frames.map((frame, index) => (
          <StackTraceFrame key={`${frame.raw}-${index}`} frame={frame} onFilePathClick={onFilePathClick} />
        ))}
    </ol>
  )
}

function StackTraceFrame({ frame, onFilePathClick }) {
  return (
    <li className={cn(frame.internal && "opacity-50")}>
      <button
        type="button"
        className="text-left hover:underline"
        onClick={() => onFilePathClick?.(frame.file, frame.line)}
      >
        {frame.raw}
      </button>
    </li>
  )
}

export {
  StackTrace,
  StackTraceHeader,
  StackTraceError,
  StackTraceErrorType,
  StackTraceErrorMessage,
  StackTraceActions,
  StackTraceCopyButton,
  StackTraceExpandButton,
  StackTraceContent,
  StackTraceFrames,
  StackTraceFrame,
}
