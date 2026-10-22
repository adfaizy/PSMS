import { MessageCircleDashedIcon } from "lucide-react"
import { cn } from "cn"

import { messagesToMarkdown } from "./messages-markdown.js"

import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

function Conversation({ className, children, ...props }) {
  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller className={cn("relative flex h-full min-h-0 flex-col", className)} {...props}>
        {children}
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

function ConversationContent({ className, children, ...props }) {
  return (
    <MessageScrollerViewport>
      <MessageScrollerContent className={cn("gap-6", className)} {...props}>
        {children}
      </MessageScrollerContent>
    </MessageScrollerViewport>
  )
}

function ConversationScrollButton(props) {
  return <MessageScrollerButton {...props} />
}

function ConversationEmptyState({
  title = "What should we work on?",
  description = "Ask a question to start.",
  icon,
  children,
  className,
}) {
  return (
    <Empty className={cn("h-full", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon ?? <MessageCircleDashedIcon />}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children}
    </Empty>
  )
}

function ConversationDownload({ messages = [], filename = "conversation.md", children = "Download", ...props }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        const blob = new Blob([messagesToMarkdown(messages)], { type: "text/markdown" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = filename
        link.click()
        URL.revokeObjectURL(url)
      }}
      {...props}
    >
      {children}
    </Button>
  )
}

export {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationEmptyState,
  ConversationDownload,
}
