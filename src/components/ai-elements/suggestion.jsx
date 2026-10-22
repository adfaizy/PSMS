import { cn } from "cn"

import { Button } from "@/components/ui/button"

function Suggestions({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...props}
    />
  )
}

function Suggestion({ suggestion, onClick, className, children, ...props }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("shrink-0", className)}
      onClick={(event) => onClick?.(suggestion ?? children, event)}
      {...props}
    >
      {children ?? suggestion}
    </Button>
  )
}

export { Suggestions, Suggestion }
