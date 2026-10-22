import * as React from "react"

import { Button } from "@/components/ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Progress } from "@/components/ui/progress"

const ContextState = React.createContext(null)

function Context({ usedTokens = 0, maxTokens = 0, usage, modelId, children, ...props }) {
  const percent = maxTokens > 0 ? Math.min(100, Math.round((usedTokens / maxTokens) * 100)) : 0
  return (
    <ContextState.Provider value={{ usedTokens, maxTokens, usage, modelId, percent }}>
      <HoverCard {...props}>{children}</HoverCard>
    </ContextState.Provider>
  )
}

function useContextUsage() {
  const value = React.useContext(ContextState)
  if (!value) throw new Error("Context parts must be used inside Context")
  return value
}

function ContextTrigger({ className, children, ...props }) {
  const { percent } = useContextUsage()
  return (
    <HoverCardTrigger
      delay={200}
      closeDelay={100}
      render={<Button variant="outline" size="sm" className={className} {...props} />}
    >
      {children ?? `${percent}%`}
    </HoverCardTrigger>
  )
}

function ContextContent(props) {
  return <HoverCardContent {...props} />
}

function ContextContentHeader({ className, ...props }) {
  const { usedTokens, maxTokens, percent } = useContextUsage()
  return (
    <div className={className} {...props}>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span>{usedTokens.toLocaleString()} used</span>
        <span className="text-muted-foreground">{maxTokens.toLocaleString()} max</span>
      </div>
      <Progress value={percent} aria-label="Context used" />
    </div>
  )
}

function ContextContentBody({ className, ...props }) {
  return <div className={className} {...props} />
}

function ContextContentFooter({ className, ...props }) {
  const { modelId } = useContextUsage()
  return (
    <div className={className} {...props}>
      {props.children ?? modelId}
    </div>
  )
}

function UsageLine({ label, value }) {
  if (value == null) return null
  return (
    <div className="flex justify-between gap-4 text-xs text-muted-foreground">
      <span>{label}</span>
      <span>{Number(value).toLocaleString()}</span>
    </div>
  )
}

function ContextInputUsage() {
  const { usage } = useContextUsage()
  return <UsageLine label="Input" value={usage?.inputTokens} />
}
function ContextOutputUsage() {
  const { usage } = useContextUsage()
  return <UsageLine label="Output" value={usage?.outputTokens} />
}
function ContextReasoningUsage() {
  const { usage } = useContextUsage()
  return <UsageLine label="Reasoning" value={usage?.reasoningTokens} />
}
function ContextCacheUsage() {
  const { usage } = useContextUsage()
  return <UsageLine label="Cache" value={usage?.cachedTokens} />
}

export {
  Context,
  ContextTrigger,
  ContextContent,
  ContextContentHeader,
  ContextContentBody,
  ContextContentFooter,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextCacheUsage,
}
