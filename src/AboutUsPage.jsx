import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MessageCircle, Phone, Mail, MessageSquareText, Send, X } from "lucide-react";
import { APP_BRAND_LOGO_URL } from "./branding.js";
import { UI } from "./uiTokens.js";
import "./AboutUsPage.css";

const PHONE_E164 = "923089640258";
const PHONE_DISPLAY = "+92 308 9640258";
const SUPPORT_EMAIL = "adfaizy1976@gmail.com";

const DEFAULT_INQUIRY_INTRO =
  "Hello,\n\nI would like information regarding:\n• Sales / licensing\n• Purchase / subscription\n• Operation & documentation\n• Other\n\n";

const WHATSAPP_HREF = `https://wa.me/${PHONE_E164}?text=${encodeURIComponent(DEFAULT_INQUIRY_INTRO)}`;
const TEL_HREF = `tel:+${PHONE_E164}`;
const MAILTO_HREF = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("PSMS — Punjab School Management System — inquiry")}&body=${encodeURIComponent(DEFAULT_INQUIRY_INTRO)}`;

const DISCUSSION_STORAGE_KEY = "sms_about_discussion_messages_v1";
const MAX_BODY_LEN = 4000;

const BUBBLE_VISITOR = "#ffffff";
const BUBBLE_SUPPORT = "#e8f5e9";
const BUBBLE_BORDER_VISITOR = "rgba(15,23,42,0.08)";
const BUBBLE_BORDER_SUPPORT = "rgba(27,94,32,0.12)";

function loadMessages() {
  try {
    const raw = localStorage.getItem(DISCUSSION_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((m) => m && typeof m.id === "string" && typeof m.body === "string") : [];
  } catch {
    return [];
  }
}

function saveMessages(messages) {
  try {
    localStorage.setItem(DISCUSSION_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    /* ignore quota */
  }
}

function genMsgId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatChatTime(ts) {
  try {
    return new Date(ts).toLocaleString("en-PK", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function DiscussionPanel() {
  const [messages, setMessages] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [composerMode, setComposerMode] = useState("visitor");
  const [visitorName, setVisitorName] = useState("");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    queueMicrotask(() => {
      setMessages(loadMessages());
      setHydrated(true);
    });
  }, []);

  const persist = useCallback((next) => {
    setMessages(next);
    saveMessages(next);
  }, []);

  const byId = useMemo(() => {
    const m = {};
    for (const msg of messages) m[msg.id] = msg;
    return m;
  }, [messages]);

  const sortedMessages = useMemo(() => [...messages].sort((a, b) => a.createdAt - b.createdAt), [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sortedMessages.length, hydrated]);

  const clearComposer = () => {
    setBody("");
    setReplyTo(null);
  };

  const submitMessage = (e) => {
    e.preventDefault();
    const text = body.trim().slice(0, MAX_BODY_LEN);
    if (!text) return;

    const isSupport = composerMode === "support";
    const entry = {
      id: genMsgId(),
      parentId: replyTo || null,
      role: isSupport ? "owner" : "client",
      authorName: isSupport ? "Support" : (visitorName || "").trim().slice(0, 80) || "Guest",
      body: text,
      createdAt: Date.now(),
    };
    persist([...messages, entry]);
    clearComposer();
  };

  if (!hydrated) return null;

  return (
    <section className="about-section about-discussion" aria-labelledby="about-discussion-title">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <MessageSquareText size={20} color="#1B5E20" strokeWidth={2} aria-hidden />
        <h2 id="about-discussion-title" className="about-section__title" style={{ margin: 0 }}>
          Discussion
        </h2>
      </div>
      <p className="about-discussion__intro">
        Local support thread for this browser. Visitors post with a name; use <strong>Support</strong> on this device to reply.
      </p>

      <div className="about-chat">
        <div className="about-chat__head">
          <div className="about-chat__avatar">
            <MessageSquareText size={20} strokeWidth={2} aria-hidden />
          </div>
          <div>
            <div className="about-chat__title">PSMS Support</div>
            <div className="about-chat__sub">Stored on this device only</div>
          </div>
        </div>

        <div ref={scrollRef} className="about-chat__body">
          {sortedMessages.length === 0 ? (
            <div className="about-chat__empty">No messages yet. Start the conversation below.</div>
          ) : (
            sortedMessages.map((msg) => {
              const isSupport = msg.role === "owner";
              const parent = msg.parentId ? byId[msg.parentId] : null;
              const quote = parent
                ? (parent.body || "").trim().slice(0, 120) + ((parent.body || "").length > 120 ? "…" : "")
                : "";

              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: isSupport ? "flex-end" : "flex-start",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", alignItems: isSupport ? "flex-end" : "flex-start" }}>
                    <div
                      style={{
                        padding: "8px 12px 6px",
                        borderRadius: isSupport ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                        background: isSupport ? BUBBLE_SUPPORT : BUBBLE_VISITOR,
                        border: `1px solid ${isSupport ? BUBBLE_BORDER_SUPPORT : BUBBLE_BORDER_VISITOR}`,
                        boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
                      }}
                    >
                      {quote ? (
                        <div
                          style={{
                            fontSize: 11,
                            color: UI.textMuted,
                            borderLeft: `3px solid ${isSupport ? "#1B5E20" : "#64748b"}`,
                            paddingLeft: 8,
                            marginBottom: 6,
                            lineHeight: 1.35,
                          }}
                        >
                          {parent?.authorName ? `${parent.authorName}: ` : ""}
                          {quote}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 12, fontWeight: 700, color: isSupport ? "#14532d" : "#1B5E20", marginBottom: 4 }}>
                        {msg.authorName || (isSupport ? "Support" : "Guest")}
                      </div>
                      <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.body}</div>
                      <div style={{ fontSize: 10, color: "rgba(15,23,42,0.45)", marginTop: 6, textAlign: "right" }}>
                        {formatChatTime(msg.createdAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyTo(msg.id)}
                      style={{
                        marginTop: 4,
                        border: "none",
                        background: "transparent",
                        color: "#1B5E20",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: "2px 4px",
                        fontFamily: "inherit",
                      }}
                    >
                      Reply
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={submitMessage} className="about-chat__composer">
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: UI.textMuted, alignSelf: "center" }}>Posting as</span>
            {[
              { id: "visitor", label: "Visitor", activeBg: "#1B5E20" },
              { id: "support", label: "Support", activeBg: "#14532d" },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setComposerMode(mode.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: composerMode === mode.id ? "none" : `1px solid ${UI.borderSubtle}`,
                  background: composerMode === mode.id ? mode.activeBg : "#fff",
                  color: composerMode === mode.id ? "#fff" : UI.textMain,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {replyTo && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 10,
                padding: "8px 10px",
                background: "#fff",
                borderRadius: 8,
                fontSize: 12,
                color: UI.textMuted,
                border: `1px solid ${UI.borderSubtle}`,
              }}
            >
              <span>
                Replying to {byId[replyTo]?.authorName ? <strong>{byId[replyTo].authorName}</strong> : "message"}
              </span>
              <button
                type="button"
                aria-label="Cancel reply"
                onClick={() => setReplyTo(null)}
                style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, color: UI.textMuted, display: "flex" }}
              >
                <X size={18} />
              </button>
            </div>
          )}

          {composerMode === "visitor" && (
            <input
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder="Your name"
              maxLength={80}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${UI.borderSubtle}`,
                fontSize: 14,
                fontFamily: "inherit",
                marginBottom: 8,
                background: "#fff",
              }}
            />
          )}

          {composerMode === "support" && (
            <p style={{ margin: "0 0 8px", fontSize: 11, color: UI.textMuted, lineHeight: 1.4 }}>
              Replies appear on the right as <strong>Support</strong>. Anyone with access to this browser can post as support.
            </p>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY_LEN))}
              placeholder={composerMode === "support" ? "Type a reply…" : "Type a message…"}
              rows={2}
              style={{
                flex: 1,
                boxSizing: "border-box",
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${UI.borderSubtle}`,
                fontSize: 14,
                fontFamily: "inherit",
                lineHeight: 1.45,
                resize: "none",
                minHeight: 44,
                maxHeight: 120,
                background: "#fff",
              }}
            />
            <button
              type="submit"
              aria-label="Send"
              style={{
                padding: "11px 16px",
                borderRadius: 10,
                border: "none",
                background: "#1B5E20",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "inherit",
                boxShadow: "0 2px 8px rgba(27,94,32,0.28)",
              }}
            >
              <Send size={18} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export function AboutUsPage() {
  return (
    <div className="about-page">
      <header className="about-hero">
        <div className="about-hero__inner">
          <div className="about-hero__brand">
            <img className="about-hero__logo" src={APP_BRAND_LOGO_URL} alt="" />
            <div>
              <h1 className="about-hero__name">PSMS</h1>
              <p className="about-hero__tag">Punjab School Management System</p>
            </div>
          </div>
          <p className="about-hero__lead">
            Professional school operations software — contact us for licensing, custom builds, or day-to-day support.
          </p>
          <div className="about-hero__cta">
            <a className="about-cta about-cta--primary" href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} aria-hidden />
              Message on WhatsApp
            </a>
            <a className="about-cta about-cta--ghost" href={MAILTO_HREF}>
              <Mail size={16} aria-hidden />
              Email the team
            </a>
          </div>
        </div>
      </header>

      <section className="about-section" aria-labelledby="about-contact-title">
        <h2 id="about-contact-title" className="about-section__title">
          Contact
        </h2>
        <p className="about-section__text" style={{ marginBottom: 14 }}>
          Choose a channel — WhatsApp and email open with a draft you can edit before sending.
        </p>
        <div className="about-contact-grid">
          <a
            className="about-contact"
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open WhatsApp for ${PHONE_DISPLAY}`}
          >
            <span className="about-contact__icon about-contact__icon--wa">
              <MessageCircle size={18} aria-hidden />
            </span>
            <span className="about-contact__label">WhatsApp</span>
            <span className="about-contact__value">{PHONE_DISPLAY}</span>
          </a>
          <a className="about-contact" href={TEL_HREF} aria-label={`Call ${PHONE_DISPLAY}`}>
            <span className="about-contact__icon about-contact__icon--call">
              <Phone size={18} aria-hidden />
            </span>
            <span className="about-contact__label">Call</span>
            <span className="about-contact__value">{PHONE_DISPLAY}</span>
          </a>
          <a className="about-contact" href={MAILTO_HREF} aria-label={`Email ${SUPPORT_EMAIL}`}>
            <span className="about-contact__icon about-contact__icon--mail">
              <Mail size={18} aria-hidden />
            </span>
            <span className="about-contact__label">Email</span>
            <span className="about-contact__value">{SUPPORT_EMAIL}</span>
          </a>
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-product-title">
        <h2 id="about-product-title" className="about-section__title">
          About the product
        </h2>
        <p className="about-section__text">
          PSMS runs on desktop, Android, macOS, and modern browsers — built for reliable school administration across platforms.
        </p>
        <p className="about-section__text">
          The web app is free for general use. For custom workflows, we design and deploy tailored solutions for web, desktop, mobile, or macOS.
        </p>
        <div className="about-pill-row" aria-label="Platforms">
          {["Web", "Desktop", "Android", "macOS", "Local-first"].map((label) => (
            <span key={label} className="about-pill">
              {label}
            </span>
          ))}
        </div>
      </section>

      <DiscussionPanel />
    </div>
  );
}
