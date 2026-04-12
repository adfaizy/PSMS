export const LAST_RESORT_THUMBNAIL = 'https://placehold.co/320x420/e2e8f0/334155?text=Book'

export function normalize(text) {
  return String(text || '').toLowerCase().trim()
}

export function getThumbnailCandidates(book) {
  const candidates = []
  if (Array.isArray(book?.thumbnailCandidates)) candidates.push(...book.thumbnailCandidates)
  if (book?.thumbnail) candidates.push(book.thumbnail)
  if (book?.cover) candidates.push(book.cover)
  return [...new Set(candidates.filter(Boolean))]
}

export function getVisibleBooks(currentClass, query) {
  if (!currentClass) return []
  const books = Array.isArray(currentClass.books) ? currentClass.books : []
  const q = normalize(query)
  if (!q) return books
  return books.filter((book) => normalize(book.title).includes(q))
}

export function getRenderedBooks(visibleBooks, visibleCount) {
  const list = Array.isArray(visibleBooks) ? visibleBooks : []
  return list.slice(0, Math.max(0, Number(visibleCount) || 0))
}

export function getCurrentClass(classes, activeClass) {
  const list = Array.isArray(classes) ? classes : []
  return list.find((item) => item.className === activeClass) || null
}
