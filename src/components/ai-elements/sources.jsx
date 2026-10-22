import { LinkIcon } from "lucide-react"

import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"

function Sources({ children, ...props }) {
  return (
    <Trace {...props}>
      <TraceCollapsible>{children}</TraceCollapsible>
    </Trace>
  )
}

function SourcesTrigger({ count, className, children, ...props }) {
  return (
    <TraceCollapsibleTrigger className={className} {...props}>
      <TraceLine>
        <TraceIcon>
          <LinkIcon />
        </TraceIcon>
        <TraceTitle>{children ?? `Used ${count ?? 0} sources`}</TraceTitle>
      </TraceLine>
    </TraceCollapsibleTrigger>
  )
}

function SourcesContent({ children, ...props }) {
  return (
    <TraceCollapsibleContent {...props}>
      <Trace>{children}</Trace>
    </TraceCollapsibleContent>
  )
}

function Source({ href, title, children, ...props }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" {...props}>
      <TraceLine>
        <TraceIcon>
          <LinkIcon />
        </TraceIcon>
        <TraceTitle>
          {title ?? children}
          <span className="sr-only"> (opens in a new tab)</span>
        </TraceTitle>
      </TraceLine>
    </a>
  )
}

export { Sources, SourcesTrigger, SourcesContent, Source }
