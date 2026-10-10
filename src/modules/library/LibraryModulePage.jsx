import React, { useEffect, useState } from "react";
import { consumeNavIntent } from "@/lib/navIntent.js";
import { LibraryPage } from "@/LibraryPage";
import {
  LibraryOverviewPanel,
  LibraryOverduePanel,
  LibraryMembersPanel,
  LibraryFinesPanel,
  LibraryReportsPanel,
} from "./LibraryToolPanels.jsx";
import { LIBRARY_MANAGE_TABS, loadLibraryRules, summarizeLibrary } from "./libraryManageCore.js";
import { C } from "@/shared/theme";

function initialLibraryTab() {
  const intent = consumeNavIntent();
  if (!intent || (intent.page && intent.page !== "library")) return "overview";
  const allowed = new Set(LIBRARY_MANAGE_TABS.map((t) => t.id));
  const alias =
    intent.tab === "books" || intent.tab === "borrowings" ? "catalog" : intent.tab;
  if (alias && allowed.has(alias)) return alias;
  return "overview";
}

export function LibraryModulePage({
  settings,
  students,
  activeSchoolId,
  setBarSubtitle,
}) {
  const [tab, setTab] = useState(initialLibraryTab);
  const rules = loadLibraryRules(activeSchoolId);
  const summary = summarizeLibrary(activeSchoolId, rules);

  useEffect(() => {
    if (!setBarSubtitle) return;
    const t = LIBRARY_MANAGE_TABS.find((x) => x.id === tab);
    setBarSubtitle(t?.l || "Library Management");
    return () => setBarSubtitle?.("");
  }, [tab, setBarSubtitle]);

  return (
    <div
      className="psms-page"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        className="no-print"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.navy }}>Library Management</div>
          <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
            {summary.bookCount} titles · {summary.issuedCount} issued · {summary.overdueCount} overdue
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            background: "#ecfeff",
            borderRadius: 10,
            padding: 4,
            gap: 4,
            border: "1px solid #a5f3fc",
            maxWidth: "100%",
          }}
        >
          {LIBRARY_MANAGE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                border: "none",
                cursor: "pointer",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                background: tab === t.id ? "#0e7490" : "transparent",
                color: tab === t.id ? "#fff" : "#0e7490",
                whiteSpace: "nowrap",
              }}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <LibraryOverviewPanel activeSchoolId={activeSchoolId} onGoTab={setTab} />
      )}

      {tab === "catalog" && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
            padding: 12,
          }}
        >
          <LibraryPage
            setBarSubtitle={null}
            activeSchoolId={activeSchoolId}
            classes={settings?.classes || []}
            students={students}
            initialTab="books"
            embedded
          />
        </div>
      )}

      {tab === "overdue" && <LibraryOverduePanel key={activeSchoolId} activeSchoolId={activeSchoolId} />}
      {tab === "members" && <LibraryMembersPanel key={activeSchoolId} activeSchoolId={activeSchoolId} />}
      {tab === "fines" && <LibraryFinesPanel key={activeSchoolId} activeSchoolId={activeSchoolId} />}
      {tab === "reports" && <LibraryReportsPanel key={activeSchoolId} activeSchoolId={activeSchoolId} />}
    </div>
  );
}
