import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MessageCircle, Phone, Mail, MessageSquareText, Send, X, Info, Headphones } from "lucide-react";
import { APP_BRAND_LOGO_URL } from "./branding.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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

const CONTACT_CHANNELS = [
  {
    id: "whatsapp",
    title: "WhatsApp",
    description: "Fast replies for sales and support",
    value: PHONE_DISPLAY,
    href: WHATSAPP_HREF,
    external: true,
    icon: MessageCircle,
    iconClass: "bg-[#128c7e] text-white",
    cta: "Open WhatsApp",
  },
  {
    id: "call",
    title: "Phone",
    description: "Speak with the team directly",
    value: PHONE_DISPLAY,
    href: TEL_HREF,
    external: false,
    icon: Phone,
    iconClass: "bg-primary text-primary-foreground",
    cta: "Call now",
  },
  {
    id: "email",
    title: "Email",
    description: "Licensing, docs, and custom work",
    value: SUPPORT_EMAIL,
    href: MAILTO_HREF,
    external: false,
    icon: Mail,
    iconClass: "bg-amber-700 text-white",
    cta: "Compose email",
  },
];

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
  const endRef = useRef(null);

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
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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
    persist([
      ...messages,
      {
        id: genMsgId(),
        parentId: replyTo || null,
        role: isSupport ? "owner" : "client",
        authorName: isSupport ? "Support" : (visitorName || "").trim().slice(0, 80) || "Guest",
        body: text,
        createdAt: Date.now(),
      },
    ]);
    clearComposer();
  };

  const onComposerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitMessage(e);
    }
  };

  if (!hydrated) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading discussion…</CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="border-b bg-primary px-4 py-4 text-primary-foreground sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
            <MessageSquareText className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <CardTitle className="text-base text-primary-foreground">PSMS Support</CardTitle>
            <CardDescription className="text-primary-foreground/80">Stored on this device only</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">
          Local thread for this browser. Post as a visitor, or switch to Support to reply on this device.
        </p>

        <div className="max-h-[380px] min-h-[240px] overflow-y-auto rounded-lg border bg-muted/40 p-3">
          {sortedMessages.length === 0 ? (
            <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <MessageSquareText className="h-8 w-8 opacity-40" aria-hidden />
              <p className="m-0 font-medium text-foreground">No messages yet</p>
              <p className="m-0 max-w-xs text-xs">Say hello below — Enter sends, Shift+Enter adds a new line.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedMessages.map((msg) => {
                const isSupport = msg.role === "owner";
                const parent = msg.parentId ? byId[msg.parentId] : null;
                const quote = parent
                  ? (parent.body || "").trim().slice(0, 120) + ((parent.body || "").length > 120 ? "…" : "")
                  : "";

                return (
                  <div key={msg.id} className={cn("flex", isSupport ? "justify-end" : "justify-start")}>
                    <div className={cn("flex max-w-[85%] flex-col", isSupport ? "items-end" : "items-start")}>
                      <div
                        className={cn(
                          "rounded-xl border px-3 py-2 shadow-sm",
                          isSupport
                            ? "rounded-br-sm border-primary/15 bg-primary/10"
                            : "rounded-bl-sm border-border bg-background"
                        )}
                      >
                        {quote ? (
                          <div className="mb-1.5 border-l-2 border-primary/50 pl-2 text-[11px] leading-snug text-muted-foreground">
                            {parent?.authorName ? `${parent.authorName}: ` : ""}
                            {quote}
                          </div>
                        ) : null}
                        <div className={cn("mb-1 text-xs font-bold", isSupport ? "text-primary" : "text-foreground")}>
                          {msg.authorName || (isSupport ? "Support" : "Guest")}
                        </div>
                        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{msg.body}</div>
                        <div className="mt-1.5 text-right text-[10px] text-muted-foreground">{formatChatTime(msg.createdAt)}</div>
                      </div>
                      <Button type="button" variant="link" size="sm" className="h-auto px-1 py-1 text-xs" onClick={() => setReplyTo(msg.id)}>
                        Reply
                      </Button>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <form onSubmit={submitMessage} className="space-y-3 rounded-lg border bg-card p-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Posting as</Label>
            <Tabs value={composerMode} onValueChange={setComposerMode}>
              <TabsList className="h-9 w-full sm:w-auto">
                <TabsTrigger value="visitor" className="flex-1 sm:flex-none">
                  Visitor
                </TabsTrigger>
                <TabsTrigger value="support" className="flex-1 sm:flex-none">
                  Support
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {replyTo && (
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span>
                Replying to {byId[replyTo]?.authorName ? <strong className="text-foreground">{byId[replyTo].authorName}</strong> : "message"}
              </span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Cancel reply" onClick={() => setReplyTo(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {composerMode === "visitor" && (
            <div className="space-y-1.5">
              <Label htmlFor="about-visitor-name">Your name</Label>
              <Input
                id="about-visitor-name"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="Optional — defaults to Guest"
                maxLength={80}
              />
            </div>
          )}

          {composerMode === "support" && (
            <p className="m-0 text-xs text-muted-foreground">
              Replies appear on the right as <strong>Support</strong>. Anyone with access to this browser can post as support.
            </p>
          )}

          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="about-chat-body" className="sr-only">
                Message
              </Label>
              <Textarea
                id="about-chat-body"
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY_LEN))}
                onKeyDown={onComposerKeyDown}
                placeholder={composerMode === "support" ? "Type a reply…" : "Type a message…"}
                rows={2}
                className="min-h-[72px] resize-none"
              />
              <p className="m-0 text-[11px] text-muted-foreground">
                {body.length}/{MAX_BODY_LEN} · Enter to send
              </p>
            </div>
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0" aria-label="Send message" disabled={!body.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function AboutUsPage() {
  const [tab, setTab] = useState("overview");

  return (
    <div className="about-page mx-auto max-w-[920px] space-y-5">
      <header className="about-hero">
        <div className="about-hero__inner relative z-[1] grid gap-4 justify-items-start">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src={APP_BRAND_LOGO_URL}
              alt=""
              className="h-[68px] w-[68px] shrink-0 rounded-[14px] border-2 border-white/35 object-cover shadow-lg sm:h-[72px] sm:w-[72px]"
            />
            <div className="min-w-0">
              <h1 className="m-0 text-[clamp(1.55rem,3.2vw,2.35rem)] font-extrabold tracking-tight text-white leading-tight">
                PSMS
              </h1>
              <p className="mt-1.5 mb-0 text-[13px] font-semibold uppercase tracking-wide text-white/80">
                Punjab School Management System
              </p>
            </div>
          </div>
          <p className="m-0 max-w-xl text-[15px] leading-relaxed text-white/90">
            Professional school operations software — contact us for licensing, custom builds, or day-to-day support.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/95 shadow-md">
              <a href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden />
                Message on WhatsApp
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <a href={MAILTO_HREF}>
                <Mail aria-hidden />
                Email the team
              </a>
            </Button>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/80 p-1">
          <TabsTrigger value="overview" className="gap-1.5">
            <Info className="h-3.5 w-3.5" aria-hidden />
            Overview
          </TabsTrigger>
          <TabsTrigger value="contact" className="gap-1.5">
            <Headphones className="h-3.5 w-3.5" aria-hidden />
            Contact
          </TabsTrigger>
          <TabsTrigger value="discussion" className="gap-1.5">
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
            Discussion
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4 focus-visible:ring-0">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-primary">About the product</CardTitle>
              <CardDescription>What PSMS offers schools and administrators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p className="m-0">
                PSMS runs on desktop, Android, macOS, and modern browsers — built for reliable school administration across platforms.
              </p>
              <p className="m-0">
                The web app is free for general use. For custom workflows, we design and deploy tailored solutions for web, desktop, mobile, or macOS.
              </p>
              <Separator className="my-2" />
              <div className="flex flex-wrap gap-2" aria-label="Platforms">
                {["Web", "Desktop", "Android", "macOS", "Local-first"].map((label) => (
                  <Badge key={label} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/15">
                    {label}
                  </Badge>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/30 pt-4">
              <Button type="button" onClick={() => setTab("contact")}>
                View contact options
              </Button>
              <Button type="button" variant="outline" onClick={() => setTab("discussion")}>
                Open discussion
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="mt-4 space-y-4 focus-visible:ring-0">
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-primary">Contact</CardTitle>
              <CardDescription>WhatsApp and email open with a draft you can edit before sending.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {CONTACT_CHANNELS.map((channel) => {
                  const Icon = channel.icon;
                  return (
                    <Card key={channel.id} className="border-border/80 shadow-none transition-shadow hover:shadow-md">
                      <CardHeader className="space-y-3 pb-3">
                        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", channel.iconClass)}>
                          <Icon className="h-4 w-4" aria-hidden />
                        </div>
                        <div>
                          <CardTitle className="text-base">{channel.title}</CardTitle>
                          <CardDescription className="mt-1">{channel.description}</CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <p className="m-0 break-words text-xs font-semibold tabular-nums text-muted-foreground">{channel.value}</p>
                      </CardContent>
                      <CardFooter>
                        <Button asChild className="w-full" variant={channel.id === "whatsapp" ? "default" : "outline"}>
                          <a
                            href={channel.href}
                            target={channel.external ? "_blank" : undefined}
                            rel={channel.external ? "noopener noreferrer" : undefined}
                            aria-label={`${channel.cta}: ${channel.value}`}
                          >
                            <Icon aria-hidden />
                            {channel.cta}
                          </a>
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discussion" className="mt-4 focus-visible:ring-0">
          <DiscussionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
