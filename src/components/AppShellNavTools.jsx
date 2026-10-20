import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Zap, UserPlus, ClipboardList, Wallet, GraduationCap, Briefcase, School } from "lucide-react";
import { dashboardService } from "@/services";
import { setNavIntent } from "@/lib/navIntent.js";
import { C } from "@/shared/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <div className={compact ? "relative min-w-0 flex-[0_1_160px]" : "relative min-w-[180px] flex-[0_1_240px]"}>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
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
            className="h-9 pl-8 text-xs font-semibold"
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
                <Button
                  key={`${hit.type}-${hit.id}`}
                  type="button"
                  variant="ghost"
                  onClick={() => go(hit.page, hit.tab)}
                  className="h-auto w-full flex-col items-start justify-start rounded-none border-0 border-b border-slate-100 bg-white px-3 py-2.5 font-normal hover:bg-slate-50"
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{hit.title}</div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                    {hit.type === "student" ? "Student" : "Staff"} · {hit.subtitle}
                  </div>
                </Button>
              ))
            )}
          </div>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setQuickOpen((v) => !v);
            setOpen(false);
          }}
          title="Quick actions"
          className="h-[34px] shrink-0 gap-1.5 whitespace-nowrap px-2.5 text-xs font-bold"
          style={{ color: C.navy }}
        >
          <Zap size={14} aria-hidden />
          {compact ? "Actions" : "Quick Actions"}
        </Button>
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
                <Button
                  key={action.id}
                  type="button"
                  variant="ghost"
                  onClick={() => go(action.page, action.tab)}
                  className="h-auto w-full justify-start gap-2.5 rounded-none border-0 border-b border-slate-100 bg-white px-3 py-2.5 font-normal hover:bg-slate-50"
                >
                  <Icon size={15} color={C.navy} aria-hidden />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{action.label}</span>
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
