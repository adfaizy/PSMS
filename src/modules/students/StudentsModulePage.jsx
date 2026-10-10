import React, { useEffect, useState } from "react";
import { consumeNavIntent } from "@/lib/navIntent.js";
import { StudentsPage } from "@/modules/examination/ExaminationPage";
import { AdmissionPanel } from "./AdmissionPanel.jsx";
import {
  PromotionPanel,
  DocumentsPanel,
  HealthPanel,
  DisciplinePanel,
  LeavingPanel,
  AlumniPanel,
} from "./StudentToolPanels.jsx";
import { STUDENTS_TABS, summarizeStudentDirectory } from "./studentsCore.js";
import { C } from "@/shared/theme";

function initialStudentsTab() {
  const intent = consumeNavIntent();
  if (!intent || (intent.page && intent.page !== "students")) return "admission";
  const allowed = new Set(STUDENTS_TABS.map((t) => t.id));
  const alias = intent.tab === "record" ? "directory" : intent.tab;
  if (alias && allowed.has(alias)) return alias;
  return "admission";
}

export function StudentsModulePage({
  settings,
  students,
  setStudents,
  currentSession,
  currentUser,
  activeSchoolId,
  setBarSubtitle,
}) {
  const [tab, setTab] = useState(initialStudentsTab);

  useEffect(() => {
    if (!setBarSubtitle) return;
    const t = STUDENTS_TABS.find((x) => x.id === tab);
    setBarSubtitle(t?.l || "Student Management");
    return () => setBarSubtitle?.("");
  }, [tab, setBarSubtitle]);

  const summary = summarizeStudentDirectory(students, settings?.classes);

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
          <div style={{ fontWeight: 800, fontSize: 18, color: C.navy }}>Student Management</div>
          <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
            {summary.active} active · {summary.alumni} former · {summary.total} total
          </div>
        </div>
        <div
          style={{
            display: "inline-flex",
            flexWrap: "wrap",
            background: "#e8f5e9",
            borderRadius: 10,
            padding: 4,
            gap: 4,
            border: "1px solid #c8e6c9",
            maxWidth: "100%",
          }}
        >
          {STUDENTS_TABS.map((t) => (
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
                background: tab === t.id ? "#1B5E20" : "transparent",
                color: tab === t.id ? "#fff" : "#1B5E20",
                whiteSpace: "nowrap",
              }}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {tab === "admission" && (
        <AdmissionPanel
          settings={settings}
          students={students}
          setStudents={setStudents}
          activeSchoolId={activeSchoolId}
        />
      )}

      {tab === "directory" && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
            padding: 12,
          }}
        >
          <StudentsPage
            settings={settings}
            students={students}
            setStudents={setStudents}
            embedded
            currentSession={currentSession}
            currentUser={currentUser}
            activeSchoolId={activeSchoolId}
          />
        </div>
      )}

      {tab === "promotion" && (
        <PromotionPanel
          settings={settings}
          students={students}
          setStudents={setStudents}
          currentSession={currentSession}
        />
      )}

      {tab === "documents" && (
        <DocumentsPanel settings={settings} students={students} setStudents={setStudents} />
      )}

      {tab === "health" && (
        <HealthPanel settings={settings} students={students} setStudents={setStudents} />
      )}

      {tab === "discipline" && (
        <DisciplinePanel settings={settings} students={students} setStudents={setStudents} />
      )}

      {tab === "leaving" && (
        <LeavingPanel settings={settings} students={students} setStudents={setStudents} />
      )}

      {tab === "alumni" && (
        <AlumniPanel settings={settings} students={students} setStudents={setStudents} />
      )}
    </div>
  );
}
