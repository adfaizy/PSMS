function messageText(message) {
  if (typeof message?.content === "string") return message.content
  if (typeof message?.text === "string") return message.text
  if (Array.isArray(message?.parts)) {
    return message.parts
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text)
      .join("\n")
  }
  return ""
}

export function messagesToMarkdown(messages = []) {
  return messages
    .map((message) => {
      const role = message.role === "user" ? "User" : "Assistant"
      return `**${role}:** ${messageText(message)}`
    })
    .join("\n\n")
}
