import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { UI } from "./uiTokens.js";
import {
  formatNewsTime,
  loadPunjabEduNews,
  NEWS_REFRESH_MS,
  SED_OFFICIAL_URL,
} from "./punjabEduNews.js";

const C = {
  navy: UI.navy,
  gray: UI.gray,
};

export default function PunjabEduNewsPanel() {
  const [items, setItems] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [officialUrl, setOfficialUrl] = useState(SED_OFFICIAL_URL);
  const [status, setStatus] = useState("loading"); // loading | live | error
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setStatus((s) => (s === "live" ? s : "loading"));
    try {
      const data = await loadPunjabEduNews({ force });
      setItems(Array.isArray(data.items) ? data.items.slice(0, 10) : []);
      setUpdatedAt(data.updatedAt || null);
      setOfficialUrl(data.officialUrl || SED_OFFICIAL_URL);
      setStatus("live");
      setError("");
    } catch (e) {
      setStatus((s) => (s === "live" ? "live" : "error"));
      setError(e?.message || "Could not load news");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load(false);
    })();
    const id = setInterval(() => {
      if (!cancelled) load(true);
    }, NEWS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [load]);

  const newsItems = items.filter((it) => it.kind !== "notification");
  const noticeItems = items.filter((it) => it.kind === "notification");
  const primary = newsItems.length ? newsItems : items;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontFamily: UI.fontHeading,
            fontWeight: 800,
            fontSize: 12,
            color: C.navy,
            letterSpacing: "0.02em",
          }}
        >
          Punjab Education News
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          title="Refresh live news"
          aria-label="Refresh live news"
          style={{
            border: "1px solid #e2e8f0",
            background: "#fff",
            borderRadius: 8,
            width: 28,
            height: 28,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: refreshing ? "wait" : "pointer",
            color: "#475569",
            padding: 0,
            flexShrink: 0,
          }}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 10,
          fontSize: 10,
          color: "#64748b",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: status === "live" ? "#16a34a" : status === "loading" ? "#f59e0b" : "#ef4444",
            boxShadow: status === "live" ? "0 0 0 3px rgba(22,163,74,0.18)" : "none",
            flexShrink: 0,
          }}
        />
        <span>
          {status === "loading" && "Fetching live updates…"}
          {status === "live" && (
            <>
              Live · SED / Punjab education
              {updatedAt ? ` · ${formatNewsTime(updatedAt)}` : ""}
            </>
          )}
          {status === "error" && "Offline — try refresh"}
        </span>
      </div>

      {status === "loading" && !primary.length && (
        <div style={{ display: "grid", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 52,
                borderRadius: 10,
                background: "linear-gradient(90deg,#f1f5f9 0%,#e2e8f0 50%,#f1f5f9 100%)",
                backgroundSize: "200% 100%",
                animation: "psms-news-shimmer 1.2s ease infinite",
              }}
            />
          ))}
        </div>
      )}

      {status === "error" && !primary.length && (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: 12,
            fontSize: 11,
            color: "#991b1b",
            lineHeight: 1.45,
          }}
        >
          {error || "Unable to load Punjab Education Department news right now."}
        </div>
      )}

      {!!primary.length && (
        <div style={{ display: "grid", gap: 8, marginBottom: noticeItems.length ? 12 : 0 }}>
          {primary.slice(0, 6).map((item) => (
            <a
              key={item.id}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                textDecoration: "none",
                borderRadius: 10,
                background: "linear-gradient(135deg,#eff6ff 0%,#f8fafc 100%)",
                border: "1px solid #bfdbfe",
                padding: "10px 11px",
                color: "inherit",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#0f172a",
                  lineHeight: 1.4,
                  marginBottom: 4,
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 6,
                  fontSize: 10,
                  color: "#64748b",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.source}
                  {item.publishedAt ? ` · ${formatNewsTime(item.publishedAt)}` : ""}
                </span>
                <ExternalLink size={11} style={{ flexShrink: 0, color: "#2563eb" }} />
              </div>
            </a>
          ))}
        </div>
      )}

      {!!noticeItems.length && (
        <div style={{ marginTop: 2 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.gray,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            Official SED notices
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {noticeItems.slice(0, 4).map((item) => (
              <a
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  textDecoration: "none",
                  borderRadius: 10,
                  background: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  padding: "9px 10px",
                  fontSize: 11,
                  color: "#334155",
                  lineHeight: 1.4,
                  fontWeight: 600,
                }}
              >
                {item.title}
              </a>
            ))}
          </div>
        </div>
      )}

      <a
        href={officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          marginTop: 12,
          fontSize: 11,
          fontWeight: 700,
          color: "#1d4ed8",
          textDecoration: "none",
        }}
      >
        Official SED notifications
        <ExternalLink size={12} />
      </a>

      <style>{`
        @keyframes psms-news-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
