import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Zap, UserPlus, ClipboardList, Wallet, GraduationCap, Briefcase, School } from "lucide-react";
import { dashboardService } from "@/services";
import { setNavIntent } from "@/lib/navIntent.js";
import { C } from "@/shared/theme";

const QUICK_ACTIONS = [
  { id: "admit", label: "Admit Student", page: "students", tab: "admission", icon: UserPlus },
  { id: "staff", label: "Staff Directory", page: "staff", tab: "directory", icon: Briefcase },
  { id: "academic", label: "Academic Setup", page: "academic", tab: "classes", icon: School },
  { id: "attendance", label: "Mark Attendance", page: "attendance", tab: "students", icon: ClipboardList },
  { id: "fees", label: "Fee Collection", page: "fees", tab: "collection", icon: Wallet },
  { id: "marks", label: "Marks Entry", page: "examination", tab: "marks", icon: GraduationCap },
];

/**
 * Global search + quick actions for Module 1 navigation (header toolbar).
 */
export function AppShellNavTools({
  students = [],
  staffProfiles = [],
  classes = [],
  onNavigate,
  compact = false,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const rootRef = useRef(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return dashboardService.search({
      query,
      students,
      staffProfiles,
      classes,
      limit: 10,
    });
  }, [query, students, staffProfiles, classes]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false);
        setQuickOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (page, tab) => {
    if (tab) setNavIntent({ page, tab });
    onNavigate?.(page);
    setOpen(false);
    setQuickOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="app-shell-nav-tools no-print" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <div style={{ position: "relative", minWidth: compact ? 0 : 180, flex: compact ? "0 1 160px" : "0 1 240px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 34,
            padding: "0 10px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            background: "#f8fafc",
          }}
        >
          <Search size={14} color={C.gray} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setQuickOpen(false);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search students, staff…"
            aria-label="Global search"
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              width: "100%",
              minWidth: 0,
              fontSize: 12,
              fontWeight: 600,
              color: C.navy,
            }}
          />
        </div>
        {open && query.trim() && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              zIndex: 80,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              boxShadow: "0 12px 32px rgba(15,23,42,0.14)",
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {results.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, color: C.gray }}>No matching records</div>
            ) : (
              results.map((hit) => (
                <button
                  key={`${hit.type}-${hit.id}`}
                  type="button"
                  onClick={() => go(hit.page, hit.tab)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    borderBottom: "1px solid #f1f5f9",
                    background: "#fff",
                    padding: "10px 12px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{hit.title}</div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                    {hit.type === "student" ? "Student" : "Staff"} · {hit.subtitle}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => {
            setQuickOpen((v) => !v);
            setOpen(false);
          }}
          title="Quick actions"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 34,
            padding: "0 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#fff",
            color: C.navy,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Zap size={14} aria-hidden />
          {compact ? "Actions" : "Quick Actions"}
        </button>
        {quickOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              zIndex: 80,
              width: 220,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              boxShadow: "0 12px 32px rgba(15,23,42,0.14)",
              overflow: "hidden",
            }}
          >
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => go(action.page, action.tab)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    border: "none",
                    borderBottom: "1px solid #f1f5f9",
                    background: "#fff",
                    padding: "10px 12px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Icon size={15} color={C.navy} aria-hidden />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{action.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
