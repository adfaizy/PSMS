import * as React from "react"
import { cn } from "cn"

import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  Message as MessageRoot,
  MessageContent as MessageBody,
  MessageFooter,
} from "@/components/ui/message"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const MessageContext = React.createContext({ from: "assistant" })

function Message({ from = "assistant", className, children, ...props }) {
  return (
    <MessageContext.Provider value={{ from }}>
      <MessageRoot align={from === "user" ? "end" : "start"} className={className} {...props}>
        {children}
      </MessageRoot>
    </MessageContext.Provider>
  )
}

function MessageContent({ className, children, ...props }) {
  const { from } = React.useContext(MessageContext)
  if (from === "user") {
    return (
      <MessageBody className={className} {...props}>
        <Bubble align="end" variant="muted">
          <BubbleContent>{children}</BubbleContent>
        </Bubble>
      </MessageBody>
    )
  }
  return (
    <MessageBody className={className} {...props}>
      {children}
    </MessageBody>
  )
}

function MessageResponse({ className, children, ...props }) {
  return (
    <div className={cn("whitespace-pre-wrap", className)} {...props}>
      {children}
    </div>
  )
}

function MessageActions(props) {
  return <MessageFooter {...props} />
}

function MessageAction({ label, tooltip, className, children, ...props }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label || tooltip}
            className={className}
            {...props}
          />
        }
      >
        {children}
      </TooltipTrigger>
      {tooltip || label ? <TooltipContent>{tooltip || label}</TooltipContent> : null}
    </Tooltip>
  )
}

function MessageToolbar({ className, ...props }) {
  return <div className={cn("flex items-center gap-1", className)} {...props} />
}

export { Message, MessageContent, MessageResponse, MessageActions, MessageAction, MessageToolbar }
