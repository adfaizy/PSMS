export const PHONE_E164 = '923089640258'
export const PHONE_DISPLAY = '+92 308 9640258'
export const SUPPORT_EMAIL = 'adfaizy1976@gmail.com'
export const DISCUSSION_STORAGE_KEY = 'sms_about_discussion_messages_v1'
export const MAX_BODY_LEN = 4000

const DEFAULT_INQUIRY_INTRO =
  'Hello,\n\nI would like information regarding:\n- Sales / licensing\n- Purchase / subscription\n- Operation & documentation\n- Other\n\n'

export const WHATSAPP_HREF = `https://wa.me/${PHONE_E164}?text=${encodeURIComponent(DEFAULT_INQUIRY_INTRO)}`
export const TEL_HREF = `tel:+${PHONE_E164}`
export const MAILTO_HREF = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('PSMS - Punjab School Management System - inquiry')}&body=${encodeURIComponent(DEFAULT_INQUIRY_INTRO)}`

function getStorage(storageOverride) {
  if (storageOverride) return storageOverride
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function formatChatTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleString('en-PK', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function loadDiscussionMessages(storageOverride) {
  try {
    const storage = getStorage(storageOverride)
    if (!storage) return []
    const raw = storage.getItem(DISCUSSION_STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((m) => m && typeof m.id === 'string' && typeof m.body === 'string') : []
  } catch {
    return []
  }
}

export function saveDiscussionMessages(messages, storageOverride) {
  try {
    const storage = getStorage(storageOverride)
    if (!storage) return
    storage.setItem(DISCUSSION_STORAGE_KEY, JSON.stringify(Array.isArray(messages) ? messages : []))
  } catch {
    // ignore quota errors
  }
}

export function createDiscussionMessage({ role = 'client', authorName = 'Guest', body, parentId = null }) {
  const text = String(body || '').trim().slice(0, MAX_BODY_LEN)
  if (!text) return null
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    parentId,
    role,
    authorName: String(authorName || '').trim().slice(0, 80) || (role === 'owner' ? 'Support' : 'Guest'),
    body: text,
    createdAt: Date.now(),
  }
}
