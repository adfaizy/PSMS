import * as React from "react"

import { Button } from "@/components/ui/button"
import { Item, ItemActions, ItemContent, ItemTitle } from "@/components/ui/item"

const ConfirmationContext = React.createContext({ state: "request", approval: null })

function Confirmation({ approval, state = "request", children, ...props }) {
  return (
    <ConfirmationContext.Provider value={{ approval, state }}>
      <Item variant="outline" size="sm" {...props}>
        {children}
      </Item>
    </ConfirmationContext.Provider>
  )
}

function useConfirmation() {
  return React.useContext(ConfirmationContext)
}

function ConfirmationTitle({ children, ...props }) {
  return (
    <ItemContent {...props}>
      <ItemTitle>{children}</ItemTitle>
    </ItemContent>
  )
}

function ConfirmationRequest({ children }) {
  const { state } = useConfirmation()
  if (state !== "request" && state !== "approval-requested") return null
  return children
}

function ConfirmationAccepted({ children }) {
  const { state } = useConfirmation()
  if (state !== "accepted" && state !== "approval-responded") return null
  return children
}

function ConfirmationRejected({ children }) {
  const { state } = useConfirmation()
  if (state !== "rejected" && state !== "output-denied") return null
  return children
}

function ConfirmationActions(props) {
  return <ItemActions {...props} />
}

function ConfirmationAction({ children, ...props }) {
  return (
    <Button type="button" size="sm" {...props}>
      {children}
    </Button>
  )
}

export {
  Confirmation,
  ConfirmationTitle,
  ConfirmationRequest,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationActions,
  ConfirmationAction,
}
