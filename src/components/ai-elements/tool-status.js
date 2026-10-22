export function getStatusBadge(state) {
  if (state === "output-error" || state === "output-denied") return "destructive"
  if (state === "output-available") return "secondary"
  return "outline"
}
