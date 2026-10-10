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
import { C } from "@/shared/theme";

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
          <div style={{ fontWeight: 800, fontSize: 18, color: C.navy }}>Academic Management</div>
          <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
            {summary.classCount} classes · {summary.uniqueSubjects} subjects · Session {summary.currentSession}
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            background: "#eff6ff",
            borderRadius: 10,
            padding: 4,
            gap: 4,
            border: "1px solid #bfdbfe",
            maxWidth: "100%",
          }}
        >
          {ACADEMIC_TABS.map((t) => (
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
                background: tab === t.id ? "#1e3a5f" : "transparent",
                color: tab === t.id ? "#fff" : "#1e3a5f",
                whiteSpace: "nowrap",
              }}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

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
    </div>
  );
}
