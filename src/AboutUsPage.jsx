import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MessageCircle, Phone, Mail, MessageSquareText, Send, X } from "lucide-react";
import { UI } from "./uiTokens.js";

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

/** WhatsApp-like tints */
const CHAT_BG = "#e5ddd5";
const BUBBLE_VISITOR = "#ffffff";
const BUBBLE_SUPPORT = "#d9fdd3";
const BUBBLE_BORDER_VISITOR = "rgba(0,0,0,0.06)";
const BUBBLE_BORDER_SUPPORT = "rgba(0,0,0,0.04)";

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

const actionBtnBase = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  width: "100%",
  maxWidth: 420,
  margin: "0 auto",
  padding: "16px 22px",
  borderRadius: UI.radiusCard,
  border: "none",
  cursor: "pointer",
  fontFamily: UI.fontApp,
  fontSize: 15,
  fontWeight: 700,
  color: "#fff",
  boxShadow: "0 8px 22px rgba(15,23,42,0.2)",
  transition: "transform 0.12s ease, box-shadow 0.18s ease",
};

const btnPrimary = {
  padding: "10px 20px",
  borderRadius: UI.radiusControl,
  border: "none",
  background: "#128c7e",
  color: "#fff",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  fontFamily: UI.fontApp,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  boxShadow: "0 2px 6px rgba(18,140,126,0.35)",
};

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

  const startReply = (msgId) => {
    setReplyTo(msgId);
  };

  if (!hydrated) return null;

  return (
    <div
      style={{
        marginTop: 28,
        paddingTop: 22,
        borderTop: `1px solid ${UI.borderSubtle}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <MessageSquareText size={22} color="var(--color-navy)" strokeWidth={2} aria-hidden />
        <h3
          style={{
            margin: 0,
            fontFamily: UI.fontHeading,
            fontSize: 18,
            fontWeight: 700,
            color: UI.navy,
          }}
        >
          Discussion
        </h3>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: UI.fontSmall, color: UI.textMuted, lineHeight: 1.5 }}>
        Chat-style thread: visitors post with their name; use <strong>Support</strong> on this device to answer
        inquiries. Stored locally in your browser only.
      </p>

      <div
        style={{
          borderRadius: 12,
          overflow: "hidden",
          border: `1px solid ${UI.borderSubtle}`,
          maxWidth: 520,
          margin: "0 auto 16px",
          boxShadow: "0 2px 12px rgba(15,23,42,0.08)",
        }}
      >
        <div
          style={{
            background: "linear-gradient(180deg, #075e54 0%, #128c7e 100%)",
            color: "#fff",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: UI.fontApp,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MessageSquareText size={22} strokeWidth={2} aria-hidden />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Support chat</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>Local discussion</div>
          </div>
        </div>

        <div
          ref={scrollRef}
          style={{
            background: CHAT_BG,
            backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0,0,0,0.015) 8px, rgba(0,0,0,0.015) 16px)",
            minHeight: 280,
            maxHeight: 420,
            overflowY: "auto",
            padding: "12px 10px 16px",
            boxSizing: "border-box",
          }}
        >
          {sortedMessages.length === 0 ? (
            <div
              style={{
                padding: 28,
                textAlign: "center",
                color: UI.textMuted,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              No messages yet. Say hello below.
            </div>
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
                        borderRadius: isSupport ? "10px 10px 4px 10px" : "10px 10px 10px 4px",
                        background: isSupport ? BUBBLE_SUPPORT : BUBBLE_VISITOR,
                        border: `1px solid ${isSupport ? BUBBLE_BORDER_SUPPORT : BUBBLE_BORDER_VISITOR}`,
                        boxShadow: "0 1px 1px rgba(0,0,0,0.06)",
                      }}
                    >
                      {quote ? (
                        <div
                          style={{
                            fontSize: 11,
                            color: UI.textMuted,
                            borderLeft: `3px solid ${isSupport ? "#128c7e" : UI.navy}`,
                            paddingLeft: 8,
                            marginBottom: 6,
                            lineHeight: 1.35,
                            opacity: 0.95,
                          }}
                        >
                          {parent?.authorName ? `${parent.authorName}: ` : ""}
                          {quote}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 12, fontWeight: 700, color: isSupport ? "#075e54" : UI.navy, marginBottom: 4 }}>
                        {msg.authorName || (isSupport ? "Support" : "Guest")}
                      </div>
                      <div style={{ fontSize: 14, color: "#111827", lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.body}</div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(0,0,0,0.45)",
                          marginTop: 6,
                          textAlign: "right",
                        }}
                      >
                        {formatChatTime(msg.createdAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startReply(msg.id)}
                      style={{
                        marginTop: 4,
                        border: "none",
                        background: "transparent",
                        color: "#075e54",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: "2px 4px",
                        fontFamily: UI.fontApp,
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

        <form
          onSubmit={submitMessage}
          style={{
            padding: 12,
            background: "#f0f2f5",
            borderTop: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: UI.textMuted, alignSelf: "center" }}>Posting as</span>
            <button
              type="button"
              onClick={() => setComposerMode("visitor")}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: composerMode === "visitor" ? "none" : `1px solid ${UI.borderSubtle}`,
                background: composerMode === "visitor" ? UI.navy : "#fff",
                color: composerMode === "visitor" ? "#fff" : UI.textMain,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: UI.fontApp,
              }}
            >
              Visitor
            </button>
            <button
              type="button"
              onClick={() => setComposerMode("support")}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: composerMode === "support" ? "none" : `1px solid ${UI.borderSubtle}`,
                background: composerMode === "support" ? "#128c7e" : "#fff",
                color: composerMode === "support" ? "#fff" : UI.textMain,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: UI.fontApp,
              }}
            >
              Support
            </button>
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
                Replying to{" "}
                {byId[replyTo]?.authorName ? <strong>{byId[replyTo].authorName}</strong> : "message"}
              </span>
              <button
                type="button"
                aria-label="Cancel reply"
                onClick={() => setReplyTo(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 4,
                  color: UI.textMuted,
                  display: "flex",
                }}
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
                borderRadius: 24,
                border: `1px solid ${UI.borderSubtle}`,
                fontSize: 14,
                fontFamily: UI.fontApp,
                marginBottom: 8,
                background: "#fff",
              }}
            />
          )}

          {composerMode === "support" && (
            <p style={{ margin: "0 0 8px", fontSize: 11, color: UI.textMuted, lineHeight: 1.4 }}>
              Replies appear on the right as <strong>Support</strong>. Anyone with access to this browser can post as
              support—there is no PIN.
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
                borderRadius: 20,
                border: `1px solid ${UI.borderSubtle}`,
                fontSize: 14,
                fontFamily: UI.fontApp,
                lineHeight: 1.45,
                resize: "none",
                minHeight: 44,
                maxHeight: 120,
                background: "#fff",
              }}
            />
            <button type="submit" style={btnPrimary} aria-label="Send">
              <Send size={18} strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AboutUsPage() {
  return (
    <div style={{ fontFamily: UI.fontApp, color: UI.textMain, maxWidth: 640 }}>
      <div
        style={{
          background: UI.surface,
          border: `1px solid ${UI.borderSubtle}`,
          borderRadius: UI.radiusCard,
          padding: 22,
          boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        }}
      >
        <h2
          style={{
            margin: "0 0 14px",
            fontFamily: UI.fontHeading,
            fontSize: 20,
            fontWeight: 700,
            color: UI.navy,
            lineHeight: 1.3,
          }}
        >
          About Us {'&'} Support
        </h2>
        <div
          style={{
            margin: "0 0 22px",
            fontSize: UI.fontBody,
            color: UI.textMuted,
            lineHeight: 1.6,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <p style={{ margin: 0 }}>
            Connect with our team for inquiries related to sales, purchasing, operations, documentation, or
            general information. Use the options below—your device will automatically open the appropriate
            application with a pre-filled message that you can review and customize before sending.
          </p>
          <p style={{ margin: 0 }}>
            Our solution is designed to work seamlessly across multiple platforms, including desktop, Android,
            macOS, and other modern operating systems, ensuring accessibility and flexibility for all users.
          </p>
          <p style={{ margin: 0 }}>
            This web application is provided free of charge for general use. However, if you require a
            customized solution tailored to your specific business processes or operational needs, we offer
            professional development services. We can design and deploy applications for web, desktop, mobile
            (Android), macOS, or any other platform based on your requirements.
          </p>
          <p style={{ margin: 0 }}>
            Feel free to contact us to discuss your project—we are available to deliver scalable, efficient, and
            user-focused solutions.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open WhatsApp for ${PHONE_DISPLAY} with a pre-filled message`}
            style={{
              ...actionBtnBase,
              flexDirection: "column",
              gap: 6,
              paddingTop: 14,
              paddingBottom: 14,
              background: "#25D366",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 12px 28px rgba(37,211,102,0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = actionBtnBase.boxShadow;
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <MessageCircle size={22} strokeWidth={2.25} aria-hidden />
              WhatsApp
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.02em",
                opacity: 0.95,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {PHONE_DISPLAY}
            </span>
          </a>

          <a
            href={TEL_HREF}
            aria-label={`Call support at ${PHONE_DISPLAY}`}
            style={{
              ...actionBtnBase,
              flexDirection: "column",
              gap: 6,
              paddingTop: 14,
              paddingBottom: 14,
              background: UI.navy,
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 12px 28px rgba(30,58,138,0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = actionBtnBase.boxShadow;
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Phone size={22} strokeWidth={2.25} aria-hidden />
              Call
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.02em",
                opacity: 0.95,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {PHONE_DISPLAY}
            </span>
          </a>

          <a
            href={MAILTO_HREF}
            aria-label={`Compose an email to ${SUPPORT_EMAIL}`}
            style={{
              ...actionBtnBase,
              flexDirection: "column",
              gap: 6,
              paddingTop: 14,
              paddingBottom: 14,
              background: UI.gold,
              color: "#1e293b",
              textDecoration: "none",
              boxShadow: "0 8px 22px rgba(180,130,20,0.25)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 12px 28px rgba(180,130,20,0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 8px 22px rgba(180,130,20,0.25)";
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Mail size={22} strokeWidth={2.25} aria-hidden />
              Email
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                opacity: 0.92,
                textAlign: "center",
                wordBreak: "break-all",
                lineHeight: 1.35,
                maxWidth: "100%",
              }}
            >
              {SUPPORT_EMAIL}
            </span>
          </a>
        </div>

        <DiscussionPanel />
      </div>
    </div>
  );
}
