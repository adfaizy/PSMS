import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

function Checkpoint({ className, children, ...props }) {
  return (
    <Marker variant="separator" className={className} {...props}>
      <MarkerContent className="inline-flex items-center gap-2">{children}</MarkerContent>
    </Marker>
  )
}

function CheckpointIcon({ className, ...props }) {
  return <MarkerIcon className={className} {...props} />
}

function CheckpointTrigger({ tooltip, className, children = "Restore", ...props }) {
  const button = (
    <Button size="xs" variant="outline" className={cn(className)} {...props}>
      {children}
    </Button>
  )
  if (!tooltip) return button
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export { Checkpoint, CheckpointIcon, CheckpointTrigger }
