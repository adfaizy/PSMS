import React, { useEffect, useState } from "react";
import { consumeNavIntent } from "@/lib/navIntent.js";
import {
  AcademicOverviewPanel,
  AcademicClassesPanel,
  AcademicSubjectsPanel,
  AcademicSessionsPanel,
  AcademicCalendarPanel,
  AcademicPeriodsPanel,
  AcademicSchemePanel,
} from "./AcademicToolPanels.jsx";
import { ACADEMIC_TABS, summarizeAcademicStructure } from "./academicCore.js";
import { ModulePageShell } from "@/components/ModulePageShell";

function initialAcademicTab() {
  const intent = consumeNavIntent();
  if (!intent || (intent.page && intent.page !== "academic")) return "overview";
  const allowed = new Set(ACADEMIC_TABS.map((t) => t.id));
  const alias =
    intent.tab === "time"
      ? "periods"
      : intent.tab === "common"
        ? "subjects"
        : intent.tab;
  if (alias && allowed.has(alias)) return alias;
  return "overview";
}

export function AcademicModulePage({
  settings,
  setSettings,
  students = [],
  sessions = [],
  currentSession,
  setCurrentSession,
  addSession,
  exam_datesheet,
  onNavigate,
  setBarSubtitle,
}) {
  const [tab, setTab] = useState(initialAcademicTab);
  const summary = summarizeAcademicStructure(settings, sessions, currentSession);

  useEffect(() => {
    if (!setBarSubtitle) return;
    const t = ACADEMIC_TABS.find((x) => x.id === tab);
    setBarSubtitle(t?.l || "Academic Management");
    return () => setBarSubtitle?.("");
  }, [tab, setBarSubtitle]);

  return (
    <ModulePageShell
      title="Academic Management"
      description={`${summary.classCount} classes · ${summary.uniqueSubjects} subjects · Session ${summary.currentSession}`}
      tabs={ACADEMIC_TABS}
      tab={tab}
      onTabChange={setTab}
    >
      {tab === "overview" && (
        <AcademicOverviewPanel
          settings={settings}
          sessions={sessions}
          currentSession={currentSession}
          students={students}
          exam_datesheet={exam_datesheet}
          onNavigate={onNavigate}
          onGoTab={setTab}
        />
      )}
      {tab === "classes" && <AcademicClassesPanel settings={settings} setSettings={setSettings} />}
      {tab === "subjects" && <AcademicSubjectsPanel settings={settings} setSettings={setSettings} />}
      {tab === "sessions" && (
        <AcademicSessionsPanel
          sessions={sessions}
          currentSession={currentSession}
          setCurrentSession={setCurrentSession}
          addSession={addSession}
        />
      )}
      {tab === "calendar" && <AcademicCalendarPanel settings={settings} setSettings={setSettings} />}
      {tab === "periods" && <AcademicPeriodsPanel settings={settings} setSettings={setSettings} />}
      {tab === "scheme" && <AcademicSchemePanel settings={settings} setSettings={setSettings} />}
    </ModulePageShell>
  );
}
