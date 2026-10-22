import * as React from "react"
import { ArrowUpIcon, LoaderCircleIcon, PlusIcon, SquareIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { Attachment, AttachmentContent, AttachmentTitle } from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"

const PromptContext = React.createContext(null)

function PromptInput({ onSubmit, className, children, ...props }) {
  const [attachments, setAttachments] = React.useState([])
  const value = React.useMemo(
    () => ({
      attachments,
      addAttachment: (file) => setAttachments((prev) => [...prev, file]),
      removeAttachment: (index) => setAttachments((prev) => prev.filter((_, i) => i !== index)),
    }),
    [attachments]
  )
  return (
    <PromptContext.Provider value={value}>
      <form
        className={cn("w-full", className)}
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          onSubmit?.({ text: String(data.get("message") || ""), attachments, event })
        }}
        {...props}
      >
        <InputGroup>{children}</InputGroup>
      </form>
    </PromptContext.Provider>
  )
}

function PromptInputTextarea({ className, name = "message", ...props }) {
  return <InputGroupTextarea name={name} className={cn("min-h-14 p-3", className)} {...props} />
}

function PromptInputHeader({ className, children, ...props }) {
  const ctx = React.useContext(PromptContext)
  return (
    <InputGroupAddon align="block-start" className={cn("flex flex-wrap gap-2", className)} {...props}>
      {ctx?.attachments?.map((file, index) => (
        <Attachment key={`${file.name}-${index}`} size="sm">
          <AttachmentContent>
            <AttachmentTitle>{file.name}</AttachmentTitle>
          </AttachmentContent>
          <Button type="button" size="icon-xs" variant="ghost" aria-label="Remove attachment" onClick={() => ctx.removeAttachment(index)}>
            <XIcon />
          </Button>
        </Attachment>
      ))}
      {children}
    </InputGroupAddon>
  )
}

function PromptInputFooter({ className, ...props }) {
  return <InputGroupAddon align="block-end" className={cn("pt-1", className)} {...props} />
}

function PromptInputTools({ className, ...props }) {
  return <div className={cn("flex items-center gap-1", className)} {...props} />
}

function PromptInputButton(props) {
  return <InputGroupButton type="button" size="icon-sm" variant="outline" {...props} />
}

function PromptInputActionMenuTrigger({ children, ...props }) {
  return (
    <InputGroupButton type="button" size="icon-sm" variant="outline" className="rounded-full" aria-label="Add" {...props}>
      {children ?? <PlusIcon />}
    </InputGroupButton>
  )
}

function PromptInputSubmit({ status = "ready", className, children, ...props }) {
  const icon =
    status === "streaming" || status === "submitted" ? (
      status === "streaming" ? <SquareIcon /> : <LoaderCircleIcon className="animate-spin" />
    ) : (
      <ArrowUpIcon />
    )
  return (
    <InputGroupButton
      type="submit"
      size="icon-sm"
      variant="default"
      className={cn("ml-auto rounded-full", className)}
      {...props}
    >
      {children ?? icon}
      <span className="sr-only">Send</span>
    </InputGroupButton>
  )
}

function PromptInputSelect(props) {
  return <select className="bg-transparent text-sm outline-none" {...props} />
}

function PromptInputHoverCard({ children }) {
  return children
}

export {
  PromptInput,
  PromptInputTextarea,
  PromptInputHeader,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputActionMenuTrigger,
  PromptInputSubmit,
  PromptInputSelect,
  PromptInputHoverCard,
}
