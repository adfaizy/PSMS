import { WrenchIcon } from "lucide-react"

import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

function titleFor(state, name) {
  if (state === "output-available") return `Ran ${name}`
  if (state === "output-error") return `Failed to run ${name}`
  if (state === "output-denied") return `Denied ${name}`
  return `Running ${name}`
}

function statusFor(state) {
  if (state === "output-error" || state === "output-denied") return "error"
  if (state === "output-available") return undefined
  return "running"
}

function Tool({ children, ...props }) {
  return (
    <Trace {...props}>
      <TraceCollapsible>{children}</TraceCollapsible>
    </Trace>
  )
}

function ToolHeader({ state = "input-streaming", name = "tool", type, className, ...props }) {
  const label = name || String(type || "tool").replace(/^tool-/, "")
  return (
    <TraceCollapsibleTrigger className={className} {...props}>
      <TraceLine status={statusFor(state)}>
        <TraceIcon>
          <WrenchIcon />
        </TraceIcon>
        <TraceTitle>{titleFor(state, label)}</TraceTitle>
      </TraceLine>
    </TraceCollapsibleTrigger>
  )
}

function ToolContent({ className, children, ...props }) {
  return (
    <TraceCollapsibleContent className={className} {...props}>
      {children}
    </TraceCollapsibleContent>
  )
}

function ToolInput({ input, className, children }) {
  const text = children ?? (typeof input === "string" ? input : JSON.stringify(input, null, 2))
  return (
    <CodeBlock size="sm" className={className}>
      <CodeBlockContent wrap className="max-h-64">
        {text}
      </CodeBlockContent>
    </CodeBlock>
  )
}

function ToolOutput({ output, errorText, className, children }) {
  const text = children ?? errorText ?? (typeof output === "string" ? output : JSON.stringify(output, null, 2))
  return (
    <CodeBlock size="sm" className={className}>
      <CodeBlockContent wrap className="max-h-64">
        {text}
      </CodeBlockContent>
    </CodeBlock>
  )
}

function ToolPart({ part }) {
  return (
    <Tool>
      <ToolHeader state={part?.state} name={part?.toolName || part?.type} />
      <ToolContent>
        {part?.input != null ? <ToolInput input={part.input} /> : null}
        {part?.output != null || part?.errorText ? (
          <ToolOutput output={part.output} errorText={part.errorText} />
        ) : null}
      </ToolContent>
    </Tool>
  )
}

export { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput, ToolPart }
