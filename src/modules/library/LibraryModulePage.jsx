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
import { ModulePageShell } from "@/components/ModulePageShell";

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
    <ModulePageShell
      title="Library Management"
      description={`${summary.bookCount} titles · ${summary.issuedCount} issued · ${summary.overdueCount} overdue`}
      tabs={LIBRARY_MANAGE_TABS}
      tab={tab}
      onTabChange={setTab}
    >
      {tab === "overview" && (
        <LibraryOverviewPanel activeSchoolId={activeSchoolId} onGoTab={setTab} />
      )}

      {tab === "catalog" && (
        <LibraryPage
          setBarSubtitle={null}
          activeSchoolId={activeSchoolId}
          classes={settings?.classes || []}
          students={students}
          initialTab="books"
          embedded
        />
      )}

      {tab === "overdue" && <LibraryOverduePanel key={activeSchoolId} activeSchoolId={activeSchoolId} />}
      {tab === "members" && <LibraryMembersPanel key={activeSchoolId} activeSchoolId={activeSchoolId} />}
      {tab === "fines" && <LibraryFinesPanel key={activeSchoolId} activeSchoolId={activeSchoolId} />}
      {tab === "reports" && <LibraryReportsPanel key={activeSchoolId} activeSchoolId={activeSchoolId} />}
    </ModulePageShell>
  );
}
