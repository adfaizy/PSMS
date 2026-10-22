import { cn } from "cn"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function ModelSelector(props) {
  return <DropdownMenu {...props} />
}

function ModelSelectorTrigger(props) {
  return <DropdownMenuTrigger {...props} />
}

function ModelSelectorContent({ className, ...props }) {
  return <DropdownMenuContent className={cn("w-64", className)} {...props} />
}

function ModelSelectorInput(props) {
  return <input className="w-full bg-transparent px-2 py-1.5 text-sm outline-none" {...props} />
}

function ModelSelectorList({ value, onValueChange, ...props }) {
  return <DropdownMenuRadioGroup value={value} onValueChange={onValueChange} {...props} />
}

function ModelSelectorEmpty({ children = "No models", ...props }) {
  return (
    <div className="px-2 py-1.5 text-sm text-muted-foreground" {...props}>
      {children}
    </div>
  )
}

function ModelSelectorGroup({ heading, children, ...props }) {
  return (
    <DropdownMenuGroup {...props}>
      {heading ? <DropdownMenuLabel>{heading}</DropdownMenuLabel> : null}
      {children}
    </DropdownMenuGroup>
  )
}

function ModelSelectorItem({ value, children, ...props }) {
  return (
    <DropdownMenuRadioItem value={value} closeOnClick {...props}>
      {children}
    </DropdownMenuRadioItem>
  )
}

function ModelSelectorSeparator(props) {
  return <DropdownMenuSeparator {...props} />
}

function ModelSelectorShortcut(props) {
  return <DropdownMenuShortcut {...props} />
}

function ModelSelectorLogo({ className, alt = "", ...props }) {
  return <img alt={alt} className={cn("size-4 rounded-sm", className)} {...props} />
}

function ModelSelectorLogoGroup({ className, ...props }) {
  return <span className={cn("flex -space-x-1", className)} {...props} />
}

function ModelSelectorName({ className, ...props }) {
  return <span className={cn("truncate", className)} {...props} />
}

function ModelSelectorDialog(props) {
  return <DropdownMenu {...props} />
}

export {
  ModelSelector,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorSeparator,
  ModelSelectorShortcut,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorDialog,
}
