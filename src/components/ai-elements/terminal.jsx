import * as React from "react"
import { TerminalIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CodeBlock, CodeBlockContent, CodeBlockCopyButton } from "@/components/ui/code-block"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

function Terminal({
  output = "",
  isStreaming = false,
  command,
  onClear,
  children,
  ...props
}) {
  const [open, setOpen] = React.useState(false)
  const hasOutput = String(output || "").length > 0
  React.useEffect(() => {
    if (isStreaming && hasOutput) setOpen(true)
  }, [isStreaming, hasOutput])

  return (
    <Trace {...props}>
      <div className="flex items-start gap-2">
        <TraceCollapsible open={open} onOpenChange={setOpen} className="min-w-0 flex-1">
          <TraceCollapsibleTrigger>
            <TraceLine status={isStreaming ? "running" : undefined}>
              <TerminalTitle>{command ? `${isStreaming ? "Running" : "Ran"} ${command}` : "Terminal"}</TerminalTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TerminalContent>{children ?? output}</TerminalContent>
        </TraceCollapsible>
        <TerminalActions>
          {onClear ? (
            <Button type="button" size="icon-xs" variant="ghost" aria-label="Clear terminal" onClick={onClear}>
              <Trash2Icon />
            </Button>
          ) : null}
        </TerminalActions>
      </div>
    </Trace>
  )
}

function TerminalHeader({ className, children, ...props }) {
  return (
    <TraceCollapsibleTrigger className={className} {...props}>
      <TraceLine>{children}</TraceLine>
    </TraceCollapsibleTrigger>
  )
}

function TerminalTitle({ className, children, ...props }) {
  return (
    <>
      <TraceIcon>
        <TerminalIcon />
      </TraceIcon>
      <TraceTitle className={className} {...props}>
        {children}
      </TraceTitle>
    </>
  )
}

function TerminalActions({ className, ...props }) {
  return <div className={className} {...props} />
}

function TerminalCopyButton(props) {
  return <CodeBlockCopyButton {...props} />
}

function TerminalContent({ children, className }) {
  return (
    <TraceCollapsibleContent>
      <CodeBlock size="sm" className={className}>
        <CodeBlockContent wrap className="max-h-64">
          {children}
        </CodeBlockContent>
      </CodeBlock>
    </TraceCollapsibleContent>
  )
}

export { Terminal, TerminalHeader, TerminalTitle, TerminalActions, TerminalCopyButton, TerminalContent }
