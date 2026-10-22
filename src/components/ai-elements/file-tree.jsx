import * as React from "react"
import { ChevronRightIcon, FileIcon, FolderIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

const FileTreeContext = React.createContext({
  selected: "",
  onSelect: () => {},
  expanded: {},
  toggle: () => {},
})

function FileTree({ expanded, selected = "", onSelect, className, children, ...props }) {
  const [open, setOpen] = React.useState(expanded || {})
  const value = React.useMemo(
    () => ({
      selected,
      onSelect: onSelect || (() => {}),
      expanded: expanded || open,
      toggle: (path) => setOpen((prev) => ({ ...prev, [path]: !prev[path] })),
    }),
    [expanded, open, onSelect, selected]
  )
  return (
    <FileTreeContext.Provider value={value}>
      <div className={cn("flex flex-col text-sm", className)} {...props}>
        {children}
      </div>
    </FileTreeContext.Provider>
  )
}

function FileTreeFolder({ path, name, defaultOpen = false, className, children }) {
  const tree = React.useContext(FileTreeContext)
  const isOpen = tree.expanded[path] ?? defaultOpen
  return (
    <Collapsible open={isOpen} onOpenChange={() => tree.toggle(path)} className={className}>
      <CollapsibleTrigger
        render={<Button variant="ghost" size="sm" className="w-full justify-start" />}
      >
        <ChevronRightIcon className={cn("transition-transform", isOpen && "rotate-90")} />
        <FileTreeIcon>
          <FolderIcon />
        </FileTreeIcon>
        <FileTreeName>{name || path}</FileTreeName>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-4 border-l pl-2">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function FileTreeFile({ path, name, icon, className, children }) {
  const tree = React.useContext(FileTreeContext)
  const actions = []
  const rest = []
  React.Children.forEach(children, (child) => {
    if (child?.type === FileTreeActions) actions.push(child)
    else rest.push(child)
  })
  return (
    <div className={cn("flex items-center", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("min-w-0 flex-1 justify-start", tree.selected === path && "bg-muted")}
        onClick={() => tree.onSelect(path)}
      >
        <FileTreeIcon>{icon || <FileIcon />}</FileTreeIcon>
        <FileTreeName>{name || rest || path}</FileTreeName>
      </Button>
      {actions}
    </div>
  )
}

function FileTreeIcon({ className, ...props }) {
  return <span className={cn("flex size-4 shrink-0 items-center justify-center", className)} {...props} />
}

function FileTreeName({ className, ...props }) {
  return <span className={cn("truncate", className)} {...props} />
}

function FileTreeActions({ className, ...props }) {
  return <span className={cn("ml-auto flex items-center", className)} {...props} />
}

export { FileTree, FileTreeFolder, FileTreeFile, FileTreeIcon, FileTreeName, FileTreeActions }
