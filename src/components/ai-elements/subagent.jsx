import { BotIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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

function Agent({ children, ...props }) {
  return (
    <Trace {...props}>
      <TraceCollapsible>{children}</TraceCollapsible>
    </Trace>
  )
}

function AgentHeader({ name = "agent", model, className, children, ...props }) {
  return (
    <TraceCollapsibleTrigger className={className} {...props}>
      <TraceLine>
        <TraceIcon>
          <BotIcon />
        </TraceIcon>
        <TraceTitle>{children ?? `Ran the ${name} agent`}</TraceTitle>
        {model ? <Badge variant="secondary">{model}</Badge> : null}
      </TraceLine>
    </TraceCollapsibleTrigger>
  )
}

function AgentContent({ className, children, ...props }) {
  return (
    <TraceCollapsibleContent keepMounted className={className} {...props}>
      {children}
    </TraceCollapsibleContent>
  )
}

function AgentInstructions({ className, ...props }) {
  return <p className={className} {...props} />
}

function AgentTools({ children, ...props }) {
  return <Trace {...props}>{children}</Trace>
}

function AgentTool({ name, children, ...props }) {
  return (
    <TraceLine {...props}>
      <TraceTitle>{name ?? children}</TraceTitle>
    </TraceLine>
  )
}

function AgentOutput({ children, output, className }) {
  return (
    <CodeBlock size="sm" className={className}>
      <CodeBlockContent wrap className="max-h-64">
        {children ?? output}
      </CodeBlockContent>
    </CodeBlock>
  )
}

export { Agent, AgentHeader, AgentContent, AgentInstructions, AgentTools, AgentTool, AgentOutput }
