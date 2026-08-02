/** Live Punjab School Education Department news helpers (client). */

const CACHE_KEY = "psms_punjab_edu_news_v1";
const CACHE_TTL_MS = 5 * 60 * 1000;
const REFRESH_MS = 10 * 60 * 1000;

const GOOGLE_NEWS_RSS =
  "https://news.google.com/rss/search?q=%22School+Education+Department%22+Punjab+Pakistan+OR+%22education+secretary%22+Punjab+schools&hl=en-PK&gl=PK&ceid=PK:en";

export const SED_OFFICIAL_URL = "https://schools.punjab.gov.pk/notifications";
export const NEWS_REFRESH_MS = REFRESH_MS;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.fetchedAt || !Array.isArray(parsed?.items)) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(payload) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...payload, fetchedAt: Date.now() }),
    );
  } catch {
    /* ignore quota */
  }
}

function decodeXml(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssXml(xml, limit = 8) {
  const items = [];
  const blocks = String(xml || "").match(/<item>[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    if (items.length >= limit) break;
    const title = decodeXml((block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "");
    const link = decodeXml((block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || "");
    const pubDate = decodeXml((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1] || "");
    const source = decodeXml((block.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1] || "News");
    if (!title || !link) continue;
    items.push({
      id: `news-${items.length}-${title.slice(0, 40)}`,
      title,
      link,
      source: source || "News",
      publishedAt: pubDate || null,
      kind: "news",
    });
  }
  return items;
}

async function fetchViaLocalApi() {
  const base = import.meta.env.BASE_URL || "/";
  const withSlash = base.endsWith("/") ? base : `${base}/`;
  const url = `${withSlash}api/punjab-edu-news`.replace(/([^:]\/)\/+/g, "$1");
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  if (!data?.ok || !Array.isArray(data.items) || !data.items.length) {
    throw new Error("Empty news payload");
  }
  return {
    items: data.items,
    updatedAt: data.updatedAt || new Date().toISOString(),
    officialUrl: data.officialUrl || SED_OFFICIAL_URL,
  };
}

async function fetchViaRss2Json() {
  const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(GOOGLE_NEWS_RSS)}`;
  const res = await fetch(api);
  if (!res.ok) throw new Error(`rss2json ${res.status}`);
  const data = await res.json();
  if (data.status !== "ok" || !Array.isArray(data.items)) throw new Error("rss2json failed");
  const items = data.items.slice(0, 8).map((it, i) => ({
    id: `rss-${i}-${String(it.title || "").slice(0, 40)}`,
    title: String(it.title || "").trim(),
    link: String(it.link || "").trim(),
    source: String(it.author || it.source || "News").trim() || "News",
    publishedAt: it.pubDate || null,
    kind: "news",
  })).filter((it) => it.title && it.link);
  if (!items.length) throw new Error("No RSS items");
  return {
    items,
    updatedAt: new Date().toISOString(),
    officialUrl: SED_OFFICIAL_URL,
  };
}

/** Last-resort: try reading RSS text via a public CORS bridge if local API is down. */
async function fetchViaCorsBridge() {
  const bridge = `https://corsproxy.io/?${encodeURIComponent(GOOGLE_NEWS_RSS)}`;
  const res = await fetch(bridge);
  if (!res.ok) throw new Error(`bridge ${res.status}`);
  const xml = await res.text();
  const items = parseRssXml(xml, 8);
  if (!items.length) throw new Error("No bridge items");
  return {
    items,
    updatedAt: new Date().toISOString(),
    officialUrl: SED_OFFICIAL_URL,
  };
}

export function formatNewsTime(isoOrRss) {
  if (!isoOrRss) return "";
  const d = new Date(isoOrRss);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Load live SED-related news. Uses cache, then local Vite API, then public fallbacks.
 * @param {{ force?: boolean }} opts
 */
export async function loadPunjabEduNews(opts = {}) {
  if (!opts.force) {
    const cached = readCache();
    if (cached?.items?.length) {
      return { ...cached, fromCache: true };
    }
  }

  const errors = [];
  for (const fn of [fetchViaLocalApi, fetchViaRss2Json, fetchViaCorsBridge]) {
    try {
      const payload = await fn();
      writeCache(payload);
      return { ...payload, fromCache: false };
    } catch (e) {
      errors.push(String(e?.message || e));
    }
  }

  const stale = (() => {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    } catch {
      return null;
    }
  })();
  if (stale?.items?.length) {
    return { ...stale, fromCache: true, stale: true, errors };
  }

  throw new Error(errors.join("; ") || "Unable to load news");
}
