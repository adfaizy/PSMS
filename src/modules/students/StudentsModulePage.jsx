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
import { ModulePageShell } from "@/components/ModulePageShell";

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
    <ModulePageShell
      title="Student Management"
      description={`${summary.active} active · ${summary.alumni} former · ${summary.total} total`}
      tabs={STUDENTS_TABS}
      tab={tab}
      onTabChange={setTab}
    >
      {tab === "admission" && (
        <AdmissionPanel
          settings={settings}
          students={students}
          setStudents={setStudents}
          activeSchoolId={activeSchoolId}
        />
      )}

      {tab === "directory" && (
        <StudentsPage
          settings={settings}
          students={students}
          setStudents={setStudents}
          embedded
          currentSession={currentSession}
          currentUser={currentUser}
          activeSchoolId={activeSchoolId}
        />
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
    </ModulePageShell>
  );
}
