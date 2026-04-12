// ─── Password hashing ─────────────────────────────────────────────────────────
/** SHA-256 hash a password. Returns hex string. */
export async function hashPassword(password) {
  if (!password) return "";
  try {
    const data = new TextEncoder().encode(String(password));
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return String(password);
  }
}

/** Verify a password against a stored value (supports hashed + legacy plain text). */
export async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (stored.length === 64 && /^[0-9a-f]+$/.test(stored)) {
    return (await hashPassword(password)) === stored;
  }
  return String(password) === String(stored);
}
