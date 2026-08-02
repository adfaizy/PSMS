/**
 * Dev/preview middleware: live Punjab School Education Department news.
 * Aggregates Google News (SED/Punjab education) + official SED notification PDFs.
 */

const GOOGLE_NEWS_RSS =
  "https://news.google.com/rss/search?q=%22School+Education+Department%22+Punjab+Pakistan+OR+%22education+secretary%22+Punjab+schools&hl=en-PK&gl=PK&ceid=PK:en";
const SED_NOTIFICATIONS_URL = "https://schools.punjab.gov.pk/generalnotification";
const SED_HOME = "https://schools.punjab.gov.pk";

function decodeXml(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(s) {
  return decodeXml(String(s || "").replace(/<[^>]+>/g, " "));
}

function absUrl(href, base = SED_HOME) {
  if (!href) return base;
  if (/^https?:\/\//i.test(href)) return href.split("#")[0];
  if (href.startsWith("//")) return `https:${href}`.split("#")[0];
  if (href.startsWith("/")) return `${base}${href}`.split("#")[0];
  return `${base}/${href}`.split("#")[0];
}

function parseRssItems(xml, limit = 8) {
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

function parseSedNotifications(html, limit = 6) {
  const items = [];
  const seen = new Set();
  const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && items.length < limit) {
    const href = m[1] || "";
    const title = stripTags(m[2]);
    if (!href || title.length < 18 || title.length > 180) continue;
    if (!/system\/files|\.pdf/i.test(href)) continue;
    if (/overlay-context=disclose|proactive_information/i.test(href)) continue;
    if (/^(Home|About|Functions|Skip|Register|Track|Search)/i.test(title)) continue;
    const link = absUrl(href);
    if (seen.has(link)) continue;
    seen.add(link);
    items.push({
      id: `sed-${items.length}-${title.slice(0, 40)}`,
      title,
      link,
      source: "SED Notifications",
      publishedAt: null,
      kind: "notification",
    });
  }
  return items;
}

async function fetchText(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "PSMS-EduNews/1.0", Accept: "text/html,application/rss+xml,*/*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function buildPunjabEduNewsPayload() {
  const errors = [];
  let news = [];
  let notifications = [];

  try {
    const xml = await fetchText(GOOGLE_NEWS_RSS);
    news = parseRssItems(xml, 8);
  } catch (e) {
    errors.push(`news: ${e?.message || e}`);
  }

  try {
    const html = await fetchText(SED_NOTIFICATIONS_URL);
    notifications = parseSedNotifications(html, 5);
  } catch (e) {
    errors.push(`notifications: ${e?.message || e}`);
  }

  const items = [...news, ...notifications];
  return {
    ok: items.length > 0,
    updatedAt: new Date().toISOString(),
    sourceLabel: "Punjab School Education Department",
    officialUrl: "https://schools.punjab.gov.pk/notifications",
    items,
    errors,
  };
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=120");
  res.end(json);
}

export function punjabEduNewsMiddleware() {
  return async function punjabEduNewsApi(req, res, next) {
    const url = req.url || "";
    if (!url.startsWith("/api/punjab-edu-news")) return next();
    try {
      const payload = await buildPunjabEduNewsPayload();
      sendJson(res, payload.ok ? 200 : 502, payload);
    } catch (e) {
      sendJson(res, 500, {
        ok: false,
        updatedAt: new Date().toISOString(),
        items: [],
        errors: [String(e?.message || e)],
      });
    }
  };
}

export function punjabEduNewsPlugin() {
  return {
    name: "psms-punjab-edu-news",
    configureServer(server) {
      server.middlewares.use(punjabEduNewsMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(punjabEduNewsMiddleware());
    },
  };
}
