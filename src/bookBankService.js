import ptbbFallbackData from "./ptbbFallback.json";

const PTBB_CACHE_KEY = "ptbb:books:cache:v1";

function readCachedClasses() {
  try {
    const raw = localStorage.getItem(PTBB_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.classes) ? parsed.classes : [];
  } catch {
    return [];
  }
}

function writeCachedClasses(classes) {
  if (!Array.isArray(classes) || classes.length === 0) return;
  try {
    localStorage.setItem(
      PTBB_CACHE_KEY,
      JSON.stringify({ classes, updatedAt: Date.now() }),
    );
  } catch {
    // Ignore storage quota/private mode failures.
  }
}

export async function fetchPtbbBooks() {
  const bundled = Array.isArray(ptbbFallbackData?.classes) ? ptbbFallbackData.classes : [];
  if (bundled.length > 0) {
    writeCachedClasses(bundled);
    return bundled;
  }

  const cached = readCachedClasses();
  if (cached.length > 0) return cached;

  throw new Error("Could not load PTBB books right now. Please try again later.");
}
