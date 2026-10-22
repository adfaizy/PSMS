import * as React from "react"
import { BrainIcon, LoaderCircleIcon } from "lucide-react"

import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

const ReasoningContext = React.createContext(null)

function useReasoning() {
  const value = React.useContext(ReasoningContext)
  if (!value) throw new Error("Reasoning parts must be used inside Reasoning")
  return value
}

function Reasoning({
  isStreaming = false,
  open,
  defaultOpen,
  onOpenChange,
  duration,
  children,
  ...props
}) {
  const [userOpen, setUserOpen] = React.useState(undefined)
  const resolvedOpen = open ?? userOpen ?? isStreaming

  return (
    <ReasoningContext.Provider value={{ isStreaming, duration }}>
      <Trace {...props}>
        <TraceCollapsible
          open={resolvedOpen}
          defaultOpen={defaultOpen}
          onOpenChange={(next) => {
            setUserOpen(next)
            onOpenChange?.(next)
          }}
        >
          {children}
        </TraceCollapsible>
      </Trace>
    </ReasoningContext.Provider>
  )
}

function ReasoningTrigger({ className, children, ...props }) {
  const { isStreaming, duration } = useReasoning()
  const title = children ?? (isStreaming ? "Thinking" : duration != null ? `Thought for ${duration}s` : "Thought")
  return (
    <TraceCollapsibleTrigger className={className} {...props}>
      <TraceLine status={isStreaming ? "running" : undefined}>
        <TraceIcon>
          {isStreaming ? <LoaderCircleIcon className="animate-spin" /> : <BrainIcon />}
        </TraceIcon>
        <TraceTitle>{title}</TraceTitle>
      </TraceLine>
    </TraceCollapsibleTrigger>
  )
}

function ReasoningContent({ className, children, ...props }) {
  return (
    <TraceCollapsibleContent className={className} {...props}>
      {children}
    </TraceCollapsibleContent>
  )
}

export { Reasoning, ReasoningTrigger, ReasoningContent }
