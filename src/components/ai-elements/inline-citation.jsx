import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"

function InlineCitation({ className, ...props }) {
  return <span className={cn("inline", className)} {...props} />
}

function InlineCitationText({ className, ...props }) {
  return <span className={className} {...props} />
}

function InlineCitationCard(props) {
  return <HoverCard {...props} />
}

function InlineCitationCardTrigger({ className, children, ...props }) {
  return (
    <HoverCardTrigger
      delay={200}
      closeDelay={100}
      render={<Button variant="secondary" size="xs" className={cn("mx-0.5 h-5 px-1.5", className)} {...props} />}
    >
      {children}
    </HoverCardTrigger>
  )
}

function InlineCitationCardBody(props) {
  return <HoverCardContent className="w-80" {...props} />
}

function InlineCitationSource({ title, url, href, children, ...props }) {
  const link = url || href
  return (
    <div {...props}>
      <a href={link} target="_blank" rel="noreferrer" className="font-medium underline-offset-4 hover:underline">
        {title ?? children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  )
}

function InlineCitationQuote({ className, ...props }) {
  return <blockquote className={cn("mt-2 border-l-2 pl-3 text-sm text-muted-foreground", className)} {...props} />
}

function InlineCitationCarousel({ className, ...props }) {
  return <div className={cn("flex gap-2 overflow-x-auto", className)} {...props} />
}

function InlineCitationCarouselContent(props) {
  return <div {...props} />
}

function InlineCitationCarouselItem({ className, ...props }) {
  return <div className={cn("min-w-0 shrink-0", className)} {...props} />
}

export {
  InlineCitation,
  InlineCitationText,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationSource,
  InlineCitationQuote,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
}
